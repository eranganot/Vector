/**
 * Read models for commitments, dependencies and conflicts (Phase 4). Scope: a person sees a commitment when one of
 * their read scopes is in its visible units (owner, beneficiaries, dependents and their ancestors). Dependency status,
 * cascades and bottlenecks are derived here from the domain functions (Q4); nothing is stored.
 */
import { eq } from "drizzle-orm";
import {
  bottlenecks,
  type CommitmentEffect,
  dependencyStatus,
  type DependencyStatus,
  onTimeRate,
} from "@/domain/commitments";
import { authorizeUser, canRead } from "@/domain/policy/authorize";
import type { Actor } from "@/domain/types";
import { commitment, conflict, demoClock, dependency, insight, orgUnit, roleAssignment, user } from "@/infra/db/schema";
import { toDepFacts, toFacts } from "../commands/commitments";
import type { DbOrTx } from "../db";
import { canReadUnit, positionOf } from "./performance";

const DAY = 86_400_000;

export type DependencyView = {
  id: string;
  commitmentId: string;
  commitmentTitle: string;
  ownerUnitId: string;
  ownerUnitName: string;
  downstreamUnitId: string;
  downstreamUnitName: string;
  downstreamCommitmentTitle: string | null;
  needBy: Date;
  impactIls: number;
  note: string;
  status: DependencyStatus;
};

/**
 * Everything about commitments the viewer may see, relative to `unitId` (default: their position unit):
 * what the unit owes, what is owed to it, what is overdue, conflicts, dependencies both ways, bottlenecks.
 */
