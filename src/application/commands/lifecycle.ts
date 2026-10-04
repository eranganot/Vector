/**
 * Human and system commands for the lifecycle (docs/specs/domain-model.md §4). Each one: load the
 * entity FOR UPDATE, authorize, apply the domain transition, persist, and audit in one transaction.
 */
import { and, eq, inArray } from "drizzle-orm";
import { DomainError } from "@/domain/errors";
import {
  approvalRequestExpired,
  approvalUsableForExecution,
  approvalValidUntil,
  assertCanRetry,
  assertSeparationOfDuties,
  autoDecideAllowed,
  requireRationale,
} from "@/domain/lifecycle/guards";
import { transition } from "@/domain/lifecycle/machines";
import { evaluateApprovalPolicy, isEligibleApprover, type ApprovalRequirement } from "@/domain/policy/approval-rules";
import { assertAuthorized, authorizeSystem, authorizeUser } from "@/domain/policy/authorize";
import { type Actor, actorId } from "@/domain/types";
import {
  action,
  approval,
  decision,
  insight,
  kpi,
  kpiObservation,
  outboxMessage,
  outcome,
  task,
} from "@/infra/db/schema";
import { type AppContext, type CommandScope, runCommand } from "../context";
import type { Tx } from "../db";
import { playbook } from "../playbooks";
import { notFound, orgFacts, SYSTEM, unitsByIds } from "./shared";

const writeCtx = (units: Awaited<ReturnType<typeof unitsByIds>>) => ({ targetUnits: units, isWrite: true });

async function lockInsight(tx: Tx, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(insight)
    .where(and(eq(insight.id, id), eq(insight.orgId, orgId)))
    .for("update");
  return row ?? notFound("insight");
}
async function lockDecision(tx: Tx, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(decision)
    .where(and(eq(decision.id, id), eq(decision.orgId, orgId)))
    .for("update");
  return row ?? notFound("decision");
}
async function lockAction(tx: Tx, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(action)
    .where(and(eq(action.id, id), eq(action.orgId, orgId)))
    .for("update");
  return row ?? notFound("action");
}
async function openApproval(tx: Tx, actionId: string, statuses: ("requested" | "granted")[]) {
  const [row] = await tx
    .select()
    .from(approval)
    .where(and(eq(approval.actionId, actionId), inArray(approval.status, statuses)))
    .for("update");
  return row;
}

// ── Insight (I2, I3) ─────────────────────────────────────────────────────────
export async function acknowledgeInsight(ctx: AppContext, actor: Actor, insightId: string) {
  return runCommand(
    ctx,
    actor,
    "insight.acknowledge",
    { entityType: "insight", entityId: insightId },
    async ({ tx, now, audit }) => {
      const ins = await lockInsight(tx, ctx.orgId, insightId);
      assertAuthorized(
        authorizeUser(actor, "insight.acknowledge", writeCtx(await unitsByIds(tx, ctx.orgId, [ins.primaryUnitId]))),
      );
      const t = transition("insight", ins.status, "acknowledge");
      await tx
        .update(insight)
        .set({ status: t.to as "acknowledged", updatedAt: now, version: ins.version + 1 })
        .where(eq(insight.id, ins.id));
      await audit({
        operation: "insight.acknowledged",
        entityType: "insight",
        entityId: ins.id,
        fromState: ins.status,
        toState: t.to,
      });
    },
  );
}

