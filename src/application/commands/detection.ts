/**
 * The detector's write path: record a signal with its evidence, then either attach it to the open
 * insight with the same dedupe key (re-prioritizing it) or create a new insight with VECTOR's
 * recommended decision and proposed actions (rows I1, D1, A1).
 */
import { actionEconomics, type Economics } from "@/domain/economics";
import { createHash } from "node:crypto";
import { and, arrayOverlaps, eq, inArray } from "drizzle-orm";
import { assertAuthorized, authorizeSystem } from "@/domain/policy/authorize";
import { transition } from "@/domain/lifecycle/machines";
import { computeOpportunity, computePriority, type OpportunityInput, type PriorityInput } from "@/domain/priority";
import { action, decision, evidence, insight, signal } from "@/infra/db/schema";
import { canonicalJson } from "../audit";
import { type AppContext, runCommand } from "../context";
import { playbook } from "../playbooks";
import { SYSTEM, unitsByIds, visibleIds } from "./shared";

export type EvidenceInput = { kind: string; title: string; sourceRef: string; payload: unknown };

const economicsColumns = (e: Economics) => ({
  expectedImpactIls: e.expectedImpactIls,
  impactBasis: e.impactBasis,
  executionRisk: e.executionRisk,
  riskFactors: e.riskFactors,
});

export type DetectionInput = {
  signal: {
    type: string;
    source: string;
    detector: string;
    detectorVersion: string;
    observedAt: Date;
    primaryUnitId: string;
    measurements: Record<string, unknown>;
    dedupeKey: string;
  };
  evidence: EvidenceInput[];
  insight: {
    /** Defaults to "risk". Opportunities are scored with opportunity-v1 and never ranked against risks (ADR-006). */
    workstream?: "risk" | "opportunity";
    /** The department that owns the response (scenarios.md ●). */
    ownerDepartmentId?: string;
    title: string;
    whatHappened: string;
    whyItMatters: string;
    primaryUnitId: string;
    affectedUnitIds: string[];
    confidence: number;
    /** Risk inputs (priority-v2). Required for risks. */
    priority?: PriorityInput;
    /** Opportunity inputs (opportunity-v1). Required for opportunities. */
    opportunity?: OpportunityInput;
    generatedBy: string;
  };
  recommendation: {
    statement: string;
    rationale: string;
    actions: {
      type: string;
      title: string;
      ownerUserId: string;
      targetUnitIds: string[];
      dueAt?: Date;
      estimatedCost: number;
      params: Record<string, unknown>;
    }[];
  };
};

export type DetectionResult = {
  outcome: "created" | "attached";
  insightId: string;
  signalId: string;
  decisionId?: string;
  actionIds?: string[];
};