export async function commitmentsView(db: DbOrTx, orgId: string, actor: Actor, unitId?: string) {
  const [units, cs, ds, ks, people, ins] = await Promise.all([
    db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    db.select().from(commitment).where(eq(commitment.orgId, orgId)),
    db.select().from(dependency).where(eq(dependency.orgId, orgId)),
    db.select().from(conflict).where(eq(conflict.orgId, orgId)),
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.orgId, orgId)),
    db
      .select({
        id: insight.id,
        title: insight.title,
        band: insight.priorityBand,
        status: insight.status,
        visibleUnitIds: insight.visibleUnitIds,
      })
      .from(insight)
      .where(eq(insight.orgId, orgId)),
  ]);
  const scope = unitId ? units.find((u) => u.id === unitId) : positionOf(actor, units)?.unit;
  if (!scope || !canReadUnit(actor, scope)) return null;
  const now = await nowOf(db, orgId);
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "—";
  const unitById = (id: string) => units.find((u) => u.id === id);
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "—";
  /** A unit is "ours" when it is the scope unit or inside it. */
  const ours = (id: string) => !!unitById(id)?.pathIds.includes(scope.id);
  /** A dependency touches us when the waiting unit is ours, or an ancestor of ours (a region waits; its branches feel it). */
  const touchesUs = (id: string) => ours(id) || scope.pathIds.includes(id);

  const visible = cs.filter((c) => canRead(actor, c.visibleUnitIds));
  const visibleIds = new Set(visible.map((c) => c.id));
  const facts = cs.map(toFacts);
  const depFacts = ds.map(toDepFacts);
  const statusOf = (d: (typeof ds)[number]) => {
    const c = cs.find((x) => x.id === d.commitmentId)!;
    return dependencyStatus(d, toFacts(c), now);
  };
  const depView = (d: (typeof ds)[number]): DependencyView => {
    const c = cs.find((x) => x.id === d.commitmentId)!;
    return {
      id: d.id,
      commitmentId: c.id,
      commitmentTitle: c.title,
      ownerUnitId: c.ownerUnitId,
      ownerUnitName: unitName(c.ownerUnitId),
      downstreamUnitId: d.downstreamUnitId,
      downstreamUnitName: unitName(d.downstreamUnitId),
      downstreamCommitmentTitle: d.downstreamCommitmentId
        ? (cs.find((x) => x.id === d.downstreamCommitmentId)?.title ?? null)
        : null,
      needBy: d.needBy,
      impactIls: Number(d.impactIls),
      note: d.note,
      status: statusOf(d),
    };
  };

  const item = (c: (typeof cs)[number]) => {
    const deps = ds.filter((d) => d.commitmentId === c.id).map(depView);
    const conflicts = ks
      .filter((k) => k.status === "open" && (k.commitmentAId === c.id || k.commitmentBId === c.id))
      .map((k) => {
        const otherId = k.commitmentAId === c.id ? k.commitmentBId : k.commitmentAId;
        const other = cs.find((x) => x.id === otherId)!;
        return {
          id: k.id,
          resource: k.resource,
          overlap: `${k.overlapStart} → ${k.overlapEnd}`,
          insightId: k.insightId,
          other: { id: other.id, title: other.title, unitName: unitName(other.ownerUnitId) },
        };
      });
    const linked = c.insightId ? ins.find((i) => i.id === c.insightId) : undefined;
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      owner: personName(c.ownerUserId),
      ownerUserId: c.ownerUserId,
      ownerUnitId: c.ownerUnitId,
      ownerUnitName: unitName(c.ownerUnitId),
      beneficiaries: c.beneficiaryUnitIds.map(unitName),
      source: c.source,
      madeAt: c.madeAt,
      dueAt: c.dueAt,
      completedAt: c.completedAt,
      late: c.status === "done" && !!c.completedAt && c.completedAt.getTime() > c.dueAt.getTime(),
      daysToDue: Math.round((c.dueAt.getTime() - now.getTime()) / DAY),
      impactIls: Number(c.impactIls),
      compliance: c.compliance,
      effects: c.effects as CommitmentEffect[],
      history: c.history as { from: string; to: string; by: string; at: string; rationale: string }[],
      rationale: c.rationale,
      // Cosmetic (the command re-checks): may the viewer complete, renegotiate or cancel it?
      // Shown to the owner and the owning unit's own managers (not every ancestor, to keep the CEO's view clean).
      canUpdate:
        actor.kind === "user" &&
        (actor.userId === c.ownerUserId || actor.assignments.some((x) => x.unit.id === c.ownerUnitId)) &&
        authorizeUser(actor, "commitment.update", {
          targetUnits: [
            { id: c.ownerUnitId, type: unitById(c.ownerUnitId)!.type, pathIds: unitById(c.ownerUnitId)!.pathIds },
          ],
        }).ok &&
        (c.status === "open" || c.status === "overdue"),
      // Q3 (Eran, 2026-10-05): the owner and the level above (the parent unit's managers) may move the due date.
      canRenegotiate:
        actor.kind === "user" &&
        (c.status === "open" || c.status === "overdue") &&
        (actor.userId === c.ownerUserId ||
          actor.assignments.some(
            (x) => x.unit.id === c.ownerUnitId || x.unit.id === unitById(c.ownerUnitId)!.pathIds.at(-2),
          )) &&
        authorizeUser(actor, "commitment.update", {
          targetUnits: [
            { id: c.ownerUnitId, type: unitById(c.ownerUnitId)!.type, pathIds: unitById(c.ownerUnitId)!.pathIds },
          ],
        }).ok,
      // Only an insight the viewer may read is linked (out of scope looks missing).
      insight:
        linked && canRead(actor, linked.visibleUnitIds)
          ? { id: linked.id, title: linked.title, band: linked.band, status: linked.status }
          : null,
      dependents: deps,
      atRiskDependents: deps.filter((d) => d.status === "at_risk" || d.status === "blocked").length,
      conflicts,
    };
  };

  const list = visible.map(item).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const live = (s: string) => s === "open" || s === "overdue";
  const owe = list.filter((c) => ours(c.ownerUnitId));
  const owed = list.filter(
    (c) =>
      !ours(c.ownerUnitId) &&
      (cs.find((x) => x.id === c.id)!.beneficiaryUnitIds.some(touchesUs) ||
        ds.some((d) => d.commitmentId === c.id && touchesUs(d.downstreamUnitId))),
  );
  const scopeFacts = facts.filter((c) => visibleIds.has(c.id) && ours(c.ownerUnitId));

  const waitingOn = ds
    .filter(
      (d) =>
        visibleIds.has(d.commitmentId) &&
        touchesUs(d.downstreamUnitId) &&
        !ours(cs.find((x) => x.id === d.commitmentId)!.ownerUnitId),
    )
    .map(depView);
  const waitingOnUs = ds
    .filter(
      (d) =>
        visibleIds.has(d.commitmentId) &&
        ours(cs.find((x) => x.id === d.commitmentId)!.ownerUnitId) &&
        !ours(d.downstreamUnitId),
    )
    .map(depView);
  // Inside the scope (e.g. the group): dependencies between our own units.
  const internal = ds
    .filter(
      (d) =>
        visibleIds.has(d.commitmentId) &&
        ours(cs.find((x) => x.id === d.commitmentId)!.ownerUnitId) &&
        ours(d.downstreamUnitId),
    )
    .map(depView);

  const scopeCommitmentIds = new Set(scopeFacts.map((c) => c.id));
  const bn = bottlenecks(
    facts.filter((c) => visibleIds.has(c.id)),
    depFacts.filter(
      (d) =>
        visibleIds.has(d.commitmentId) && (scopeCommitmentIds.has(d.commitmentId) || touchesUs(d.downstreamUnitId)),
    ),
    now,
  ).map((b) => ({ ...b, unitName: unitName(b.unitId) }));

  return {
    scope: { id: scope.id, name: scope.name, type: scope.type },
    now,
    summary: {
      open: scopeFacts.filter((c) => c.status === "open").length,
      overdue: scopeFacts.filter((c) => c.status === "overdue").length,
      done: scopeFacts.filter((c) => c.status === "done").length,
      onTimeRate: onTimeRate(scopeFacts, now),
      conflicts: ks.filter(
        (k) =>
          k.status === "open" && (scopeCommitmentIds.has(k.commitmentAId) || scopeCommitmentIds.has(k.commitmentBId)),
      ).length,
    },
    overdue: list.filter((c) => c.status === "overdue" && (ours(c.ownerUnitId) || owed.some((o) => o.id === c.id))),
    owe: owe.filter((c) => live(c.status)),
    owed: owed.filter((c) => live(c.status)),
    delivered: list
      .filter((c) => c.status === "done" && (ours(c.ownerUnitId) || owed.some((o) => o.id === c.id)))
      .slice(-8)
      .reverse(),
    cancelled: list.filter((c) => c.status === "cancelled" && ours(c.ownerUnitId)),
    /** Every commitment the viewer may read (for traces). */
    all: list,
    waitingOn,
    waitingOnUs,
    internal,
    bottlenecks: bn,
  };
}