export async function dismissInsight(ctx: AppContext, actor: Actor, insightId: string, rationale: string) {
  return runCommand(
    ctx,
    actor,
    "insight.dismiss",
    { entityType: "insight", entityId: insightId },
    async ({ tx, now, audit }) => {
      const ins = await lockInsight(tx, ctx.orgId, insightId);
      assertAuthorized(
        authorizeUser(actor, "insight.dismiss", writeCtx(await unitsByIds(tx, ctx.orgId, [ins.primaryUnitId]))),
      );
      const reason = requireRationale(rationale, "Dismissing an insight");
      const active = await tx
        .select({ id: action.id })
        .from(action)
        .where(and(eq(action.insightId, ins.id), inArray(action.status, ["pending_approval", "ready", "executing"])));
      if (active.length)
        throw new DomainError("Conflict", "cancel the insight's in-flight actions before dismissing it");
      const t = transition("insight", ins.status, "dismiss");
      await tx
        .update(insight)
        .set({ status: t.to as "dismissed", rationale: reason, updatedAt: now, version: ins.version + 1 })
        .where(eq(insight.id, ins.id));
      await audit({
        operation: "insight.dismissed",
        entityType: "insight",
        entityId: ins.id,
        fromState: ins.status,
        toState: t.to,
        reason,
      });
    },
  );
}

// ── Decision (D3, D4, D5) and submission (A2/A3 + P1) ────────────────────────
/** Submits a decided decision's proposed actions as system:policy, evaluating the approval policy for each. */
async function submitActions(scope: CommandScope, decisionId: string) {
  const { tx, ctx, now, auditAs } = scope;
  assertAuthorized(authorizeSystem(SYSTEM.policy, "action.submit"));
  const actions = await tx
    .select()
    .from(action)
    .where(and(eq(action.decisionId, decisionId), eq(action.status, "proposed")))
    .for("update");
  const [ins] = await tx
    .select()
    .from(insight)
    .where(eq(insight.id, (await lockDecision(tx, ctx.orgId, decisionId)).insightId));
  const [primary] = await unitsByIds(tx, ctx.orgId, [ins.primaryUnitId]);
  for (const a of actions) {
    const pb = playbook(a.type);
    const req = evaluateApprovalPolicy(
      {
        type: a.type,
        executor: a.executor as "internal_task" | "outbox_message",
        audience: (a.params as { audience?: "internal" | "external" }).audience,
        targetUnits: await unitsByIds(tx, ctx.orgId, a.targetUnitIds),
        estimatedCost: Number(a.estimatedCost),
        insightBand: ins.priorityBand as "P1" | "P2" | "P3" | "P4",
        insightPrimaryUnit: primary,
      },
      await orgFacts(tx, ctx.orgId, pb.budgetDepartmentCode),
    );
    const t = transition("action", a.status, req.required ? "submit_requires_approval" : "submit_no_approval");
    await tx
      .update(action)
      .set({ status: t.to as "ready", approvalRequirement: req, updatedAt: now, version: a.version + 1 })
      .where(eq(action.id, a.id));
    await auditAs(SYSTEM.policy, {
      operation: "action.submitted",
      entityType: "action",
      entityId: a.id,
      fromState: a.status,
      toState: t.to,
      policy: req,
    });
    if (req.required) {
      const [ap] = await tx
        .insert(approval)
        .values({
          orgId: ctx.orgId,
          actionId: a.id,
          actionRevision: a.revision,
          requirement: req,
          requestedAt: now,
          status: "requested",
        })
        .returning();
      await auditAs(SYSTEM.policy, {
        operation: "approval.requested",
        entityType: "approval",
        entityId: ap.id,
        toState: "requested",
        policy: req,
        changes: { actionId: a.id, actionRevision: a.revision },
      });
    }
  }
}

export async function acceptDecision(ctx: AppContext, actor: Actor, decisionId: string, rationale?: string) {
  return runCommand(ctx, actor, "decision.accept", { entityType: "decision", entityId: decisionId }, async (scope) => {
    const { tx, now, audit } = scope;
    const dec = await lockDecision(tx, ctx.orgId, decisionId);
    const [ins] = await tx.select().from(insight).where(eq(insight.id, dec.insightId));
    assertAuthorized(
      authorizeUser(actor, "decision.decide", writeCtx(await unitsByIds(tx, ctx.orgId, [ins.primaryUnitId]))),
    );
    const t = transition("decision", dec.status, "accept");
    await tx
      .update(decision)
      .set({
        status: t.to as "decided",
        decidedBy: actorId(actor),
        decidedAt: now,
        rationale: rationale ?? dec.rationale,
        updatedAt: now,
        version: dec.version + 1,
      })
      .where(eq(decision.id, dec.id));
    await audit({
      operation: "decision.decided",
      entityType: "decision",
      entityId: dec.id,
      fromState: dec.status,
      toState: t.to,
      reason: rationale ?? null,
      changes: { origin: dec.origin, decidedBy: actorId(actor) },
    });
    await submitActions(scope, dec.id);
  });
}

