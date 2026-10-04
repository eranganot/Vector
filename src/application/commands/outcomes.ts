/** Outcome evaluation (O2), human review (O3) and closing the loop on the insight (I4). */
import { and, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { createHash } from "node:crypto";
import { DomainError } from "@/domain/errors";
import { outcomeVerdict, requireRationale } from "@/domain/lifecycle/guards";
import { transition } from "@/domain/lifecycle/machines";
import { assertAuthorized, authorizeSystem, authorizeUser } from "@/domain/policy/authorize";
import type { Actor } from "@/domain/types";
import { action, decision, evidence, insight, kpiObservation, outcome } from "@/infra/db/schema";
import { canonicalJson } from "../audit";
import { type AppContext, runCommand } from "../context";
import type { Tx } from "../db";
import { notFound, SYSTEM, unitsByIds } from "./shared";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** I4: resolve the insight when every decision is closed and every executed action's outcome is evaluated. */
async function maybeResolveInsight(
  tx: Tx,
  insightId: string,
  now: Date,
  audit: (i: Parameters<typeof import("../audit").appendAudit>[2]) => Promise<void>,
) {
  const [ins] = await tx.select().from(insight).where(eq(insight.id, insightId)).for("update");
  if (!ins || !["open", "acknowledged"].includes(ins.status)) return;
  const decs = await tx.select().from(decision).where(eq(decision.insightId, insightId));
  if (decs.some((d) => d.status === "recommended")) return;
  const acts = await tx.select().from(action).where(eq(action.insightId, insightId));
  if (acts.some((a) => ["proposed", "pending_approval", "ready", "executing"].includes(a.status))) return;
  const outs = await tx.select().from(outcome).where(eq(outcome.insightId, insightId));
  if (outs.length === 0 || outs.some((o) => o.status === "observing")) return;
  const t = transition("insight", ins.status, "resolve");
  await tx
    .update(insight)
    .set({ status: t.to as "resolved", updatedAt: now, version: ins.version + 1 })
    .where(eq(insight.id, ins.id));
  await audit({
    operation: "insight.resolved",
    entityType: "insight",
    entityId: ins.id,
    fromState: ins.status,
    toState: t.to,
    reason: "loop closed: outcomes evaluated",
  });
}

/** Evaluates every outcome whose window has closed (system:outcome-evaluator). */
export async function evaluateDueOutcomes(ctx: AppContext) {
  const actor = SYSTEM.evaluator;
  return runCommand(
    ctx,
    actor,
    "outcome.evaluate",
    { entityType: "organization", entityId: ctx.orgId },
    async ({ tx, now, audit }) => {
      assertAuthorized(authorizeSystem(actor, "outcome.evaluate"));
      const due = await tx
        .select()
        .from(outcome)
        .where(and(eq(outcome.orgId, ctx.orgId), eq(outcome.status, "observing"), lte(outcome.windowEnd, now)))
        .for("update");
      const results: { outcomeId: string; verdict: string }[] = [];
      for (const o of due) {
        const obs = await tx
          .select()
          .from(kpiObservation)
          .where(
            and(
              eq(kpiObservation.kpiId, o.kpiId),
              inArray(kpiObservation.orgUnitId, o.unitIds),
              gte(kpiObservation.day, day(o.windowStart)),
              lt(kpiObservation.day, day(o.windowEnd)),
            ),
          );
        const windowDays = Math.round((o.windowEnd.getTime() - o.windowStart.getTime()) / 86_400_000);
        const coverage = obs.length / Math.max(1, windowDays * o.unitIds.length);
        const windowMean = obs.reduce((s, x) => s + x.value, 0) / Math.max(1, obs.length);
        const baselineMean = (o.baseline as { mean: number }).mean;
        const verdict = outcomeVerdict({
          baselineMean,
          windowMean,
          expectedDirection: o.expectedDirection as "up" | "down",
          threshold: o.expectedThreshold,
          coverage,
        });
        const payload = {
          kpiId: o.kpiId,
          unitIds: o.unitIds,
          from: day(o.windowStart),
          to: day(o.windowEnd),
          values: obs.map((x) => ({ day: x.day, unit: x.orgUnitId, value: x.value })),
        };
        const [ev] = await tx
          .insert(evidence)
          .values({
            orgId: ctx.orgId,
            kind: "kpi_series",
            title: "Outcome window observations",
            sourceRef: "kpi_observation",
            capturedAt: now,
            payload,
            payloadHash: createHash("sha256").update(canonicalJson(payload)).digest("hex"),
          })
          .returning({ id: evidence.id });
        const t = transition("outcome", o.status, "evaluate");
        const observed = { windowMean, baselineMean, change: windowMean - baselineMean, coverage };
        await tx
          .update(outcome)
          .set({
            status: t.to as "evaluated",
            verdict,
            verdictBy: "outcome-evaluator@v1",
            observed,
            evidenceIds: [ev.id],
            updatedAt: now,
            version: o.version + 1,
          })
          .where(eq(outcome.id, o.id));
        await audit({
          operation: "outcome.evaluated",
          entityType: "outcome",
          entityId: o.id,
          fromState: o.status,
          toState: t.to,
          changes: { verdict, observed },
          evidenceIds: [ev.id],
        });
        results.push({ outcomeId: o.id, verdict });
        await maybeResolveInsight(tx, o.insightId, now, audit);
      }
      return results;
    },
  );
}

/** O3: a human records the lesson; overriding the verdict requires a rationale and keeps the original in audit. */
export async function reviewOutcome(
  ctx: AppContext,
  actor: Actor,
  outcomeId: string,
  input: {
    lesson: string;
    overrideVerdict?: "worked" | "partially_worked" | "did_not_work" | "inconclusive";
    rationale?: string;
  },
) {
  return runCommand(
    ctx,
    actor,
    "outcome.review",
    { entityType: "outcome", entityId: outcomeId },
    async ({ tx, now, audit }) => {
      const [o] = await tx
        .select()
        .from(outcome)
        .where(and(eq(outcome.id, outcomeId), eq(outcome.orgId, ctx.orgId)))
        .for("update");
      if (!o) notFound("outcome");
      assertAuthorized(
        authorizeUser(actor, "outcome.review", {
          targetUnits: await unitsByIds(tx, ctx.orgId, o.unitIds),
          isWrite: true,
        }),
      );
      const lesson = requireRationale(input.lesson, "A review");
      if (input.overrideVerdict && input.overrideVerdict !== o.verdict)
        requireRationale(input.rationale, "Overriding a verdict");
      if (input.overrideVerdict === undefined && o.status !== "evaluated")
        throw new DomainError("IllegalTransition", `outcome is ${o.status}`);
      const t = transition("outcome", o.status, "review");
      await tx
        .update(outcome)
        .set({
          status: t.to as "reviewed",
          lesson,
          verdict: input.overrideVerdict ?? o.verdict,
          updatedAt: now,
          version: o.version + 1,
        })
        .where(eq(outcome.id, o.id));
      await audit({
        operation: "outcome.reviewed",
        entityType: "outcome",
        entityId: o.id,
        fromState: o.status,
        toState: t.to,
        reason: input.rationale ?? null,
        changes: {
          lesson,
          ...(input.overrideVerdict ? { verdict: { from: o.verdict, to: input.overrideVerdict } } : {}),
        },
      });
    },
  );
}
