/**
 * The Action Center read model (plan v2, E4; action-center.md §2–§3, layout v3). A queue of what can become an action
 * now, ranked by ₪ × urgency × level, with one button each; and for the selected item: the facts, who is involved,
 * the steps, what VECTOR will do on approval, the suggested message (action-suggest-v1) with whom it goes to and why,
 * and the history. Built on the existing lifecycle: nothing here writes.
 */
import { and, arrayOverlaps, eq, inArray } from "drizzle-orm";
import { commonAncestor } from "@/domain/commitments";
import type { ApprovalRequirement } from "@/domain/policy/approval-rules";
import { authorizeUser } from "@/domain/policy/authorize";
import { hasPermission } from "@/domain/policy/permissions";
import { suggestMessage, type SuggestedMessage } from "@/domain/suggest";
import type { Actor } from "@/domain/types";
import { heContent } from "@/i18n/content";
import {
  action,
  approval,
  commitment,
  conflict,
  decision,
  demoClock,
  initiative,
  insight,
  kpi,
  orgUnit,
  outboundMessage,
  roleAssignment,
  user,
} from "@/infra/db/schema";
import { requirementFor } from "../commands/lifecycle";
import { toUnitRef } from "../context";
import type { DbOrTx } from "../db";
import { PLAYBOOKS } from "../playbooks";
import { auditTrailForInsight, peopleWithAssignments, readScope, routeApproval } from "./insights";

const LIVE = (s: string) => s !== "cancelled" && s !== "rejected";
const URGENT_HOURS = 72;
const SOON_HOURS = 168;

export type QueueItem = {
  insightId: string;
  workstream: string;
  title: string;
  band: string;
  /** ₪ a week at stake (risk) or upside (opportunity). */
  ils: number;
  hoursLeft: number | null;
  owner: string;
  due: string | null;
  score: number;
  /** The one button: approve & send (you may decide), approve (an approval routed to you), resolve (a conflict), open. */
  button: "approve_send" | "approve" | "resolve" | "open";
  kind: "risk" | "opportunity" | "conflict";
  href?: string;
};

/** Why VECTOR picked a person: owns a step, heads the owning or an affected department, sponsors a linked initiative. */
export type Reason = { kind: "owns" | "head" | "affected" | "sponsor"; of: string };
export type Person = { id: string; name: string; reason: Reason };