export async function recordDetection(ctx: AppContext, input: DetectionInput): Promise<DetectionResult> {
  const actor = SYSTEM.detector;
  return runCommand(
    ctx,
    actor,
    "insight.create",
    { entityType: "signal", entityId: "00000000-0000-0000-0000-000000000000" },
    async ({ tx, now, audit }) => {
      assertAuthorized(authorizeSystem(actor, "insight.create"));

      const [sig] = await tx
        .insert(signal)
        .values({ ...input.signal, orgId: ctx.orgId })
        .returning();
      const evidenceIds: string[] = [];
      for (const e of input.evidence) {
        const payloadHash = createHash("sha256").update(canonicalJson(e.payload)).digest("hex");
        const [row] = await tx
          .insert(evidence)
          .values({
            orgId: ctx.orgId,
            kind: e.kind,
            title: e.title,
            sourceRef: e.sourceRef,
            capturedAt: now,
            payload: e.payload,
            payloadHash,
          })
          .returning({ id: evidence.id });
        evidenceIds.push(row.id);
      }
      const workstream = input.insight.workstream ?? "risk";
      const priority =
        workstream === "opportunity"
          ? computeOpportunity({ ...input.insight.opportunity!, confidence: input.insight.confidence })
          : computePriority({ ...input.insight.priority!, confidence: input.insight.confidence });

      // Dedupe: an open/acknowledged insight already carrying a signal with this key absorbs the new one.
      const sameKey = await tx
        .select({ id: signal.id })
        .from(signal)
        .where(and(eq(signal.orgId, ctx.orgId), eq(signal.dedupeKey, input.signal.dedupeKey)));
      const existing = sameKey.length
        ? (
            await tx
              .select()
              .from(insight)
              .where(
                and(
                  eq(insight.orgId, ctx.orgId),
                  inArray(insight.status, ["open", "acknowledged"]),
                  arrayOverlaps(
                    insight.signalIds,
                    sameKey.map((s) => s.id),
                  ),
                ),
              )
              .for("update")
          )[0]
        : undefined;

      if (existing) {
        await tx
          .update(insight)
          .set({
            signalIds: [...existing.signalIds, sig.id],
            evidenceIds: [...existing.evidenceIds, ...evidenceIds],
            priorityScore: priority.score,
            priorityBand: priority.band,
            priorityBreakdown: priority,
            updatedAt: now,
            version: existing.version + 1,
          })
          .where(eq(insight.id, existing.id));
        await audit({
          operation: "insight.signal_attached",
          entityType: "insight",
          entityId: existing.id,
          changes: { signalId: sig.id },
          evidenceIds,
        });
        if (existing.priorityScore !== priority.score) {
          await audit({
            operation: "insight.reprioritized",
            entityType: "insight",
            entityId: existing.id,
            changes: {
              priorityScore: { from: existing.priorityScore, to: priority.score },
              priorityBand: { from: existing.priorityBand, to: priority.band },
            },
          });
        }
        return { outcome: "attached", insightId: existing.id, signalId: sig.id };
      }

      const affected = await unitsByIds(tx, ctx.orgId, [input.insight.primaryUnitId, ...input.insight.affectedUnitIds]);
      const t = transition("insight", null, "create");
      const [ins] = await tx
        .insert(insight)
        .values({
          orgId: ctx.orgId,
          workstream,
          ownerDepartmentId: input.insight.ownerDepartmentId,
          title: input.insight.title,
          whatHappened: input.insight.whatHappened,
          whyItMatters: input.insight.whyItMatters,
          primaryUnitId: input.insight.primaryUnitId,
          affectedUnitIds: input.insight.affectedUnitIds,
          visibleUnitIds: visibleIds(affected),
          signalIds: [sig.id],
          evidenceIds,
          confidence: input.insight.confidence,
          priorityScore: priority.score,
          priorityBand: priority.band,
          priorityBreakdown: priority,
          priorityModelVersion: priority.model,
          generatedBy: input.insight.generatedBy,
          status: t.to as "open",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await audit({
        operation: "insight.created",
        entityType: "insight",
        entityId: ins.id,
        toState: t.to,
        changes: {
          title: ins.title,
          workstream,
          priority: { model: priority.model, score: priority.score, band: priority.band },
          signalId: sig.id,
        },
        evidenceIds,
      });

      assertAuthorized(authorizeSystem(actor, "decision.recommend"));
      const d = transition("decision", null, "recommend");
      const [dec] = await tx
        .insert(decision)
        .values({
          orgId: ctx.orgId,
          insightId: ins.id,
          statement: input.recommendation.statement,
          rationale: input.recommendation.rationale,
          origin: "vector_recommended",
          status: d.to as "recommended",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await audit({
        operation: "decision.recommended",
        entityType: "decision",
        entityId: dec.id,
        toState: d.to,
        changes: { statement: dec.statement },
      });

      const actionIds: string[] = [];
      for (const a of input.recommendation.actions) {
        const pb = playbook(a.type);
        const targets = await unitsByIds(tx, ctx.orgId, a.targetUnitIds);
        const at = transition("action", null, "propose");
        const [act] = await tx
          .insert(action)
          .values({
            orgId: ctx.orgId,
            decisionId: dec.id,
            insightId: ins.id,
            type: a.type,
            title: a.title,
            ownerUserId: a.ownerUserId,
            proposedBy: actor.id,
            targetUnitIds: a.targetUnitIds,
            visibleUnitIds: [...new Set([...visibleIds(targets), ...ins.visibleUnitIds])],
            dueAt: a.dueAt,
            estimatedCost: a.estimatedCost,
            // Plan v2 (E1c): what the action is expected to deliver by quarter end, and its execution risk.
            ...economicsColumns(
              actionEconomics({
                type: a.type,
                weeklyIls: input.insight.priority?.impactIls ?? input.insight.opportunity?.valueIls ?? 0,
                confidence: input.insight.confidence,
                actionsInResponse: input.recommendation.actions.length,
                now,
              }),
            ),
            executor: pb.executor,
            params: { ...a.params, audience: pb.audience ?? "internal" },
            idempotencyKey: `${ins.id}:${a.type}:${actionIds.length}`,
            status: at.to as "proposed",
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        actionIds.push(act.id);
        await audit({
          operation: "action.proposed",
          entityType: "action",
          entityId: act.id,
          toState: at.to,
          changes: { type: act.type, title: act.title, ownerUserId: act.ownerUserId, estimatedCost: act.estimatedCost },
        });
      }
      return { outcome: "created", insightId: ins.id, signalId: sig.id, decisionId: dec.id, actionIds };
    },
  );
}