export async function declineDecision(ctx: AppContext, actor: Actor, decisionId: string, rationale: string) {
  return runCommand(
    ctx,
    actor,
    "decision.decline",
    { entityType: "decision", entityId: decisionId },
    async ({ tx, now, audit }) => {
      const dec = await lockDecision(tx, ctx.orgId, decisionId);
      const [ins] = await tx.select().from(insight).where(eq(insight.id, dec.insightId));
      assertAuthorized(
        authorizeUser(actor, "decision.decide", writeCtx(await unitsByIds(tx, ctx.orgId, [ins.primaryUnitId]))),
      );
      const reason = requireRationale(rationale, "Declining a decision");
      const t = transition("decision", dec.status, "decline");
      await tx
        .update(decision)
        .set({
          status: t.to as "declined",
          decidedBy: actorId(actor),
          decidedAt: now,
          rationale: reason,
          updatedAt: now,
          version: dec.version + 1,
        })
        .where(eq(decision.id, dec.id));
      await audit({
        operation: "decision.declined",
        entityType: "decision",
        entityId: dec.id,
        fromState: dec.status,
        toState: t.to,
        reason,
      });
      for (const a of await tx
        .select()
        .from(action)
        .where(and(eq(action.decisionId, dec.id), eq(action.status, "proposed")))) {
        const at = transition("action", a.status, "cancel");
        await tx
          .update(action)
          .set({ status: at.to as "cancelled", updatedAt: now, version: a.version + 1 })
          .where(eq(action.id, a.id));
        await audit({
          operation: "action.cancelled",
          entityType: "action",
          entityId: a.id,
          fromState: a.status,
          toState: at.to,
          reason: "decision declined",
        });
      }
    },
  );
}

/** D4 / AD-1: system:policy decides P3/P4 notify-only recommendations automatically. */
export async function autoDecide(ctx: AppContext, decisionId: string) {
  const actor = SYSTEM.policy;
  return runCommand(
    ctx,
    actor,
    "decision.auto_decide",
    { entityType: "decision", entityId: decisionId },
    async (scope) => {
      const { tx, now, audit } = scope;
      assertAuthorized(authorizeSystem(actor, "decision.auto_decide"));
      const dec = await lockDecision(tx, ctx.orgId, decisionId);
      const [ins] = await tx.select().from(insight).where(eq(insight.id, dec.insightId));
      const acts = await tx.select().from(action).where(eq(action.decisionId, dec.id));
      if (
        !autoDecideAllowed(
          ins.priorityBand,
          acts.map((a) => a.type),
          false,
        )
      ) {
        throw new DomainError("NotAuthorized", "AD-1 does not allow an automatic decision here");
      }
      const t = transition("decision", dec.status, "auto_decide");
      await tx
        .update(decision)
        .set({
          status: t.to as "decided",
          decidedBy: "policy:AD-1",
          decidedAt: now,
          autoRule: "AD-1",
          updatedAt: now,
          version: dec.version + 1,
        })
        .where(eq(decision.id, dec.id));
      await audit({
        operation: "decision.auto_decided",
        entityType: "decision",
        entityId: dec.id,
        fromState: dec.status,
        toState: t.to,
        policy: { rule: "AD-1" },
      });
      await submitActions(scope, dec.id);
    },
  );
}

