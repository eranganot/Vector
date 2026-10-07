/**
 * Dependency flow (plan v2, E4d; cross-department.md §7) and the event → action plan (action-center.md §2): the
 * commitments around a starting set, the dependencies between them, and knock-on-v1's projection of how late each one
 * lands and what it costs, now and under a what-if delay. Read-only; only commitments the viewer may see are drawn.
 */
import { and, eq, inArray } from "drizzle-orm";
import { flowDepth, knockOn, type FlowEdge, type FlowNode } from "@/domain/knock-on";
import type { Actor } from "@/domain/types";
import { action, commitment, demoClock, dependency, orgUnit, user } from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { readScope } from "./insights";

const MAX_NODES = 24;
const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export type FlowState = "done" | "late" | "at_risk" | "due_soon" | "on_track";

async function load(db: DbOrTx, orgId: string, actor: Actor) {
  const scope = readScope(actor);
  const [units, [clock], cs, deps, people] = await Promise.all([
    db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    db.select().from(demoClock).where(eq(demoClock.orgId, orgId)),
    db.select().from(commitment).where(eq(commitment.orgId, orgId)),
    db.select().from(dependency).where(eq(dependency.orgId, orgId)),
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.orgId, orgId)),
  ]);
  const unit = new Map(units.map((u) => [u.id, u]));
  const visible = cs.filter(
    (c) =>
      c.status !== "cancelled" &&
      c.visibleUnitIds.some((v) => scope.includes(v) || unit.get(v)?.pathIds.some((p) => scope.includes(p))),
  );
  return { now: clock?.now ?? new Date(), unit, cs: visible, deps, people };
}

type Loaded = Awaited<ReturnType<typeof load>>;

