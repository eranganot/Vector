import Link from "next/link";
import type { api } from "@/application/facade";
import { Band, Card, Pill, SectionTitle } from "./ui";

type Approvals = Awaited<ReturnType<typeof api.myApprovals>>;
type Decisions = Awaited<ReturnType<typeof api.myDecisions>>;
type Actions = Awaited<ReturnType<typeof api.myActions>>;

const KIND_STYLE: Record<string, string> = { Decide: "text-accent", Approve: "text-warn", Do: "text-good" };

/**
 * What the signed-in person must act on: decisions to make, approvals to give, and the tasks they own
 * (Eran, 2026-10-04: "actions I need to take" on every home). Compact; the full list is Waiting on you.
 */
export function WaitingCard({
  approvals,
  decisions,
  actions = [],
  max = 5,
  showEmpty = false,
  bandOf = {},
}: {
  approvals: Approvals;
  decisions: Decisions;
  actions?: Actions;
  max?: number;
  showEmpty?: boolean;
  /** The band this viewer sees for an insight (local priority on a unit view); falls back to the group band. */
  bandOf?: Record<string, string>;
}) {
  const rows = [
    ...decisions.map((d) => ({
      key: d.decisionId,
      kind: "Decide",
      band: bandOf[d.insightId] ?? d.band,
      title: d.title,
      href: `/insights/${d.insightId}`,
      note: "accept or decline VECTOR's recommendation",
    })),
    ...approvals.map((a) => ({
      key: a.approval.id,
      kind: "Approve",
      band: bandOf[a.insightId] ?? a.band,
      title: a.action.title,
      href: "/approvals",
      note: a.insightTitle,
    })),
    ...actions.map((a) => ({
      key: a.action.id,
      kind: "Do",
      band: bandOf[a.insightId] ?? a.band,
      title: a.action.title,
      href: `/insights/${a.insightId}`,
      note:
        a.action.status === "pending_approval"
          ? `your task · waiting for approval${a.waitingOn.length ? ` by ${a.waitingOn.join(", ")}` : ""}`
          : `your task · ${a.action.status.replace("_", " ")}${a.action.dueAt ? ` · due ${a.action.dueAt.toISOString().slice(5, 10)}` : ""}`,
    })),
  ];
  const total = rows.length;
  if (total === 0 && !showEmpty) return null;
  const counts = (["Decide", "Approve", "Do"] as const)
    .map((k) => ({ k, n: rows.filter((r) => r.kind === k).length }))
    .filter((c) => c.n > 0);
  return (
    <Card className={total ? "border-accent/50 shadow-[0_0_24px_rgb(34_211_238/0.08)]" : ""}>
      <SectionTitle
        aside={
          total > 0 && (
            <Link href="/approvals" className="text-sm text-accent">
              All {total} →
            </Link>
          )
        }
      >
        Waiting on you · {total}
      </SectionTitle>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing needs your decision or approval, and you own no open task.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            {counts
              .map((c) =>
                c.k === "Decide"
                  ? `${c.n} decision${c.n === 1 ? "" : "s"}`
                  : c.k === "Approve"
                    ? `${c.n} approval${c.n === 1 ? "" : "s"}`
                    : `${c.n} task${c.n === 1 ? "" : "s"} you own`,
              )
              .join(" · ")}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {rows.slice(0, max).map((r) => (
              <li key={r.key} className="grid grid-cols-[auto_4.5rem_minmax(0,1fr)] items-baseline gap-x-3 text-sm">
                <Band band={r.band} />
                <span className={`text-xs uppercase tracking-wide ${KIND_STYLE[r.kind]}`}>{r.kind}</span>
                <span className="min-w-0">
                  <Link href={r.href} className="font-semibold no-underline hover:underline">
                    {r.title}
                  </Link>
                  <span className="ml-2 text-xs text-muted">{r.note}</span>
                </span>
              </li>
            ))}
          </ul>
          {total > max && <p className="mt-2 text-xs text-muted">+{total - max} more in Waiting on you</p>}
        </>
      )}
    </Card>
  );
}

type Dep = {
  id: string;
  title: string;
  status: string;
  owner: string;
  department: string;
  departmentId: string | null;
  insightId: string | null;
  overdue: boolean;
};

/** Open work in this scope, by the department that owns it: who everyone is waiting on. */
export function DependencySummary({ items, title = "Dependencies" }: { items: Dep[]; title?: string }) {
  const by = new Map<string, { id: string | null; name: string; open: number; approval: number; overdue: number }>();
  for (const a of items) {
    const row = by.get(a.department) ?? { id: a.departmentId, name: a.department, open: 0, approval: 0, overdue: 0 };
    row.open++;
    if (a.status === "pending_approval") row.approval++;
    if (a.overdue) row.overdue++;
    by.set(a.department, row);
  }
  const rows = [...by.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  return (
    <Card className="min-w-0">
      <SectionTitle aside={<span className="text-xs text-muted">by owning department</span>}>
        {title} · {items.length}
      </SectionTitle>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No open actions here.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-line/60">
          {rows.map((r) => (
            <li key={r.name} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              {r.id ? (
                <Link href={`/units/${r.id}`} className="font-semibold no-underline hover:underline">
                  {r.name}
                </Link>
              ) : (
                <span className="font-semibold">{r.name}</span>
              )}
              <span className="text-muted">
                {r.open} open action{r.open === 1 ? "" : "s"}
              </span>
              <span className="ml-auto flex gap-2">
                {r.approval > 0 && <Pill tone="warn">{r.approval} awaiting approval</Pill>}
                {r.overdue > 0 && <Pill tone="bad">{r.overdue} overdue</Pill>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