// ── Approval (P2/A4, P3/A5) ──────────────────────────────────────────────────
async function decideApproval(
  ctx: AppContext,
  actor: Actor,
  actionId: string,
  verdict: "grant" | "deny",
  rationale?: string,
) {
  const op = verdict === "grant" ? "approval.grant" : "approval.deny";
  return runCommand(ctx, actor, op, { entityType: "action", entityId: actionId }, async ({ tx, now, audit }) => {
    if (actor.kind !== "user") throw new DomainError("NotAuthorized", "AZ-4: only a person can approve");
    const act = await lockAction(tx, ctx.orgId, actionId);
    const ap = await openApproval(tx, act.id, ["requested"]);
    if (!ap)
      throw new DomainError("IllegalTransition", `no open approval request for this action (action is ${act.status})`);
    assertAuthorized(authorizeUser(actor, "action.approve", { targetUnits: [], isWrite: true }));
    if (!isEligibleApprover(actor.assignments, ap.requirement as ApprovalRequirement)) {
      throw new DomainError(
        "NotAuthorized",
        "you are not eligible under every approval rule that applies to this action",
      );
    }
    assertSeparationOfDuties(actor.userId, act.proposedBy, act.ownerUserId);
    if (ap.actionRevision !== act.revision)
      throw new DomainError("IllegalTransition", "the action changed after this approval was requested");
    const reason = verdict === "deny" ? requireRationale(rationale, "Denying an approval") : rationale?.trim() || null;

    const pt = transition("approval", ap.status, verdict);
    await tx
      .update(approval)
      .set({
        status: pt.to as "granted",
        approverUserId: actor.userId,
        rationale: reason,
        decidedAt: now,
        validUntil: verdict === "grant" ? approvalValidUntil(now) : null,
        version: ap.version + 1,
      })
      .where(eq(approval.id, ap.id));
    await audit({
      operation: verdict === "grant" ? "approval.granted" : "approval.denied",
      entityType: "approval",
      entityId: ap.id,
      fromState: ap.status,
      toState: pt.to,
      reason,
      policy: ap.requirement,
      changes: { actionId: act.id, actionRevision: act.revision },
    });

    const at = transition("action", act.status, verdict === "grant" ? "approval_granted" : "approval_denied");
    await tx
      .update(action)
      .set({ status: at.to as "ready", updatedAt: now, version: act.version + 1 })
      .where(eq(action.id, act.id));
    await audit({
      operation: verdict === "grant" ? "action.approved" : "action.rejected",
      entityType: "action",
      entityId: act.id,
      fromState: act.status,
      toState: at.to,
      reason,
    });
  });
}

export const grantApproval = (ctx: AppContext, actor: Actor, actionId: string, rationale?: string) =>
  decideApproval(ctx, actor, actionId, "grant", rationale);
export const denyApproval = (ctx: AppContext, actor: Actor, actionId: string, rationale: string) =>
  decideApproval(ctx, actor, actionId, "deny", rationale);

