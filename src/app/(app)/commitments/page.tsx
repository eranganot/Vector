import Link from "next/link";
import { notFound } from "next/navigation";
import { api, demoNow } from "@/application/facade";
import {
  CommitmentCard,
  DependenciesCard,
  RecordCommitmentForm,
  type CommitmentItem,
} from "../../_components/commitments";
import { Notice, SectionTitle } from "../../_components/ui";
import { requireActor } from "../../_lib/session";

const DONE: Record<string, string> = {
  recorded: "Commitment recorded. No conflict with other units' plans.",
  conflict: "Commitment recorded, and it collides with another unit's plan: VECTOR raised a conflict insight.",
  completed: "Marked delivered.",
  renegotiated: "Date moved. The teams waiting on it see the change and your reason.",
  cancelled: "Commitment cancelled.",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Section({
  title,
  aside,
  items,
  empty,
}: {
  title: string;
  aside?: string;
  items: CommitmentItem[];
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle aside={aside ? <span className="text-xs text-muted">{aside}</span> : undefined}>
        {title} · {items.length}
      </SectionTitle>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((c) => (
            <CommitmentCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Commitments (Phase 4): what your unit promised, what others promised you, and who is waiting on whom. */
export default async function CommitmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; done?: string; error?: string; insight?: string }>;
}) {
  const sp = await searchParams;
  const { actor } = await requireActor();
  if (sp.unit && !UUID.test(sp.unit)) notFound();
  const [v, options, now] = await Promise.all([
    api.commitments(actor, sp.unit),
    api.commitmentFormOptions(actor),
    demoNow(),
  ]);
  if (!v) notFound(); // a unit outside your scope looks missing
  const overdueIds = new Set(v.overdue.map((c) => c.id));
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight">Commitments · {v.scope.name}</h1>
        <p className="text-sm text-muted">
          Promises between units, from meetings and plans: who owes what to whom, by when, and who is waiting on it.
          Overdue promises that matter become insights; plans that collide become conflicts.
        </p>
      </div>
      <Notice error={sp.error} done={sp.done && sp.done !== "conflict" ? DONE[sp.done] : undefined} />
      {sp.done === "conflict" && sp.insight && UUID.test(sp.insight) && (
        <p role="status" className="rounded-md border border-p1 bg-p1/10 px-4 py-3 text-sm">
          {DONE.conflict}{" "}
          <Link href={`/insights/${sp.insight}`} className="font-semibold text-accent">
            See the conflict →
          </Link>
        </p>
      )}
      {!sp.unit && <RecordCommitmentForm options={options} now={now} />}
      <DependenciesCard v={v} unitId={sp.unit} />
      <Section title="Overdue" aside="past the due date, not delivered" items={v.overdue} empty="Nothing overdue." />
      <Section
        title={`${v.scope.name} owes`}
        aside="open, soonest first"
        items={v.owe.filter((c) => !overdueIds.has(c.id))}
        empty="No open commitments."
      />
      <Section
        title={`Owed to ${v.scope.name}`}
        aside="other units' promises you depend on"
        items={v.owed.filter((c) => !overdueIds.has(c.id))}
        empty="No other unit owes you anything open."
      />
      <Section title="Recently delivered" items={v.delivered} empty="Nothing delivered yet." />
    </>
  );
}