export async function actionCenter(
  db: DbOrTx,
  orgId: string,
  actor: Actor,
  opts: { insightId?: string; locale: "en" | "he" },
) {
  if (actor.kind !== "user") return null;
  const scope = readScope(actor);
  if (scope.length === 0) return null;
  const [units, [clock], ins, people, roles, users, ks, cs, inits, msgs] = await Promise.all([
    db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    db.select().from(demoClock).where(eq(demoClock.orgId, orgId)),
    db
      .select()
      .from(insight)
      .where(and(eq(insight.orgId, orgId), arrayOverlaps(insight.visibleUnitIds, scope))),
    peopleWithAssignments(db, orgId),
    db.select().from(roleAssignment).where(eq(roleAssignment.orgId, orgId)),
    db.select({ id: user.id, name: user.name, title: user.title }).from(user).where(eq(user.orgId, orgId)),
    db
      .select()
      .from(conflict)
      .where(and(eq(conflict.orgId, orgId), eq(conflict.status, "open"))),
    db.select().from(commitment).where(eq(commitment.orgId, orgId)),
    db
      .select()
      .from(initiative)
      .where(and(eq(initiative.orgId, orgId), arrayOverlaps(initiative.visibleUnitIds, scope))),
    db
      .select()
      .from(outboundMessage)
      .where(and(eq(outboundMessage.orgId, orgId), arrayOverlaps(outboundMessage.visibleUnitIds, scope))),
  ]);
  const now = clock?.now ?? new Date();
  const me = actor.userId;
  const unit = new Map(units.map((u) => [u.id, u]));
  const unitName = (id: string | null | undefined) => (id ? (unit.get(id)?.name ?? "—") : "—");
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "—";
  const live = ins.filter((i) => i.status === "open" || i.status === "acknowledged");
  const ids = live.map((i) => i.id);
  const [decs, acts, reqs] = ids.length
    ? await Promise.all([
        db.select().from(decision).where(inArray(decision.insightId, ids)),
        db.select().from(action).where(inArray(action.insightId, ids)),
        db
          .select()
          .from(approval)
          .where(and(eq(approval.orgId, orgId), eq(approval.status, "requested"))),
      ])
    : [[], [], []];

  const input = (i: (typeof ins)[number]) =>
    ((i.priorityBreakdown as { input?: Record<string, unknown> })?.input ?? {}) as Record<string, unknown>;
  const weekly = (i: (typeof ins)[number]) =>
    Number((i.workstream === "risk" ? input(i).impactIls : input(i).valueIls) ?? 0);
  const hoursLeft = (i: (typeof ins)[number]) => {
    const h = (i.workstream === "risk" ? input(i).hoursToImpact : input(i).hoursToClose) as number | undefined;
    return typeof h === "number" ? Math.round(h - (now.getTime() - i.createdAt.getTime()) / 3_600_000) : null;
  };
  const urgency = (h: number | null) =>
    h !== null && h <= URGENT_HOURS ? 1.5 : h !== null && h <= SOON_HOURS ? 1.2 : 1;
  const canDecide = (i: (typeof ins)[number]) => {
    const u = unit.get(i.primaryUnitId);
    return !!u && authorizeUser(actor, "decision.decide", { targetUnits: [toUnitRef(u)] }).ok;
  };
  /** Accountable deciders: managers of the primary unit, else of the nearest unit above with one. */
  const decidersOf = (i: (typeof ins)[number]) => {
    for (const u of [...(unit.get(i.primaryUnitId)?.pathIds ?? [])].reverse()) {
      const found = [...people.entries()]
        .filter(([, p]) => p.assignments.some((a) => a.unit.id === u && hasPermission(a.role, "decision.decide")))
        .map(([id]) => id);
      if (found.length) return found;
    }
    return [];
  };
  const routedTo = (actId: string) => {
    const r = reqs.find((x) => x.actionId === actId);
    const a = acts.find((x) => x.id === actId);
    return r && a ? routeApproval(people, r.requirement as ApprovalRequirement, a).map(([id]) => id) : [];
  };

  // ── Queue ──
  const queue: QueueItem[] = [];
  for (const i of live) {
    const d = decs.find((x) => x.insightId === i.id);
    const mine = acts.filter((a) => a.insightId === i.id && LIVE(a.status));
    if (mine.length === 0) continue;
    const waitingOnMe = mine.some((a) => a.status === "pending_approval" && routedTo(a.id).includes(me));
    const open = d?.status === "recommended";
    if (!open && !waitingOnMe) continue;
    const may = open && canDecide(i);
    const accountable = open && decidersOf(i).includes(me);
    const first = [...mine].sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))[0];
    const h = hoursLeft(i);
    queue.push({
      insightId: i.id,
      workstream: i.workstream,
      title: i.title,
      band: i.priorityBand,
      ils: weekly(i),
      hoursLeft: h,
      owner: nameOf(first.ownerUserId),
      due: first.dueAt ? first.dueAt.toISOString().slice(0, 10) : null,
      score: Math.round(weekly(i) * urgency(h) * (accountable || waitingOnMe ? 1.5 : 1)),
      button: waitingOnMe ? "approve" : may ? "approve_send" : "open",
      kind: i.workstream === "opportunity" ? "opportunity" : "risk",
    });
  }
  // Conflicts the viewer is the common manager of (G4-Q Q1).
  const myUnits = new Set(
    actor.assignments.filter((a) => hasPermission(a.role, "decision.decide")).map((a) => a.unit.id),
  );
  for (const k of ks) {
    const a = cs.find((c) => c.id === k.commitmentAId);
    const b = cs.find((c) => c.id === k.commitmentBId);
    const pa = a && unit.get(a.ownerUnitId)?.pathIds;
    const pb = b && unit.get(b.ownerUnitId)?.pathIds;
    const common = pa && pb ? commonAncestor(pa, pb) : null;
    if (!common || !myUnits.has(common) || !k.insightId) continue;
    const i = ins.find((x) => x.id === k.insightId);
    if (!i || queue.some((q) => q.insightId === i.id)) continue;
    queue.push({
      insightId: i.id,
      workstream: i.workstream,
      title: i.title,
      band: i.priorityBand,
      ils: weekly(i) || Number(a?.impactIls ?? 0) + Number(b?.impactIls ?? 0),
      hoursLeft: hoursLeft(i),
      owner: `${unitName(a!.ownerUnitId)} ↔ ${unitName(b!.ownerUnitId)}`,
      due: k.overlapStart,
      score: Math.round((weekly(i) || 1) * urgency(hoursLeft(i)) * 1.5),
      button: "resolve",
      kind: "conflict",
      href: `/insights/${i.id}`,
    });
  }
  queue.sort((a, b) => b.score - a.score);

  // ── Selected item ──
  const sel = live.find((i) => i.id === (opts.insightId ?? queue[0]?.insightId)) ?? null;
  const detail = sel ? await selectedDetail(sel) : null;

  async function selectedDetail(i: (typeof ins)[number]) {
    const d = decs.find((x) => x.insightId === i.id) ?? null;
    const mine = acts.filter((a) => a.insightId === i.id && LIVE(a.status));
    const heads = (unitId: string) =>
      roles.filter((r) => r.orgUnitId === unitId && r.isHead && r.role === "department_manager").map((r) => r.userId);
    const deptOf = (userId: string) => {
      const as = people.get(userId)?.assignments ?? [];
      const pick = as.find((a) => a.unit.type === "department") ?? as.find((a) => a.role !== "viewer") ?? as[0];
      return pick ? unit.get(pick.unit.id) : undefined;
    };
    const steps = await Promise.all(
      mine.map(async (a) => {
        const req: ApprovalRequirement =
          (a.approvalRequirement as ApprovalRequirement | null) ?? (await requirementFor(db, orgId, a, i));
        const routed =
          a.status === "pending_approval"
            ? routedTo(a.id)
            : req.required
              ? routeApproval(people, req, a).map(([id]) => id)
              : [];
        const pb = PLAYBOOKS[a.type];
        const k = pb?.outcome
          ? (
              await db
                .select()
                .from(kpi)
                .where(and(eq(kpi.orgId, orgId), eq(kpi.code, pb.outcome.kpiCode)))
            )[0]
          : undefined;
        return {
          id: a.id,
          title: a.title,
          type: a.type,
          status: a.status,
          cost: Number(a.estimatedCost),
          impact: Number(a.expectedImpactIls ?? 0),
          due: a.dueAt ? a.dueAt.toISOString().slice(0, 10) : null,
          owner: nameOf(a.ownerUserId),
          ownerId: a.ownerUserId,
          department: deptOf(a.ownerUserId)?.name ?? "—",
          departmentId: deptOf(a.ownerUserId)?.id ?? null,
          approval: req.required
            ? {
                rules: req.rules.filter((r) => r.matched).map((r) => r.rule),
                approvers: routed.map(nameOf),
                selfApproves: false,
                youMay: routed.includes(me),
              }
            : null,
          outcome: pb?.outcome && k ? { kpi: k.name, days: pb.outcome.windowDays } : null,
        };
      }),
    );
    // Who is involved: one node per department, with its part and status.
    const chain = [...new Map(steps.map((s) => [s.departmentId ?? s.department, s])).values()].map((s) => {
      const parts = steps.filter((x) => (x.departmentId ?? x.department) === (s.departmentId ?? s.department));
      const status = parts.some((x) => x.status === "pending_approval")
        ? "waiting"
        : parts.every((x) => x.status === "executed")
          ? "done"
          : parts.some((x) => x.status === "executing" || x.status === "ready" || x.status === "executed")
            ? "started"
            : "proposed";
      return { department: s.department, part: parts.map((x) => x.title), status };
    });
    // With whom: the owner of the first step (or the head of the owning unit), and the heads of affected departments
    // and the sponsor of a linked initiative, each with the reason they were picked.
    const firstOwner = steps[0]?.ownerId;
    const ownerHead = i.ownerDepartmentId ? heads(i.ownerDepartmentId)[0] : undefined;
    const to: Person | null = firstOwner
      ? { id: firstOwner, name: nameOf(firstOwner), reason: { kind: "owns", of: steps[0].title } }
      : ownerHead
        ? { id: ownerHead, name: nameOf(ownerHead), reason: { kind: "head", of: unitName(i.ownerDepartmentId) } }
        : null;
    const cc: Person[] = [];
    const add = (id: string | undefined, reason: Reason) => {
      if (id && id !== to?.id && id !== me && !cc.some((c) => c.id === id)) cc.push({ id, name: nameOf(id), reason });
    };
    for (const s of steps.slice(1)) add(s.ownerId, { kind: "owns", of: s.title });
    for (const u of i.affectedUnitIds.filter((x) => unit.get(x)?.type === "department"))
      add(heads(u)[0], { kind: "affected", of: unitName(u) });
    for (const it of inits.filter((x) => x.insightIds.includes(i.id)))
      add(it.sponsorUserId, { kind: "sponsor", of: it.title });
    const alternatives = [
      ...new Set([...(ownerHead ? [ownerHead] : []), ...steps.map((s) => s.ownerId), ...cc.map((c) => c.id)]),
    ]
      .filter((id) => id !== me)
      .map((id) => ({ id, name: nameOf(id) }));
    const approvers = [...new Set(steps.flatMap((s) => s.approval?.approvers ?? []))];
    const tr = (s: string) => (opts.locale === "he" ? (heContent(s) ?? s) : s);
    const first = (n: string) => tr(n).split(" ")[0];
    const message: SuggestedMessage | null = to
      ? suggestMessage({
          locale: opts.locale,
          to: first(to.name),
          from: first(nameOf(me)),
          workstream: i.workstream === "opportunity" ? "opportunity" : "risk",
          insightTitle: tr(i.title),
          steps: steps.map((s) => ({ title: tr(s.title), costIls: s.cost })),
          weeklyIls: weekly(i),
          due:
            steps
              .map((s) => s.due)
              .filter((x): x is string => !!x)
              .sort()[0] ?? null,
          // Approvals the viewer holds are granted by "Approve and send"; the message names the ones still to come.
          approvals: steps
            .filter((s) => s.approval && !s.approval.youMay && s.status !== "ready" && s.status !== "executed")
            .map((s) => ({ names: s.approval!.approvers.map(tr), costIls: s.cost })),
          informed: cc.map((c) => tr(c.name)),
        })
      : null;
    const trail = await auditTrailForInsight(db, orgId, i.id);
    return {
      id: i.id,
      title: i.title,
      workstream: i.workstream,
      band: i.priorityBand,
      score: i.priorityScore,
      what: i.whatHappened,
      why: i.whyItMatters,
      ils: weekly(i),
      hoursLeft: hoursLeft(i),
      ownerDepartment: unitName(i.ownerDepartmentId),
      decision: d ? { id: d.id, statement: d.statement, status: d.status } : null,
      canDecide: d?.status === "recommended" && canDecide(i),
      /** The viewer may approve-and-send: decide an open recommendation, or grant approvals routed to them. */
      canSend: (d?.status === "recommended" && canDecide(i)) || steps.some((x) => x.approval?.youMay),
      deciders: decidersOf(i).map(nameOf),
      steps,
      chain,
      to,
      cc,
      alternatives,
      approvers,
      message,
      messages: msgs
        .filter((m) => m.insightId === i.id)
        .map((m) => ({
          id: m.id,
          status: m.status,
          to: m.toUserIds.map(nameOf),
          cc: m.ccUserIds.map(nameOf),
          from: nameOf(m.fromUserId),
          subject: m.subject,
          body: m.body,
          sentAt: m.sentAt,
          approvedAt: m.approvedAt,
          edited: m.edited,
        })),
      history: trail.slice(-12).map((e) => ({
        at: e.occurredAt,
        operation: e.operation,
        actor: e.actorId.startsWith("system:") ? e.actorId : nameOf(e.actorId),
        toState: e.toState,
      })),
    };
  }

  const weekAgo = now.getTime() - 7 * 86_400_000;
  return {
    now,
    queue,
    selected: detail,
    sent: msgs
      .filter((m) => m.fromUserId === me || m.toUserIds.includes(me) || m.ccUserIds.includes(me))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map((m) => ({
        id: m.id,
        insightId: m.insightId,
        subject: m.subject,
        status: m.status,
        to: m.toUserIds.map(nameOf),
        from: nameOf(m.fromUserId),
        at: m.sentAt ?? m.approvedAt ?? m.createdAt,
        mine: m.fromUserId === me,
      })),
    money: {
      waiting: queue.filter((q) => q.kind !== "conflict").reduce((a, q) => a + q.ils, 0),
      awaitingApproval: acts
        .filter((a) => a.status === "pending_approval")
        .reduce((s, a) => s + Number(a.expectedImpactIls ?? 0), 0),
      sentThisWeek: msgs.filter((m) => m.status === "sent" && m.sentAt && m.sentAt.getTime() >= weekAgo).length,
      toAct: queue.filter((q) => q.button !== "open").length,
    },
  };
}

export type ActionCenterView = NonNullable<Awaited<ReturnType<typeof actionCenter>>>;

/** Messages sent to the viewer (in-app delivery, FB-8): for Waiting on you. */
export async function messagesForMe(db: DbOrTx, orgId: string, actor: Actor) {
  if (actor.kind !== "user") return [];
  const rows = await db
    .select()
    .from(outboundMessage)
    .where(and(eq(outboundMessage.orgId, orgId), eq(outboundMessage.status, "sent")));
  const mine = rows.filter((m) => m.toUserIds.includes(actor.userId) || m.ccUserIds.includes(actor.userId));
  if (!mine.length) return [];
  const people = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.orgId, orgId));
  return mine
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))
    .map((m) => ({
      id: m.id,
      insightId: m.insightId,
      subject: m.subject,
      body: m.body,
      from: people.find((p) => p.id === m.fromUserId)?.name ?? "—",
      sentAt: m.sentAt!,
      copy: !m.toUserIds.includes(actor.userId),
    }));
}