// ── Clock (P4/A6, P6/P6b) ────────────────────────────────────────────────────
/** Expires unanswered requests older than 72 h and lapses unused grants. Silence never approves. */
export async function runClockJobs(ctx: AppContext) {
  const actor = SYSTEM.clock;
  return runCommand(
    ctx,
    actor,
    "clock.tick",
    { entityType: "organization", entityId: ctx.orgId },
    async ({ tx, now, audit }) => {
      let expired = 0;
      let lapsed = 0;
      const open = await tx
        .select()
        .from(approval)
        .where(and(eq(approval.orgId, ctx.orgId), inArray(approval.status, ["requested", "granted"])))
        .for("update");
      for (const ap of open) {
        const [act] = await tx.select().from(action).where(eq(action.id, ap.actionId)).for("update");
        if (ap.status === "requested" && approvalRequestExpired(ap.requestedAt, now)) {
          assertAuthorized(authorizeSystem(actor, "approval.expire"));
          await tx
            .update(approval)
            .set({ status: "expired", version: ap.version + 1 })
            .where(eq(approval.id, ap.id));
          await audit({
            operation: "approval.expired",
            entityType: "approval",
            entityId: ap.id,
            fromState: "requested",
            toState: transition("approval", "requested", "expire").to,
          });
          const at = transition("action", act.status, "approval_expired");
          await tx
            .update(action)
            .set({ status: at.to as "proposed", updatedAt: now, version: act.version + 1 })
            .where(eq(action.id, act.id));
          await audit({
            operation: "action.approval_expired",
            entityType: "action",
            entityId: act.id,
            fromState: act.status,
            toState: at.to,
          });
          expired++;
        } else if (ap.status === "granted" && act.status === "ready" && ap.validUntil && ap.validUntil <= now) {
          assertAuthorized(authorizeSystem(actor, "approval.lapse"));
          await tx
            .update(approval)
            .set({ status: "lapsed", version: ap.version + 1 })
            .where(eq(approval.id, ap.id));
          await audit({
            operation: "approval.lapsed",
            entityType: "approval",
            entityId: ap.id,
            fromState: "granted",
            toState: "lapsed",
          });
          const at = transition("action", act.status, "approval_lapsed");
          await tx
            .update(action)
            .set({ status: at.to as "pending_approval", updatedAt: now, version: act.version + 1 })
            .where(eq(action.id, act.id));
          const [re] = await tx
            .insert(approval)
            .values({
              orgId: ctx.orgId,
              actionId: act.id,
              actionRevision: act.revision,
              requirement: ap.requirement,
              requestedAt: now,
              status: "requested",
            })
            .returning();
          await audit({
            operation: "approval.requested",
            entityType: "approval",
            entityId: re.id,
            toState: "requested",
            reason: "previous approval lapsed",
            policy: ap.requirement,
          });
          lapsed++;
        }
      }
      return { expired, lapsed };
    },
  );
}

// ── Execution (A7, A7b, A8, A9, A10, A11) and outcome watch (O1) ─────────────
async function runExecutor(tx: Tx, orgId: string, act: typeof action.$inferSelect, now: Date) {
  if (act.executor === "internal_task") {
    const [t] = await tx
      .insert(task)
      .values({
        orgId,
        actionId: act.id,
        assigneeUserId: act.ownerUserId,
        title: act.title,
        body: JSON.stringify(act.params),
        simulated: true,
        createdAt: now,
      })
      .returning({ id: task.id });
    return { executor: "internal_task", simulated: true, taskId: t.id };
  }
  const p = act.params as { recipients?: string; subject?: string; body?: string; audience?: string };
  const [m] = await tx
    .insert(outboxMessage)
    .values({
      orgId,
      actionId: act.id,
      audience: p.audience ?? "internal",
      recipients: p.recipients ?? "",
      subject: p.subject ?? act.title,
      body: p.body ?? "",
      simulated: true,
      createdAt: now,
    })
    .returning({ id: outboxMessage.id });
  return { executor: "outbox_message", simulated: true, messageId: m.id };
}

