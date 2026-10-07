/**
 * The value map of the Opportunities and Risks tabs (plan v2, E3; cross-department.md §1–§2): one point per action
 * item of the insights the page shows, with its cost, its expected impact by end of quarter and its live execution
 * risk (economics-v1). Read-only; visibility is re-checked here.
 */
import { and, arrayOverlaps, eq, inArray } from "drizzle-orm";
import { dependencyStatus } from "@/domain/commitments";
import { executionRisk, type ExecutionRisk } from "@/domain/economics";
import type { Actor } from "@/domain/types";
import { action, commitment, conflict, demoClock, dependency, insight, orgUnit, outcome } from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { actionWorkflows, type ActionWorkflow } from "./action-status";
import { readScope } from "./insights";

const TERMINAL = new Set(["executed", "cancelled", "rejected"]);
const GONE = new Set(["cancelled", "rejected"]);

export type ValuePoint = {
  actionId: string;
  insightId: string;
  workstream: string;
  title: string;
  insightTitle: string;
  band: string;
  status: string;
  /** Estimated cost (₪). */
  cost: number;
  /** Expected ₪ by end of quarter (protected for a risk, gained for an opportunity). */
  impact: number;
  impactBasis: string | null;
  net: number;
  risk: ExecutionRisk;
  dueAt: Date | null;
  /** When the opportunity's window closes, or when the risk bites. */
  windowAt: Date | null;
  /** Days from now to the action's due date (its earliest effect). */
  daysToValue: number | null;
  href: string;
  /** Who owns it, the step it is at and who that step waits on (E3c). */
  workflow: ActionWorkflow;
  /** What stands in its way: dependencies at risk or blocked, and conflicts on its units. */
  blockers: Blocker[];
};

export type Blocker =
  | { kind: "dependency"; waiting: string; on: string; title: string; status: string }
  | { kind: "conflict"; a: string; b: string; unitA: string; unitB: string; insightId: string | null };