function build(L: Loaded, seeds: string[], whatIf?: { nodeId: string; days: number }) {
  const { now, unit, cs, deps, people } = L;
  const byId = new Map(cs.map((c) => [c.id, c]));
  // Expand both ways along dependencies: what the seeds wait on, and everything down the line.
  const ids = new Set(seeds.filter((s) => byId.has(s)));
  const queue = [...ids];
  while (queue.length && ids.size < MAX_NODES) {
    const id = queue.shift()!;
    for (const d of deps) {
      const next =
        d.commitmentId === id ? d.downstreamCommitmentId : d.downstreamCommitmentId === id ? d.commitmentId : null;
      if (next && byId.has(next) && !ids.has(next)) {
        ids.add(next);
        queue.push(next);
      }
    }
  }
  const rows = [...ids].map((id) => byId.get(id)!);
  const nodes: FlowNode[] = rows.map((c) => ({
    id: c.id,
    unitId: c.ownerUnitId,
    dueAt: c.dueAt,
    completedAt: c.completedAt,
    status: c.status as FlowNode["status"],
    weeklyIls: Number(c.impactIls),
  }));
  const edgeRows = deps.filter(
    (d) => ids.has(d.commitmentId) && (!d.downstreamCommitmentId || ids.has(d.downstreamCommitmentId)),
  );
  const edges: FlowEdge[] = edgeRows.map((d) => ({
    id: d.id,
    from: d.commitmentId,
    to: d.downstreamCommitmentId,
    toUnitId: d.downstreamUnitId,
    needBy: d.needBy,
    weeklyIls: Number(d.impactIls),
  }));
  const base = knockOn(nodes, edges, now);
  const sim = whatIf && ids.has(whatIf.nodeId) ? knockOn(nodes, edges, now, whatIf) : null;
  const k = sim ?? base;
  // Units at the end of the line that need the same thing by the same date (the five regions) are drawn as one.
  const noteOf = (e: FlowEdge) => edgeRows.find((d) => d.id === e.id)!.note;
  const groupKey = (e: FlowEdge) => `${e.from}|${noteOf(e)}|${iso(e.needBy)}`;
  const groups = [...new Set(edges.filter((e) => !e.to).map(groupKey))];
  const leafId = (e: FlowEdge) => `end:${groups.indexOf(groupKey(e))}`;
  const depth = flowDepth(
    [...nodes, ...groups.map((_, n) => ({ id: `end:${n}` }))],
    edges.map((e) => ({ from: e.from, to: e.to ?? leafId(e) })),
  );
  const unitName = (id: string) => unit.get(id)?.name ?? "—";
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "—";
  const title = (id: string) => byId.get(id)?.title ?? "—";
  const stateOf = (c: (typeof rows)[number]): FlowState => {
    if (c.status === "done") return "done";
    const p = k.nodes.get(c.id)!;
    if (c.dueAt.getTime() < now.getTime() || (p.daysLate > 0 && p.cause === "own")) return "late";
    if (p.daysLate > 0) return "at_risk";
    if (c.dueAt.getTime() - now.getTime() <= 2 * DAY) return "due_soon";
    return "on_track";
  };
  return {
    now,
    whatIf: sim ? { nodeId: whatIf!.nodeId, title: title(whatIf!.nodeId), days: whatIf!.days } : null,
    summary: {
      totalIls: k.totalIls,
      baselineIls: base.totalIls,
      maxDaysLate: k.maxDaysLate,
      /** The most days late anything arrives at another department. */
      maxDownstreamDays: Math.max(0, ...[...k.edges.values()].map((p) => p.daysLate)),
      lateUnits: [...new Set(k.lateUnitIds.map(unitName))],
      departments: new Set([...rows.map((c) => c.ownerUnitId), ...edges.map((e) => e.toUnitId)]).size,
    },
    nodes: rows
      .map((c) => {
        const p = k.nodes.get(c.id)!;
        const b = base.nodes.get(c.id)!;
        const out = edges.filter((e) => e.from === c.id);
        return {
          id: c.id,
          title: c.title,
          detail: c.detail,
          source: c.source,
          unitId: c.ownerUnitId,
          unitName: unitName(c.ownerUnitId),
          owner: personName(c.ownerUserId),
          due: iso(c.dueAt),
          status: c.status,
          flowStatus: stateOf(c),
          depth: depth.get(c.id) ?? 0,
          /** ₪ a week at stake while it is late: its own figure, or what waits on it. */
          weeklyIls: Math.max(
            Number(c.impactIls),
            out.reduce((a, e) => a + e.weeklyIls, 0),
          ),
          insightId: c.insightId,
          readyAt: iso(p.readyAt),
          daysLate: p.daysLate,
          /** Days it slips under the what-if beyond today's projection. */
          extraDays: p.daysLate - b.daysLate,
          causeStatus: p.cause,
          pushedBy: p.pushedBy ? title(edges.find((e) => e.id === p.pushedBy)!.from) : null,
        };
      })
      .sort((a, b) => a.depth - b.depth || a.due.localeCompare(b.due)),
    /** The end of the line: units that need something but have no tracked commitment of their own downstream. */
    ends: groups.map((g, n) => {
      const es = edges.filter((e) => !e.to && groupKey(e) === g);
      const ps = es.map((e) => k.edges.get(e.id)!);
      return {
        id: `end:${n}`,
        unitNames: es.map((e) => unitName(e.toUnitId)),
        depth: depth.get(`end:${n}`) ?? 1,
        needBy: iso(es[0].needBy),
        weeklyIls: es.reduce((a, e) => a + e.weeklyIls, 0),
        daysLate: Math.max(...ps.map((p) => p.daysLate)),
        costIls: ps.reduce((a, p) => a + p.costIls, 0),
        note: noteOf(es[0]),
      };
    }),
    /** Arrows: one per downstream commitment, one per group at the end of the line. */
    edges: [...new Set(edges.map((e) => (e.to ? e.id : `${e.from}>${leafId(e)}`)))].map((key) => {
      const es = edges.filter((e) => (e.to ? e.id : `${e.from}>${leafId(e)}`) === key);
      const ps = es.map((e) => k.edges.get(e.id)!);
      const bs = es.map((e) => base.edges.get(e.id)!);
      const e = es[0];
      return {
        id: key,
        from: e.from,
        to: e.to ?? leafId(e),
        toUnitName: es.map((x) => unitName(x.toUnitId)).join(", "),
        needBy: iso(e.needBy),
        weeklyIls: es.reduce((a, x) => a + x.weeklyIls, 0),
        note: noteOf(e),
        daysLate: Math.max(...ps.map((p) => p.daysLate)),
        costIls: ps.reduce((a, p) => a + p.costIls, 0),
        extraIls: ps.reduce((a, p) => a + p.costIls, 0) - bs.reduce((a, p) => a + p.costIls, 0),
      };
    }),
    /** Late tasks whose lateness the slack downstream still absorbs. */
    lateWithinSlack: rows.filter((c) => c.status !== "done" && c.dueAt.getTime() < now.getTime()).length,
  };
}

/** The flow around a set of commitments (an initiative's), with an optional what-if delay on one of them. */
export async function dependencyFlow(
  db: DbOrTx,
  orgId: string,
  actor: Actor,
  seeds: string[],
  whatIf?: { nodeId: string; days: number },
) {
  if (actor.kind !== "user" || readScope(actor).length === 0) return null;
  const flow = build(await load(db, orgId, actor), seeds, whatIf);
  return flow.nodes.length ? flow : null;
}

export type DependencyFlow = NonNullable<Awaited<ReturnType<typeof dependencyFlow>>>;

/**
 * From event to action plan: the latest meeting or plan in scope that created two or more commitments. Each task says
 * what it is, who owns it, its state against the date, what waits on it and the ₪ of doing it late or not at all.
 */
