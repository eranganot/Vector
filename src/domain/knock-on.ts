/**
 * knock-on-v1 (plan v2, E4d; cross-department.md §7): how a delay in one department travels to the others, in days and
 * ₪. The graph is the Phase 4 one: commitments (nodes) and dependencies (edges: "unit X needs this by date D, ₪ a week
 * at stake"). An edge may end at another commitment (the chain goes on) or only at a unit (the end of the line).
 *
 * Rules:
 * - A node is ready on its completion date; if open, on its due date; if overdue, today at the earliest.
 * - A what-if delay adds days to one node's own date.
 * - Input arriving after the edge's need-by date pushes the downstream node by the same number of days
 *   (the need-by date is what keeps the downstream due date).
 * - Money: each late edge costs its ₪ a week × days late ÷ 7; a node with no outgoing edge costs its own ₪ a week the
 *   same way (no double counting: a node's own ₪ usually is the sum of what waits on it).
 * Pure: no clock, no I/O.
 */
export const KNOCK_ON_MODEL = "knock-on-v1";

const DAY = 86_400_000;
const daysBetween = (a: Date, b: Date) => Math.max(0, Math.ceil((b.getTime() - a.getTime()) / DAY));

export type FlowNode = {
  id: string;
  unitId: string;
  dueAt: Date;
  completedAt: Date | null;
  status: "open" | "overdue" | "done" | "cancelled";
  /** ₪ a week at stake while it is late. */
  weeklyIls: number;
};

export type FlowEdge = {
  id: string;
  from: string;
  /** The downstream commitment, when the chain goes on. */
  to: string | null;
  toUnitId: string;
  needBy: Date;
  weeklyIls: number;
};

export type NodeProjection = {
  readyAt: Date;
  /** Days after its own due date. */
  daysLate: number;
  /** Why it is late: its own date, or input from upstream (the edge that pushes it most). */
  cause: "on_time" | "own" | "upstream";
  pushedBy: string | null;
};

export type EdgeProjection = { readyAt: Date; daysLate: number; costIls: number };

export type KnockOn = {
  model: typeof KNOCK_ON_MODEL;
  nodes: Map<string, NodeProjection>;
  edges: Map<string, EdgeProjection>;
  /** ₪ lost through every late edge and every late end node. */
  totalIls: number;
  /** Units that receive something late. */
  lateUnitIds: string[];
  maxDaysLate: number;
};

export function knockOn(
  nodes: FlowNode[],
  edges: FlowEdge[],
  now: Date,
  whatIf?: { nodeId: string; days: number },
): KnockOn {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, NodeProjection>();
  const visiting = new Set<string>();

  const project = (id: string): NodeProjection => {
    const done = memo.get(id);
    if (done) return done;
    const n = byId.get(id)!;
    if (visiting.has(id)) return { readyAt: n.dueAt, daysLate: 0, cause: "on_time", pushedBy: null }; // cycle guard
    visiting.add(id);
    let own: Date;
    if (n.completedAt) own = n.completedAt;
    else {
      own =
        n.status === "overdue" || n.dueAt.getTime() < now.getTime()
          ? new Date(Math.max(now.getTime(), n.dueAt.getTime()))
          : n.dueAt;
      if (whatIf?.nodeId === id && whatIf.days > 0) own = new Date(own.getTime() + whatIf.days * DAY);
    }
    let ready = own;
    let cause: NodeProjection["cause"] = own.getTime() > n.dueAt.getTime() ? "own" : "on_time";
    let pushedBy: string | null = null;
    if (!n.completedAt)
      for (const e of edges.filter((x) => x.to === id && byId.has(x.from))) {
        const up = project(e.from);
        const slip = daysBetween(e.needBy, up.readyAt);
        const pushed = new Date(n.dueAt.getTime() + slip * DAY);
        if (slip > 0 && pushed.getTime() > ready.getTime()) {
          ready = pushed;
          cause = "upstream";
          pushedBy = e.id;
        }
      }
    const p = {
      readyAt: ready,
      daysLate: daysBetween(n.dueAt, ready),
      cause: ready.getTime() > n.dueAt.getTime() ? cause : "on_time",
      pushedBy,
    } as NodeProjection;
    visiting.delete(id);
    memo.set(id, p);
    return p;
  };

  const live = nodes.filter((n) => n.status !== "cancelled");
  for (const n of live) project(n.id);

  const edgeOut = new Map<string, EdgeProjection>();
  const lateUnits = new Set<string>();
  let total = 0;
  for (const e of edges) {
    const up = memo.get(e.from);
    if (!up) continue;
    const daysLate = daysBetween(e.needBy, up.readyAt);
    const costIls = Math.round((e.weeklyIls * daysLate) / 7);
    edgeOut.set(e.id, { readyAt: up.readyAt, daysLate, costIls });
    total += costIls;
    if (daysLate > 0) lateUnits.add(e.toUnitId);
  }
  for (const n of live) {
    if (edges.some((e) => e.from === n.id)) continue;
    const p = memo.get(n.id)!;
    total += Math.round((n.weeklyIls * p.daysLate) / 7);
  }
  return {
    model: KNOCK_ON_MODEL,
    nodes: memo,
    edges: edgeOut,
    totalIls: total,
    lateUnitIds: [...lateUnits],
    maxDaysLate: Math.max(
      0,
      ...[...memo.values()].map((p) => p.daysLate),
      ...[...edgeOut.values()].map((p) => p.daysLate),
    ),
  };
}

/** Depth of each node from the sources (0 = nothing upstream), for drawing the flow left to right. */
export function flowDepth(nodes: Pick<FlowNode, "id">[], edges: Pick<FlowEdge, "from" | "to">[]) {
  const depth = new Map<string, number>();
  const ids = new Set(nodes.map((n) => n.id));
  const d = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const ups = edges.filter((e) => e.to === id && ids.has(e.from)).map((e) => d(e.from, seen) + 1);
    const v = Math.max(0, ...ups);
    depth.set(id, v);
    return v;
  };
  for (const n of nodes) d(n.id);
  return depth;
}