export async function valueMap(db: DbOrTx, orgId: string, actor: Actor, insightIds: string[]) {
  const scope = readScope(actor);
  if (scope.length === 0 || insightIds.length === 0) return [] as ValuePoint[];
  const [ins, [clock]] = await Promise.all([
    db
      .select()
      .from(insight)
      .where(
        and(eq(insight.orgId, orgId), inArray(insight.id, insightIds), arrayOverlaps(insight.visibleUnitIds, scope)),
      ),
    db.select().from(demoClock).where(eq(demoClock.orgId, orgId)),
  ]);
  if (ins.length === 0) return [];
  const now = clock?.now ?? new Date();
  const [acts, allActs, units, cs, deps, ks, outs] = await Promise.all([
    db
      .select()
      .from(action)
      .where(
        and(
          eq(action.orgId, orgId),
          inArray(
            action.insightId,
            ins.map((i) => i.id),
          ),
        ),
      ),
    db
      .select({
        id: action.id,
        type: action.type,
        owner: action.ownerUserId,
        status: action.status,
        dueAt: action.dueAt,
      })
      .from(action)
      .where(eq(action.orgId, orgId)),
    db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    db.select().from(commitment).where(eq(commitment.orgId, orgId)),
    db.select().from(dependency).where(eq(dependency.orgId, orgId)),
    db
      .select()
      .from(conflict)
      .where(and(eq(conflict.orgId, orgId), eq(conflict.status, "open"))),
    db.select({ actionId: outcome.actionId, verdict: outcome.verdict }).from(outcome).where(eq(outcome.orgId, orgId)),
  ]);
  const unit = new Map(units.map((u) => [u.id, u]));
  const group = units.find((u) => u.type === "group");
  /** The action's units and the units above them (a region waits; its branches feel it), never the group root. */
  const reach = (targets: string[]) =>
    new Set(targets.flatMap((t) => unit.get(t)?.pathIds ?? [t]).filter((id) => id !== group?.id));
  const typeOf = new Map(allActs.map((a) => [a.id, a.type]));

  const flows = await actionWorkflows(
    db,
    orgId,
    actor,
    acts.filter((a) => !GONE.has(a.status)),
  );
  const points: ValuePoint[] = acts
    .filter((a) => !GONE.has(a.status))
    .map((a) => {
      const i = ins.find((x) => x.id === a.insightId)!;
      const units = reach(a.targetUnitIds);
      const neededDeps = deps
        .map((d) => ({ d, c: cs.find((c) => c.id === d.commitmentId) }))
        .filter(({ d, c }) => c && units.has(d.downstreamUnitId))
        .map(({ d, c }) => ({ d, c: c!, st: dependencyStatus(d, c!, now) }))
        .filter(({ st }) => st !== "met" && st !== "cancelled");
      const needed = neededDeps.map((x) => x.st);
      // A conflict touches the action when one of the two colliding plans is owned by a unit the action acts on.
      // (Counting the response's owner department too flagged every action: each department is in some conflict.)
      const parties = new Set(a.targetUnitIds);
      const conflicts = ks.filter((k) =>
        [k.commitmentAId, k.commitmentBId].some((cid) => {
          const c = cs.find((x) => x.id === cid);
          return !!c && parties.has(c.ownerUnitId);
        }),
      );
      const inConflict = conflicts.length > 0;
      const name = (id: string) => unit.get(id)?.name ?? "—";
      const blockers: Blocker[] = [
        ...neededDeps
          .filter(({ st }) => st === "at_risk" || st === "blocked")
          .map(({ d, c, st }) => ({
            kind: "dependency" as const,
            waiting: name(d.downstreamUnitId),
            on: name(c.ownerUnitId),
            title: c.title,
            status: st,
          })),
        ...conflicts.map((k) => {
          const ca = cs.find((x) => x.id === k.commitmentAId);
          const cb = cs.find((x) => x.id === k.commitmentBId);
          return {
            kind: "conflict" as const,
            a: ca?.title ?? "—",
            b: cb?.title ?? "—",
            unitA: ca ? name(ca.ownerUnitId) : "—",
            unitB: cb ? name(cb.ownerUnitId) : "—",
            insightId: k.insightId,
          };
        }),
      ];
      const sameType = outs.filter(
        (o) => typeOf.get(o.actionId) === a.type && o.verdict && o.verdict !== "inconclusive",
      );
      const mine = allActs.filter((x) => x.owner === a.ownerUserId && !TERMINAL.has(x.status));
      const risk = executionRisk({
        dependencies: {
          open: needed.length,
          troubled: needed.filter((s) => s === "at_risk" || s === "blocked").length,
        },
        inConflict,
        pastOutcomes: { worked: sameType.filter((o) => o.verdict === "worked").length, judged: sameType.length },
        ownerItems: {
          open: mine.length,
          overdue: mine.filter((x) => x.dueAt && x.dueAt.getTime() < now.getTime()).length,
        },
      });
      const input = ((i.priorityBreakdown as { input?: Record<string, unknown> })?.input ?? {}) as Record<
        string,
        unknown
      >;
      const hours = (i.workstream === "risk" ? input.hoursToImpact : input.hoursToClose) as number | undefined;
      const cost = Number(a.estimatedCost);
      const impact = Number(a.expectedImpactIls ?? 0);
      return {
        actionId: a.id,
        insightId: i.id,
        workstream: i.workstream,
        title: a.title,
        insightTitle: i.title,
        band: i.priorityBand,
        status: a.status,
        cost,
        impact,
        impactBasis: a.impactBasis,
        net: impact - cost,
        risk,
        dueAt: a.dueAt,
        windowAt: typeof hours === "number" ? new Date(i.createdAt.getTime() + hours * 3_600_000) : null,
        daysToValue: a.dueAt ? Math.max(0, Math.ceil((a.dueAt.getTime() - now.getTime()) / 86_400_000)) : null,
        href: `/insights/${i.id}#action-${a.id}`,
        workflow: flows.get(a.id)!,
        blockers,
      };
    });
  return points.sort((x, y) => y.net - x.net);
}