export async function eventPlan(db: DbOrTx, orgId: string, actor: Actor) {
  if (actor.kind !== "user" || readScope(actor).length === 0) return null;
  const L = await load(db, orgId, actor);
  const sources = [...new Set(L.cs.map((c) => c.source))]
    .map((s) => {
      const of = L.cs.filter((c) => c.source === s);
      return { s, of, at: Math.max(...of.map((c) => c.madeAt.getTime())) };
    })
    .filter((x) => x.of.length >= 2)
    .sort((a, b) => b.at - a.at);
  const ev = sources[0];
  if (!ev) return null;
  const flow = build(
    L,
    ev.of.map((c) => c.id),
  );
  const insightIds = ev.of.map((c) => c.insightId).filter((x): x is string => !!x);
  const acts = insightIds.length
    ? await db
        .select({ insightId: action.insightId, cost: action.estimatedCost, status: action.status })
        .from(action)
        .where(and(eq(action.orgId, orgId), inArray(action.insightId, insightIds)))
    : [];
  const now = L.now;
  const tasks = ev.of
    .map((c) => {
      const n = flow.nodes.find((x) => x.id === c.id)!;
      const out = flow.edges.filter((e) => e.from === c.id);
      const waitsOn = flow.edges
        .filter((e) => e.to === c.id)
        .map((e) => flow.nodes.find((x) => x.id === e.from)!)
        .filter((u) => u && u.flowStatus !== "done");
      const overdueDays = c.status !== "done" ? Math.max(0, Math.floor((now.getTime() - c.dueAt.getTime()) / DAY)) : 0;
      const live = acts.filter(
        (a) => a.insightId === c.insightId && a.status !== "cancelled" && a.status !== "rejected",
      );
      return {
        ...n,
        overdueDays,
        daysLeft: c.status !== "done" ? Math.ceil((c.dueAt.getTime() - now.getTime()) / DAY) : null,
        /**
         * ₪ already lost: what waits on it, from each need-by date that has passed (a task late inside its slack costs
         * nothing yet); a task nothing waits on loses its own ₪ a week from its due date.
         */
        lostIls:
          c.status === "done"
            ? 0
            : out.length
              ? out.reduce(
                  (a, e) =>
                    a +
                    Math.round(
                      (e.weeklyIls * Math.max(0, Math.floor((now.getTime() - Date.parse(e.needBy)) / DAY))) / 7,
                    ),
                  0,
                )
              : Math.round((Number(c.impactIls) * overdueDays) / 7),
        /** Slack: days until the first need-by date of what waits on it (negative: already past). */
        slackDays: out.length
          ? Math.min(...out.map((e) => Math.floor((Date.parse(e.needBy) + DAY / 2 - now.getTime()) / DAY)))
          : null,
        /** If it slips one more week: extra ₪ down the line, and the departments that get it late. */
        weekLate: (() => {
          if (c.status === "done") return null;
          const w = build(L, [c.id], { nodeId: c.id, days: 7 });
          return { extraIls: w.summary.totalIls - w.summary.baselineIls, units: w.summary.lateUnits };
        })(),
        /** What it costs to do: the linked insight's actions, when there are any. */
        costIls: live.length ? live.reduce((a, x) => a + Number(x.cost), 0) : null,
        waiting: out.map((e) => ({
          unitName: e.toUnitName,
          what: e.to.startsWith("end:") ? e.note : (flow.nodes.find((x) => x.id === e.to)?.title ?? e.note),
          needBy: e.needBy,
          weeklyIls: e.weeklyIls,
          daysLate: e.daysLate,
          costIls: e.costIls,
        })),
        waitsOn: waitsOn.map((u) => ({ title: u.title, unitName: u.unitName, flowStatus: u.flowStatus })),
        /** ₪ of knock-on if it lands as projected (today, when it is late). */
        knockOnIls: out.reduce((a, e) => a + e.costIls, 0),
      };
    })
    .sort((a, b) => STATE_ORDER[a.flowStatus] - STATE_ORDER[b.flowStatus] || a.due.localeCompare(b.due));
  return {
    source: ev.s,
    madeAt: iso(new Date(ev.at)),
    tasks,
    counts: {
      late: tasks.filter((x) => x.flowStatus === "late").length,
      atRisk: tasks.filter((x) => x.flowStatus === "at_risk" || x.flowStatus === "due_soon").length,
      onTrack: tasks.filter((x) => x.flowStatus === "on_track").length,
      done: tasks.filter((x) => x.flowStatus === "done").length,
    },
    weeklyAtStake: tasks.filter((x) => x.flowStatus !== "done").reduce((a, x) => a + x.weeklyIls, 0),
    lostIls: tasks.reduce((a, x) => a + x.lostIls, 0),
    knockOnIls: flow.summary.totalIls,
    departments: new Set([
      ...ev.of.map((c) => c.ownerUnitId),
      ...L.deps.filter((d) => ev.of.some((c) => c.id === d.commitmentId)).map((d) => d.downstreamUnitId),
    ]).size,
  };
}

const STATE_ORDER: Record<FlowState, number> = { late: 0, at_risk: 1, due_soon: 2, on_track: 3, done: 4 };

export type EventPlan = NonNullable<Awaited<ReturnType<typeof eventPlan>>>;
