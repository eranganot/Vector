/** Phase 4 on the home dashboard (Eran, 2026-10-05): the unit's commitments, and its actions & outcomes. */
import Link from "next/link";
import type { api } from "@/application/facade";
import { CommitmentStatus, type CommitmentsView } from "./commitments";
import { Card, Pill, SectionTitle } from "./ui";

type ActionsView = Awaited<ReturnType<typeof api.actions>>;
type OutcomesView = Awaited<ReturnType<typeof api.outcomes>>;

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** What the unit has promised (overdue and soonest first) and what others promised it. */
export function CommitmentsSummary({ v, unitId }: { v: CommitmentsView; unitId?: string }) {
  // Overdue first, then the soonest due (the read model already splits ours from owed to us).
  const worstFirst = (cs: CommitmentsView["owe"]) =>
    [...cs].sort(
      (x, y) =>
        Number(y.status === "overdue") - Number(x.status === "overdue") || x.dueAt.getTime() - y.dueAt.getTime(),
    );
  const owe = worstFirst(v.owe);
  const owed = worstFirst(v.owed);
  const href = `/commitments${unitId ? `?unit=${unitId}` : ""}`;
  const rate = v.summary.onTimeRate;
  const Row = ({ c }: { c: (typeof owe)[number] }) => (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-2 text-[13px]">
      <span className="min-w-0">
        <span className="font-semibold">{c.title}</span>
        <span className="text-muted">
          {" "}
          · {c.ownerUnitName} · due {day(c.dueAt)}
          {c.atRiskDependents ? ` · ${c.atRiskDependents} waiting at risk` : ""}
        </span>
      </span>
      <CommitmentStatus c={c} />
    </li>
  );
  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <SectionTitle
        aside={
          <Link href={href} className="text-sm text-accent">
            All commitments →
          </Link>
        }
      >
        Commitments
      </SectionTitle>
      <div className="flex flex-wrap gap-2 text-xs">
        <Pill tone={v.summary.overdue ? "bad" : "good"}>{v.summary.overdue} overdue</Pill>
        <Pill>{v.summary.open} open</Pill>
        {rate !== null && (
          <Pill tone={rate >= 0.8 ? "good" : rate >= 0.6 ? "warn" : "bad"}>
            {Math.round(rate * 100)}% delivered on time
          </Pill>
        )}
        {v.summary.conflicts > 0 && <Pill tone="bad">{v.summary.conflicts} in conflict</Pill>}
      </div>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-muted">We owe · {owe.length}</span>
        {owe.length === 0 ? (
          <p className="py-2 text-[13px] text-muted">No open promises.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {owe.slice(0, 3).map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-muted">Owed to us · {owed.length}</span>
        {owed.length === 0 ? (
          <p className="py-2 text-[13px] text-muted">Nobody owes us anything open.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {owed.slice(0, 2).map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

const STATUS: Record<string, { label: string; tone: "neutral" | "strong" | "good" | "warn" | "bad" }> = {
  proposed: { label: "Waiting for the decision", tone: "neutral" },
  pending_approval: { label: "Waiting for approval", tone: "warn" },
  ready: { label: "Ready", tone: "strong" },
  executing: { label: "Executing", tone: "strong" },
  failed: { label: "Failed", tone: "bad" },
};

/** In flight, waiting, overdue, done; outcomes being measured or waiting for a lesson; the latest lesson. */
export function ActionsSummary({ a, o }: { a: ActionsView; o: OutcomesView }) {
  const soonest = [...a.actions]
    .sort(
      (x, y) =>
        Number(y.overdue) - Number(x.overdue) || (x.dueAt?.getTime() ?? Infinity) - (y.dueAt?.getTime() ?? Infinity),
    )
    .slice(0, 3);
  const lesson = o.reviewed[0];
  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <SectionTitle
        aside={
          <Link href="/actions" className="text-sm text-accent">
            Actions &amp; outcomes →
          </Link>
        }
      >
        Actions &amp; outcomes
      </SectionTitle>
      <div className="flex flex-wrap gap-2 text-xs">
        <Pill>{a.counts.open} in flight</Pill>
        <Pill tone={a.counts.approval ? "warn" : "neutral"}>{a.counts.approval} waiting for approval</Pill>
        <Pill tone={a.counts.overdue ? "bad" : "good"}>{a.counts.overdue} overdue</Pill>
        <Pill tone="good">{a.counts.done} done</Pill>
        {a.counts.failed > 0 && <Pill tone="bad">{a.counts.failed} failed</Pill>}
      </div>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-muted">Next due</span>
        {soonest.length === 0 ? (
          <p className="py-2 text-[13px] text-muted">No actions in flight.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {soonest.map((x) => (
              <li key={x.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-2 text-[13px]">
                <span className="min-w-0">
                  <Link href={`/insights/${x.insightId}`} className="font-semibold no-underline hover:underline">
                    {x.title}
                  </Link>
                  <span className={x.overdue ? "text-p1" : "text-muted"}>
                    {" "}
                    · {x.owner}
                    {x.dueAt ? ` · due ${day(x.dueAt)}` : ""}
                    {x.overdue ? " · overdue" : ""}
                  </span>
                </span>
                <Pill tone={STATUS[x.status]?.tone}>{STATUS[x.status]?.label ?? x.status}</Pill>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-1 border-t border-line pt-2 text-[13px]">
        <span>
          <span className="text-muted">Outcomes: </span>
          {o.observing.length} being measured · {o.toReview.length} waiting for a lesson · {o.reviewed.length} with a
          lesson
        </span>
        {lesson ? (
          <span>
            <span className="text-muted">Latest lesson: </span>“{lesson.lesson}”{" "}
            <span className="text-muted">({lesson.actionTitle})</span>
          </span>
        ) : (
          <span className="text-muted">No lesson recorded yet.</span>
        )}
      </div>
    </Card>
  );
}
