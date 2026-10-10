import Link from "next/link";
import { notFound } from "next/navigation";
import { demoNow } from "@/application/facade";
import { api } from "@/app/_lib/api";
import {
  CommitmentCard,
  DependenciesCard,
  RecordCommitmentForm,
  type CommitmentItem,
} from "../../_components/commitments";
import { ils, MoneyHeader } from "../../_components/money-header";
import { Notice, SectionTitle } from "../../_components/ui";
import { getT } from "../../_lib/locale";
import { requireActor } from "../../_lib/session";

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
        {title} · <span className="num">{items.length}</span>
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
  const t = await getT();
  const DONE: Record<string, string> = {
    recorded: t("Commitment recorded. No conflict with other units' plans."),
    conflict: t("Commitment recorded, and it collides with another unit's plan: VECTOR raised a conflict insight."),
    completed: t("Marked delivered."),
    renegotiated: t("Date moved. The teams waiting on it see the change and your reason."),
    cancelled: t("Commitment cancelled."),
  };
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
        <h1 className="text-[28px] font-semibold tracking-tight">
          {t("Commitments · {unit}", { unit: v.scope.name })}
        </h1>
        <p className="text-sm text-muted">
          {t(
            "Promises between units, from meetings and plans: who owes what to whom, by when, and who is waiting on it. Overdue promises that matter become insights; plans that collide become conflicts.",
          )}
        </p>
      </div>
      <MoneyHeader
        label={t("Money")}
        figures={[
          {
            icon: "₪",
            label: t("a week riding on open commitments"),
            value: ils(v.money.open),
            hint: t("₪ a week at stake if late, summed over open and overdue commitments owed by or to {unit}", {
              unit: v.scope.name,
            }),
            tone: "accent",
          },
          {
            icon: "!",
            label: t("of which overdue"),
            value: ils(v.money.overdue),
            hint: t("₪ a week at stake on commitments past their due date"),
            tone: v.money.overdue ? "bad" : "good",
          },
          {
            icon: "✓",
            label: t("delivered this month"),
            value: ils(v.money.deliveredThisMonth),
            hint: t("₪ a week secured by commitments delivered since the 1st"),
            tone: "good",
          },
          {
            icon: "%",
            label: t("on time"),
            value: v.summary.onTimeRate === null ? "—" : `${Math.round(v.summary.onTimeRate * 100)}%`,
            hint: t("Commitments delivered by their due date"),
            tone: "muted",
          },
        ]}
      />
      <Notice error={sp.error} done={sp.done && sp.done !== "conflict" ? DONE[sp.done] : undefined} />
      {sp.done === "conflict" && sp.insight && UUID.test(sp.insight) && (
        <p role="status" className="rounded-md border border-p1 bg-p1/10 px-4 py-3 text-sm">
          {DONE.conflict}{" "}
          <Link href={`/insights/${sp.insight}`} className="font-semibold text-accent">
            {t("See the conflict →")}
          </Link>
        </p>
      )}
      {!sp.unit && <RecordCommitmentForm options={options} now={now} />}
      <DependenciesCard v={v} unitId={sp.unit} />
      <Section
        title={t("Overdue")}
        aside={t("past the due date, not delivered")}
        items={v.overdue}
        empty={t("Nothing overdue.")}
      />
      <Section
        title={t("{unit} owes", { unit: v.scope.name })}
        aside={t("open, soonest first")}
        items={v.owe.filter((c) => !overdueIds.has(c.id))}
        empty={t("No open commitments.")}
      />
      <Section
        title={t("Owed to {unit}", { unit: v.scope.name })}
        aside={t("other units' promises you depend on")}
        items={v.owed.filter((c) => !overdueIds.has(c.id))}
        empty={t("No other unit owes you anything open.")}
      />
      <Section title={t("Recently delivered")} items={v.delivered} empty={t("Nothing delivered yet.")} />
    </>
  );
}
