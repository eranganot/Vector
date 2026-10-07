/**
 * Where an action stands and who it waits on (plan v2, E3c; Eran 2026-10-07: "what do we need to do, who needs to
 * do it, and where are the blockers"). One answer for every screen that lists actions: the owner, the step it is at,
 * the people that step waits on, and whether the viewer is one of them. Read-only.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { ApprovalRequirement } from "@/domain/policy/approval-rules";
import { hasPermission } from "@/domain/policy/permissions";
import type { Actor } from "@/domain/types";
import { action, approval, decision, insight, orgUnit } from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { peopleWithAssignments, routeApproval } from "./insights";

export type ActionStep = "decide" | "approve" | "ready" | "executing" | "done" | "failed" | "cancelled";

export type ActionWorkflow = {
  step: ActionStep;
  /** People the step waits on (deciders, approvers), or the owner once it is theirs to run. */
  waitingOn: string[];
  /** The viewer is asked to decide or approve it. */
  viewer: "decide" | "approve" | null;
  owner: { id: string; name: string; unitName: string };
  /** The recommendation behind it (the insight's decision statement). */
  recommendation: string | null;
};

type ActionRow = Pick<typeof action.$inferSelect, "id" | "insightId" | "status" | "ownerUserId" | "proposedBy">;

export async function actionWorkflows(
  db: DbOrTx,
  orgId: string,
  actor: Actor,
  acts: ActionRow[],
): Promise<Map<string, ActionWorkflow>> {
  const out = new Map<string, ActionWorkflow>();
  if (acts.length === 0) return out;
  const insightIds = [...new Set(acts.map((a) => a.insightId))];
  const [people, units, ins, decs, reqs] = await Promise.all([
    peopleWithAssignments(db, orgId),
    db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    db
      .select({ id: insight.id, primaryUnitId: insight.primaryUnitId })
      .from(insight)
      .where(inArray(insight.id, insightIds)),
    db
      .select()
      .from(decision)
      .where(and(eq(decision.orgId, orgId), inArray(decision.insightId, insightIds))),
    db
      .select()
      .from(approval)
      .where(
        and(
          eq(approval.orgId, orgId),
          eq(approval.status, "requested"),
          inArray(
            approval.actionId,
            acts.map((a) => a.id),
          ),
        ),
      ),
  ]);
  const unit = new Map(units.map((u) => [u.id, u]));
  const me = actor.kind === "user" ? actor.userId : "";
  const nameOf = (id: string) => people.get(id)?.name ?? "—";
  /** The person's own unit: their department, else their first managed unit. */
  const unitOf = (id: string) => {
    const as = people.get(id)?.assignments ?? [];
    const pick = as.find((a) => a.unit.type === "department") ?? as.find((a) => a.role !== "viewer") ?? as[0];
    return pick ? (unit.get(pick.unit.id)?.name ?? "—") : "—";
  };
  /** Accountable deciders: managers of the insight's primary unit, else of the nearest unit above with one. */
  const decidersOf = (insightId: string) => {
    const primary = ins.find((i) => i.id === insightId)?.primaryUnitId;
    const path = primary ? [...(unit.get(primary)?.pathIds ?? [primary])].reverse() : [];
    for (const u of path) {
      const ids = [...people.entries()]
        .filter(([, p]) => p.assignments.some((a) => a.unit.id === u && hasPermission(a.role, "decision.decide")))
        .map(([id]) => id);
      if (ids.length) return ids;
    }
    return [];
  };
  for (const a of acts) {
    const dec = decs.find((d) => d.insightId === a.insightId);
    const owner = { id: a.ownerUserId, name: nameOf(a.ownerUserId), unitName: unitOf(a.ownerUserId) };
    const base = { owner, recommendation: dec?.statement ?? null };
    if (a.status === "proposed" && (!dec || dec.status === "recommended")) {
      const ids = decidersOf(a.insightId);
      out.set(a.id, {
        ...base,
        step: "decide",
        waitingOn: ids.map(nameOf),
        viewer: ids.includes(me) ? "decide" : null,
      });
    } else if (a.status === "pending_approval") {
      const req = reqs.find((r) => r.actionId === a.id);
      const routed = req ? routeApproval(people, req.requirement as ApprovalRequirement, a).map(([id]) => id) : [];
      out.set(a.id, {
        ...base,
        step: "approve",
        waitingOn: routed.map(nameOf),
        viewer: routed.includes(me) ? "approve" : null,
      });
    } else {
      const step: ActionStep =
        a.status === "executed"
          ? "done"
          : a.status === "executing"
            ? "executing"
            : a.status === "failed"
              ? "failed"
              : a.status === "cancelled" || a.status === "rejected"
                ? "cancelled"
                : "ready";
      out.set(a.id, { ...base, step, waitingOn: step === "ready" ? [owner.name] : [], viewer: null });
    }
  }
  return out;
}