async function nowOf(db: DbOrTx, orgId: string) {
  const [row] = await db.select().from(demoClock).where(eq(demoClock.orgId, orgId));
  return row?.now ?? new Date();
}

/** The commitments and conflicts behind one insight (for its trace), filtered to what the viewer may read. */
export async function commitmentsForInsight(db: DbOrTx, orgId: string, actor: Actor, insightId: string) {
  const v = await commitmentsView(db, orgId, actor);
  if (!v) return null;
  const byId = new Map(v.all.map((c) => [c.id, c]));
  const rows = await db.select().from(commitment).where(eq(commitment.insightId, insightId));
  const ks = await db.select().from(conflict).where(eq(conflict.insightId, insightId));
  const ids = new Set([...rows.map((r) => r.id), ...ks.flatMap((k) => [k.commitmentAId, k.commitmentBId])]);
  return {
    commitments: [...ids].map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c),
    conflicts: await Promise.all(
      ks.map(async (k) => ({
        id: k.id,
        resource: k.resource,
        overlap: `${k.overlapStart} → ${k.overlapEnd}`,
        status: k.status,
        resolvedReason: k.resolvedReason,
        escalatedAt: k.escalatedAt,
        escalatedTo: k.escalatedToUnitId
          ? ((await db.select({ name: orgUnit.name }).from(orgUnit).where(eq(orgUnit.id, k.escalatedToUnitId)))[0]
              ?.name ?? null)
          : null,
        a: k.commitmentAId,
        b: k.commitmentBId,
      })),
    ),
  };
}

/** People and units the viewer can record a commitment for (owner choices in the form). */
export async function commitmentFormOptions(db: DbOrTx, orgId: string, actor: Actor) {
  if (actor.kind !== "user") return { units: [], people: [], allUnits: [] };
  const units = await db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId));
  const roles = await db
    .select({ userId: roleAssignment.userId, unitId: roleAssignment.orgUnitId, name: user.name, title: user.title })
    .from(roleAssignment)
    .innerJoin(user, eq(user.id, roleAssignment.userId))
    .where(eq(roleAssignment.orgId, orgId));
  const recordScopes = actor.assignments.filter((a) =>
    ["executive", "department_manager", "regional_manager"].includes(a.role),
  );
  const mine = units.filter((u) => recordScopes.some((a) => u.pathIds.includes(a.unit.id)) && u.type !== "group");
  const people = roles
    .filter((r) => mine.some((u) => u.id === r.unitId))
    .map((r) => ({ id: r.userId, name: r.name, title: r.title, unitId: r.unitId }));
  return {
    units: mine.map((u) => ({ id: u.id, name: u.name, type: u.type })).sort((a, b) => a.name.localeCompare(b.name)),
    people,
    allUnits: units.filter((u) => u.type !== "branch").map((u) => ({ id: u.id, name: u.name, type: u.type })),
  };
}