export async function executeAction(ctx: AppContext, actionId: string, actor: Actor = SYSTEM.executor) {
  return runCommand(
    ctx,
    actor,
    "action.execute",
    { entityType: "action", entityId: actionId },
    async ({ tx, now, audit }) => {
      const act = await lockAction(tx, ctx.orgId, actionId);
      if (actor.kind === "system") assertAuthorized(authorizeSystem(actor, "action.execute"));
      else
        assertAuthorized(
          authorizeUser(actor, "action.execute", writeCtx(await unitsByIds(tx, ctx.orgId, act.targetUnitIds))),
        );

      // A7 run-time re-authorization: approval still valid for this revision.
      const req = act.approvalRequirement as ApprovalRequirement | null;
      if (req?.required) {
        const granted = await openApproval(tx, act.id, ["granted"]);
        const usable = approvalUsableForExecution(granted, act.revision, now);
        if (!usable.ok) throw new DomainError("NotAuthorized", `cannot execute: ${usable.reason}`);
      }
      const start = transition("action", act.status, "start_execution");
      await audit({
        operation: "action.execution_started",
        entityType: "action",
        entityId: act.id,
        fromState: act.status,
        toState: start.to,
      });
      let result: Awaited<ReturnType<typeof runExecutor>>;
      try {
        result = await runExecutor(tx, ctx.orgId, act, now);
      } catch (err) {
        const failed = transition("action", start.to, "fail_execution");
        await tx
          .update(action)
          .set({
            status: failed.to as "failed",
            result: { error: String(err) },
            attempt: act.attempt + 1,
            updatedAt: now,
            version: act.version + 1,
          })
          .where(eq(action.id, act.id));
        await audit({
          operation: "action.failed",
          entityType: "action",
          entityId: act.id,
          fromState: start.to,
          toState: failed.to,
          reason: String(err),
        });
        return { failed: true as const };
      }
      const done = transition("action", start.to, "complete_execution");
      await tx
        .update(action)
        .set({
          status: done.to as "executed",
          result,
          attempt: act.attempt + 1,
          updatedAt: now,
          version: act.version + 1,
        })
        .where(eq(action.id, act.id));
      await audit({
        operation: "action.executed",
        entityType: "action",
        entityId: act.id,
        fromState: start.to,
        toState: done.to,
        changes: { result },
      });

      // O1: start watching the outcome if the playbook measures one.
      const pb = playbook(act.type);
      if (pb.outcome) {
        assertAuthorized(authorizeSystem(SYSTEM.executor, "outcome.watch"));
        const [k] = await tx
          .select()
          .from(kpi)
          .where(and(eq(kpi.orgId, ctx.orgId), eq(kpi.code, pb.outcome.kpiCode)));
        const units = act.targetUnitIds;
        const today = now.toISOString().slice(0, 10);
        const before = await tx
          .select({ value: kpiObservation.value, day: kpiObservation.day })
          .from(kpiObservation)
          .where(and(eq(kpiObservation.kpiId, k.id), inArray(kpiObservation.orgUnitId, units)));
        const lastWeek = before
          .filter((o) => o.day < today)
          .sort((a, b) => (a.day < b.day ? 1 : -1))
          .slice(0, 7 * units.length);
        const baselineMean = lastWeek.reduce((s, o) => s + o.value, 0) / Math.max(lastWeek.length, 1);
        // The window is whole days: from the day after execution, for windowDays days (UTC day boundaries).
        const windowStart = new Date(`${today}T00:00:00Z`);
        windowStart.setUTCDate(windowStart.getUTCDate() + 1);
        const windowEnd = new Date(windowStart.getTime() + pb.outcome.windowDays * 86_400_000);
        const [o] = await tx
          .insert(outcome)
          .values({
            orgId: ctx.orgId,
            actionId: act.id,
            insightId: act.insightId,
            kpiId: k.id,
            unitIds: units,
            expectedDirection: pb.outcome.direction,
            expectedThreshold: pb.outcome.threshold,
            baseline: { mean: baselineMean, days: lastWeek.length / units.length, until: today },
            windowStart,
            windowEnd,
            status: transition("outcome", null, "start_watch").to as "observing",
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        await audit({
          operation: "outcome.watch_started",
          entityType: "outcome",
          entityId: o.id,
          toState: "observing",
          changes: { kpi: pb.outcome.kpiCode, baselineMean, windowEnd },
        });
      }
      return result;
    },
  );
}

/** The executor picks up every ready action (simulated execution, D7). Called after approvals and on clock ticks. */
export async function executeReadyActions(ctx: AppContext) {
  const ready = await ctx.db
    .select({ id: action.id })
    .from(action)
    .where(and(eq(action.orgId, ctx.orgId), eq(action.status, "ready")));
  const done: string[] = [];
  for (const a of ready) {
    try {
      await executeAction(ctx, a.id);
      done.push(a.id);
    } catch (err) {
      if (!(err instanceof DomainError)) throw err; // a refused execution is audited and stays put
    }
  }
  return done;
}

export async function cancelAction(ctx: AppContext, actor: Actor, actionId: string, rationale: string) {
  return runCommand(
    ctx,
    actor,
    "action.cancel",
    { entityType: "action", entityId: actionId },
    async ({ tx, now, audit }) => {
      const act = await lockAction(tx, ctx.orgId, actionId);
      assertAuthorized(
        authorizeUser(actor, "action.cancel", writeCtx(await unitsByIds(tx, ctx.orgId, act.targetUnitIds))),
      );
      const reason = requireRationale(rationale, "Cancelling an action");
      const t = transition("action", act.status, "cancel");
      const ap = await openApproval(tx, act.id, ["requested", "granted"]);
      if (ap) {
        const pt = transition("approval", ap.status, "withdraw");
        await tx
          .update(approval)
          .set({ status: pt.to as "withdrawn", version: ap.version + 1 })
          .where(eq(approval.id, ap.id));
        await audit({
          operation: "approval.withdrawn",
          entityType: "approval",
          entityId: ap.id,
          fromState: ap.status,
          toState: pt.to,
          reason: "action cancelled",
        });
      }
      await tx
        .update(action)
        .set({ status: t.to as "cancelled", updatedAt: now, version: act.version + 1 })
        .where(eq(action.id, act.id));
      await audit({
        operation: "action.cancelled",
        entityType: "action",
        entityId: act.id,
        fromState: act.status,
        toState: t.to,
        reason,
      });
    },
  );
}

/**
 * A12: changing an action's cost or params bumps its revision, withdraws any approval (P5b), returns it
 * to proposed and, if its decision is decided, re-submits it so the policy is evaluated afresh.
 */
export async function amendAction(
  ctx: AppContext,
  actor: Actor,
  actionId: string,
  change: { estimatedCost?: number; params?: Record<string, unknown> },
) {
  return runCommand(ctx, actor, "action.amend", { entityType: "action", entityId: actionId }, async (scope) => {
    const { tx, now, audit } = scope;
    const act = await lockAction(tx, ctx.orgId, actionId);
    assertAuthorized(
      authorizeUser(actor, "action.propose", writeCtx(await unitsByIds(tx, ctx.orgId, act.targetUnitIds))),
    );
    const t = transition("action", act.status, "amend");
    const ap = await openApproval(tx, act.id, ["requested", "granted"]);
    if (ap) {
      const pt = transition("approval", ap.status, "withdraw");
      await tx
        .update(approval)
        .set({ status: pt.to as "withdrawn", version: ap.version + 1 })
        .where(eq(approval.id, ap.id));
      await audit({
        operation: "approval.withdrawn",
        entityType: "approval",
        entityId: ap.id,
        fromState: ap.status,
        toState: pt.to,
        reason: "action changed",
      });
    }
    await tx
      .update(action)
      .set({
        estimatedCost: change.estimatedCost ?? act.estimatedCost,
        params: { ...(act.params as object), ...change.params },
        revision: act.revision + 1,
        status: t.to as "proposed",
        updatedAt: now,
        version: act.version + 1,
      })
      .where(eq(action.id, act.id));
    await audit({
      operation: "action.amended",
      entityType: "action",
      entityId: act.id,
      fromState: act.status,
      toState: t.to,
      changes: { revision: { from: act.revision, to: act.revision + 1 }, ...change },
    });
    const [dec] = await tx.select().from(decision).where(eq(decision.id, act.decisionId));
    if (dec.status === "decided") await submitActions(scope, dec.id);
  });
}

export async function retryAction(ctx: AppContext, actor: Actor, actionId: string) {
  return runCommand(
    ctx,
    actor,
    "action.retry",
    { entityType: "action", entityId: actionId },
    async ({ tx, now, audit }) => {
      const act = await lockAction(tx, ctx.orgId, actionId);
      assertAuthorized(
        authorizeUser(actor, "action.execute", writeCtx(await unitsByIds(tx, ctx.orgId, act.targetUnitIds))),
      );
      assertCanRetry(act.attempt);
      const t = transition("action", act.status, "retry");
      await tx
        .update(action)
        .set({ status: t.to as "ready", updatedAt: now, version: act.version + 1 })
        .where(eq(action.id, act.id));
      await audit({
        operation: "action.retried",
        entityType: "action",
        entityId: act.id,
        fromState: act.status,
        toState: t.to,
      });
    },
  );
}
