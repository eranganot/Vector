import Link from "next/link";
import { type ActionFilter, api } from "@/application/facade";
import { reviewOutcomeAction } from "../../actions";
import { Band, Card, Pill, SectionTitle, Simulated } from "../../_components/ui";
import { requireActor } from "../../_lib/session";

const FILTERS: { key: ActionFilter; label: string }[] = [
  { key: "open", label: "In flight" },
  { key: "approval", label: "Waiting for approval" },
  { key: "overdue", label: "Overdue" },
  { key: "mine", label: "Mine" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];
const STATUS: Record<string, { label: string; tone: "neutral" | "strong" | "good" | "warn" | "bad" }> = {
  proposed: { label: "Waiting for the decision", tone: "neutral" },
  pending_approval: { label: "Waiting for approval", tone: "warn" },
  ready: { label: "Ready", tone: "strong" },
  executing: { label: "Executing", tone: "strong" },
  executed: { label: "Done", tone: "good" },
  failed: { label: "Failed", tone: "bad" },
  rejected: { label: "Rejected", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
const VERDICT: Record<string, { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  worked: { label: "Worked", tone: "good" },
  partially_worked: { label: "Partly worked", tone: "warn" },
  did_not_work: { label: "Did not work", tone: "bad" },
  inconclusive: { label: "Inconclusive", tone: "neutral" },
};
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Actions & outcomes (Phase 4f): what is in flight and with whom, and whether what we did worked. */
export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ f?: string; tab?: string }> }) {
  const sp = await searchParams;
  const { actor } = await requireActor();
  const tab = sp.tab === "outcomes" ? "outcomes" : "actions";
  const filter = (FILTERS.find((x) => x.key === sp.f)?.key ?? "open") as ActionFilter;
  const [v, o] = await Promise.all([api.actions(actor, filter), api.outcomes(actor)]);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight">Actions &amp; outcomes</h1>
        <p className="text-sm text-muted">
          Every action in your scope, who owns it and where it stands; and whether what we did worked, with the lesson
          we kept.
        </p>
      </div>
      <nav aria-label="Actions or outcomes" className="flex gap-2">
        {[
          { key: "actions", label: `Actions · ${v.counts.open} in flight` },
          { key: "outcomes", label: `Outcomes & lessons · ${o.toReview.length} to review` },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.key === "actions" ? "/actions" : "/actions?tab=outcomes"}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm no-underline ${tab === t.key ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "actions" ? (
        <>
          <nav aria-label="Filter actions" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`/actions?f=${f.key}`}
                className={`rounded-full border px-3 py-1 text-xs no-underline ${filter === f.key ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}
              >
                {f.label} · {v.counts[f.key]}
              </Link>
            ))}
          </nav>
          {v.actions.length === 0 ? (
            <p className="text-sm text-muted">No actions here.</p>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[960px] table-fixed text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-line">
                    <th className="w-[44%] px-4 py-3 font-medium">Action</th>
                    <th className="w-[16%] px-4 py-3 font-medium">Owner</th>
                    <th className="w-[9%] px-4 py-3 font-medium">Due</th>
                    <th className="w-[10%] px-4 py-3 font-medium">Cost</th>
                    <th className="w-[21%] px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {v.actions.map((a) => (
                    <tr key={a.id} className="border-b border-line/60 align-top last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/insights/${a.insightId}`} className="font-semibold no-underline hover:underline">
                          {a.title}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                          <Band band={a.band} /> <span className="truncate">{a.insightTitle}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.owner}
                        <div className="text-xs text-muted">{a.department}</div>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 ${a.overdue ? "text-p1" : ""}`}>
                        {a.dueAt ? day(a.dueAt) : "—"}
                        {a.overdue && <div className="text-xs">overdue</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">₪{a.cost.toLocaleString("en-US")}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="flex items-center gap-2">
                          <Pill tone={STATUS[a.status]?.tone}>{STATUS[a.status]?.label ?? a.status}</Pill>
                          {a.status === "executed" && <Simulated />}
                          {a.revision > 1 && <span className="text-xs text-muted">rev {a.revision}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionTitle
              aside={
                <span className="text-xs text-muted">the evaluator gave a verdict; a person keeps the lesson</span>
              }
            >
              Waiting for a lesson · {o.toReview.length}
            </SectionTitle>
            {o.toReview.length === 0 && <p className="text-sm text-muted">No outcome is waiting for a review.</p>}
            {o.toReview.map((x) => (
              <Card key={x.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={VERDICT[x.verdict ?? ""]?.tone}>{VERDICT[x.verdict ?? ""]?.label ?? x.verdict}</Pill>
                  <Link href={`/insights/${x.insightId}`} className="font-semibold no-underline hover:underline">
                    {x.actionTitle}
                  </Link>
                </div>
                <p className="text-[13px] text-muted">
                  {x.kpi}: expected {x.expected} · {x.baseline?.toFixed(1)} → {x.observed?.toFixed(1)} ·{" "}
                  {x.units.join(", ")} · {day(x.windowStart)} → {day(x.windowEnd)}
                </p>
                {x.canReview && (
                  <form action={reviewOutcomeAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="insightId" value={x.insightId} />
                    <input type="hidden" name="outcomeId" value={x.id} />
                    <input
                      name="lesson"
                      required
                      minLength={3}
                      placeholder="What should we learn?"
                      className="field min-w-72 grow"
                    />
                    <button className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-ink">
                      Record lesson
                    </button>
                  </form>
                )}
              </Card>
            ))}
          </section>
          <section className="flex flex-col gap-3">
            <SectionTitle aside={<span className="text-xs text-muted">measured after execution</span>}>
              Being measured · {o.observing.length}
            </SectionTitle>
            {o.observing.length === 0 && <p className="text-sm text-muted">Nothing is being measured right now.</p>}
            <ul className="flex flex-col gap-2 text-sm">
              {o.observing.map((x) => (
                <li key={x.id}>
                  <Link href={`/insights/${x.insightId}`} className="font-semibold no-underline hover:underline">
                    {x.actionTitle}
                  </Link>{" "}
                  <span className="text-muted">
                    · {x.kpi} expected {x.expected} · window ends {day(x.windowEnd)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-3">
            <SectionTitle
              aside={<span className="text-xs text-muted">shown on the next insight of the same kind</span>}
            >
              Lessons · {o.reviewed.length}
            </SectionTitle>
            {o.reviewed.length === 0 && <p className="text-sm text-muted">No lessons recorded yet.</p>}
            {o.reviewed.map((x) => (
              <Card key={x.id} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Pill tone={VERDICT[x.verdict ?? ""]?.tone}>{VERDICT[x.verdict ?? ""]?.label ?? x.verdict}</Pill>
                  <span className="font-semibold">{x.actionTitle}</span>
                  <span className="text-xs text-muted">{x.actionType.replaceAll("_", " ")}</span>
                </div>
                <p className="text-[15px]">“{x.lesson}”</p>
                <Link href={`/insights/${x.insightId}`} className="text-xs text-accent">
                  {x.insightTitle} →
                </Link>
              </Card>
            ))}
          </section>
        </>
      )}
    </>
  );
}
