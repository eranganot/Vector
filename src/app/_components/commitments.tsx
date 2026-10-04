/** Commitments, dependencies and conflicts in the UI (Phase 4). No data access here. */
import Link from "next/link";
import type { api } from "@/application/facade";
import {
  cancelCommitmentAction,
  completeCommitmentAction,
  recordCommitmentAction,
  renegotiateCommitmentAction,
} from "../actions";
import { Band, Card, fmtIls, Pill, SectionTitle } from "./ui";
import { getLocale } from "../_lib/locale";
import { intlOf, type Locale } from "@/i18n/locale";
import { makeT } from "@/i18n/t";

export type CommitmentsView = NonNullable<Awaited<ReturnType<typeof api.commitments>>>;
export type CommitmentItem = CommitmentsView["owe"][number];
type Dep = CommitmentsView["waitingOn"][number];
type FormOptions = Awaited<ReturnType<typeof api.commitmentFormOptions>>;

const whenIn = (l: Locale) => (d: Date) =>
  d.toLocaleString(intlOf(l), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const dayIn = (l: Locale) => (d: Date) =>
  d.toLocaleDateString(intlOf(l), { day: "numeric", month: "short", timeZone: "UTC" });
const local = (d: Date) => d.toISOString().slice(0, 16);

export async function CommitmentStatus({ c }: { c: Pick<CommitmentItem, "status" | "daysToDue" | "late"> }) {
  const t = makeT(await getLocale());
  if (c.status === "overdue") {
    const n = Math.max(1, -c.daysToDue);
    return <Pill tone="bad">{-c.daysToDue === 1 ? t("{n} day overdue", { n }) : t("{n} days overdue", { n })}</Pill>;
  }
  if (c.status === "done") return <Pill tone="good">{c.late ? t("Delivered late") : t("Delivered on time")}</Pill>;
  if (c.status === "cancelled") return <Pill>{t("Cancelled")}</Pill>;
  return (
    <Pill tone={c.daysToDue <= 1 ? "warn" : "neutral"}>
      {c.daysToDue <= 0
        ? t("Due today")
        : c.daysToDue === 1
          ? t("Due in {n} day", { n: c.daysToDue })
          : t("Due in {n} days", { n: c.daysToDue })}
    </Pill>
  );
}

const DEP: Record<string, { label: string; tone: "neutral" | "good" | "warn" | "bad" }> = {
  met: { label: "Met", tone: "good" },
  waiting: { label: "Waiting", tone: "neutral" },
  at_risk: { label: "At risk", tone: "warn" },
  blocked: { label: "Blocked", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
export async function DepStatus({ s }: { s: string }) {
  const t = makeT(await getLocale());
  return <Pill tone={DEP[s]?.tone}>{DEP[s] ? t(DEP[s].label) : s}</Pill>;
}

/** One commitment: what, who, when, who waits on it, what it collides with, and the owner's actions. */
export async function CommitmentCard({ c }: { c: CommitmentItem }) {
  const locale = await getLocale();
  const t = makeT(locale);
  const fmtWhen = whenIn(locale);
  const fmtDay = dayIn(locale);
  return (
    <article aria-label={t("Commitment: {title}", { title: c.title })} className="min-w-0">
      <Card className="flex h-full min-w-0 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[15px] font-semibold leading-snug">{c.title}</span>
            <span className="text-xs text-muted">
              <span className="text-accent">{c.ownerUnitName}</span> · {c.owner} · {c.source}
            </span>
          </div>
          <CommitmentStatus c={c} />
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-muted">{t("Due")}</dt>
          <dd>
            <span className="num">{fmtWhen(c.dueAt)}</span>
            {c.completedAt && (
              <span className="text-muted"> · {t("delivered {date}", { date: fmtWhen(c.completedAt) })}</span>
            )}
          </dd>
          {c.beneficiaries.length > 0 && (
            <>
              <dt className="text-muted">{t("Owed to")}</dt>
              <dd>{c.beneficiaries.join(", ")}</dd>
            </>
          )}
          {c.impactIls > 0 && (
            <>
              <dt className="text-muted">{t("If late")}</dt>
              <dd>
                {t("{money}/week at stake", { money: fmtIls(c.impactIls) })}
                {c.compliance >= 0.6 ? ` · ${t("compliance exposure")}` : ""}
              </dd>
            </>
          )}
          {c.effects.length > 0 && (
            <>
              <dt className="text-muted">{t("Affects")}</dt>
              <dd className="font-mono text-xs">
                {c.effects
                  .map((e) => `${t(e.effect.replace("_", " "))} ${e.resource} (${e.windowStart} → ${e.windowEnd})`)
                  .join(" · ")}
              </dd>
            </>
          )}
        </dl>
        {c.dependents.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-line pt-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              {t("Waiting on it · {n}", { n: c.dependents.length })}
            </span>
            <ul className="flex flex-col gap-1 text-[13px]">
              {c.dependents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <DepStatus s={d.status} />
                  <span className="font-semibold">{d.downstreamUnitName}</span>
                  <span className="text-muted">{t("needs it by {date}", { date: fmtWhen(d.needBy) })}</span>
                  <span className="min-w-0 text-muted">· {d.downstreamCommitmentTitle ?? d.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {c.conflicts.map((k) => (
          <p key={k.id} className="rounded-md border border-p1/60 bg-p1/10 px-3 py-2 text-[13px]">
            <span className="font-semibold text-p1">{t("Conflict")}</span>{" "}
            {(() => {
              // {resource} is left unfilled so it can be rendered in its monospace span wherever the language puts it.
              const [before, after = ""] = t("with {unit}'s “{title}” on {resource} ({overlap}).", {
                unit: k.other.unitName,
                title: k.other.title,
                overlap: k.overlap,
              }).split("{resource}");
              return (
                <>
                  {before}
                  <span className="font-mono text-xs">{k.resource}</span>
                  {after}
                </>
              );
            })()}{" "}
            {k.insightId && (
              <Link href={`/insights/${k.insightId}`} className="text-accent">
                {t("See the insight →")}
              </Link>
            )}
          </p>
        ))}
        {c.insight && c.conflicts.length === 0 && (
          <Link
            href={`/insights/${c.insight.id}`}
            className="flex items-center gap-2 text-[13px] text-ink no-underline hover:underline"
          >
            <Band band={c.insight.band} />
            <span className="truncate">{c.insight.title}</span>
          </Link>
        )}
        {c.history.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs text-muted">
            {c.history.map((h, n) => (
              <li key={n}>
                {t("Date moved {from} → {to}: {why}", {
                  from: fmtDay(new Date(h.from)),
                  to: fmtDay(new Date(h.to)),
                  why: h.rationale,
                })}
              </li>
            ))}
          </ul>
        )}
        {(c.canUpdate || c.canRenegotiate) && (
          <div className="flex flex-wrap items-start gap-2 border-t border-line pt-3">
            {c.canUpdate && (
              <form action={completeCommitmentAction}>
                <input type="hidden" name="commitmentId" value={c.id} />
                <button className="rounded-lg bg-good px-3 py-1.5 text-sm font-semibold text-ground">
                  {t("Mark delivered")}
                </button>
              </form>
            )}
            <details className="group">
              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-soft">
                {t("Move the date")}
              </summary>
              <form action={renegotiateCommitmentAction} className="mt-2 flex flex-col gap-2 text-sm">
                <input type="hidden" name="commitmentId" value={c.id} />
                <label className="flex flex-col gap-1">
                  {t("New due date (UTC)")}
                  <input type="datetime-local" name="dueAt" defaultValue={local(c.dueAt)} required className="field" />
                </label>
                {c.effects.length > 0 && (
                  <div className="flex gap-2">
                    <label className="flex flex-col gap-1">
                      {t("Window from")}
                      <input type="date" name="windowStart" defaultValue={c.effects[0].windowStart} className="field" />
                    </label>
                    <label className="flex flex-col gap-1">
                      {t("to")}
                      <input type="date" name="windowEnd" defaultValue={c.effects[0].windowEnd} className="field" />
                    </label>
                  </div>
                )}
                <label className="flex flex-col gap-1">
                  {t("Why (the teams waiting on it will see this)")}
                  <input name="rationale" required minLength={3} className="field" />
                </label>
                <button className="self-start rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-ink">
                  {t("Move the date")}
                </button>
              </form>
            </details>
            {c.canUpdate && (
              <details>
                <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-soft">
                  {t("Cancel")}
                </summary>
                <form action={cancelCommitmentAction} className="mt-2 flex flex-col gap-2 text-sm">
                  <input type="hidden" name="commitmentId" value={c.id} />
                  <label className="flex flex-col gap-1">
                    {t("Why")}
                    <input name="rationale" required minLength={3} className="field" />
                  </label>
                  <button className="self-start rounded-lg border border-p1 px-3 py-1.5 font-semibold text-p1">
                    {t("Cancel the commitment")}
                  </button>
                </form>
              </details>
            )}
          </div>
        )}
      </Card>
    </article>
  );
}

/** Record a commitment made in a meeting (C1). The conflict rules run as soon as it is saved. */
export async function RecordCommitmentForm({ options, now }: { options: FormOptions; now: Date }) {
  const t = makeT(await getLocale());
  if (options.units.length === 0) return null;
  const due = new Date(now.getTime() + 3 * 86_400_000);
  return (
    <details className="rounded-xl border border-line bg-panel/60 p-4 open:shadow-[0_0_24px_rgb(34_211_238/0.06)]">
      <summary className="cursor-pointer list-none text-sm font-semibold text-accent">
        {t("+ Record a commitment")}
      </summary>
      <form action={recordCommitmentAction} className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          {t("What was promised")}
          <input
            name="title"
            required
            minLength={5}
            maxLength={200}
            className="field"
            placeholder={t("e.g. Weekend dairy discount in South")}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t("Owning unit")}
          <select name="ownerUnitId" required className="field">
            {options.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t("Owner")}
          <select name="ownerUserId" required className="field">
            {options.people.map((p) => (
              <option key={`${p.id}-${p.unitId}`} value={p.id}>
                {p.name} · {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t("Due (UTC)")}
          <input type="datetime-local" name="dueAt" required defaultValue={local(due)} className="field" />
        </label>
        <label className="flex flex-col gap-1">
          {t("Where it was promised")}
          <input name="source" required defaultValue={t("Weekly ops meeting")} className="field" />
        </label>
        <label className="flex flex-col gap-1">
          {t("Owed to (hold Ctrl/⌘ for several)")}
          <select name="beneficiaryUnitIds" multiple size={4} className="field">
            {options.allUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t("₪ per week at stake if late")}
          <input type="number" name="impactIls" min={0} step={1000} defaultValue={0} className="field" />
        </label>
        <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3 md:col-span-2">
          <legend className="px-1 text-xs text-muted">
            {t("Optional: what it changes (the conflict rules check it)")}
          </legend>
          <div className="grid gap-2 md:grid-cols-4">
            <input name="resource" className="field" placeholder={t("resource, e.g. sku-set:south-dairy-6")} />
            <select name="effect" className="field" defaultValue="">
              <option value="">{t("effect…")}</option>
              <option value="promote">{t("promote")}</option>
              <option value="delist">{t("delist")}</option>
              <option value="spend">{t("spend")}</option>
              <option value="freeze_spend">{t("freeze spend")}</option>
              <option value="cutover">{t("cut over")}</option>
              <option value="peak_trading">{t("peak trading")}</option>
            </select>
            <input type="date" name="windowStart" className="field" aria-label={t("window start")} />
            <input type="date" name="windowEnd" className="field" aria-label={t("window end")} />
          </div>
        </fieldset>
        <button className="self-start rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink md:col-span-2 md:justify-self-start">
          {t("Record commitment")}
        </button>
      </form>
    </details>
  );
}

async function DepRow({ d }: { d: Dep }) {
  const locale = await getLocale();
  const t = makeT(locale);
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 py-2 text-[13px]">
      <DepStatus s={d.status} />
      <span className="min-w-0">
        <span className="font-semibold">{d.downstreamUnitName}</span>
        <span className="text-muted"> {t("waits on")} </span>
        <span className="font-semibold">{d.ownerUnitName}</span>
        <span className="text-muted">
          {" "}
          · {d.commitmentTitle} · {t("needed by {date}", { date: dayIn(locale)(d.needBy) })}
        </span>
      </span>
    </li>
  );
}

const rank: Record<string, number> = { blocked: 0, at_risk: 1, waiting: 2, met: 3, cancelled: 4 };
const worstFirst = (ds: Dep[]) =>
  [...ds].sort((a, b) => rank[a.status] - rank[b.status] || a.needBy.getTime() - b.needBy.getTime());

/** The dashboard's Dependencies card: real dependencies on commitments (who we wait on, who waits on us). */
export async function DependenciesCard({ v, unitId }: { v: CommitmentsView; unitId?: string }) {
  const t = makeT(await getLocale());
  const up = worstFirst(v.waitingOn).filter((d) => d.status !== "met" && d.status !== "cancelled");
  const down = worstFirst(v.waitingOnUs).filter((d) => d.status !== "met" && d.status !== "cancelled");
  const internal = worstFirst(v.internal).filter((d) => d.status === "at_risk" || d.status === "blocked");
  const trouble = (ds: Dep[]) => ds.filter((d) => d.status === "at_risk" || d.status === "blocked").length;
  const href = `/commitments${unitId ? `?unit=${unitId}` : ""}`;
  const rate = v.summary.onTimeRate;
  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <SectionTitle
        aside={
          <Link href={href} className="text-sm text-accent">
            {t("Commitments →")}
          </Link>
        }
      >
        {t("Dependencies")}
      </SectionTitle>
      <div className="flex flex-wrap gap-2 text-xs">
        <Pill tone={v.summary.overdue ? "bad" : "good"}>{t("{n} overdue", { n: v.summary.overdue })}</Pill>
        <Pill>{t("{n} open", { n: v.summary.open })}</Pill>
        {rate !== null && (
          <Pill tone={rate >= 0.8 ? "good" : rate >= 0.6 ? "warn" : "bad"}>
            {t("{pct}% on time", { pct: Math.round(rate * 100) })}
          </Pill>
        )}
        {v.summary.conflicts > 0 && (
          <Pill tone="bad">
            {v.summary.conflicts === 1
              ? t("{n} conflict", { n: v.summary.conflicts })
              : t("{n} conflicts", { n: v.summary.conflicts })}
          </Pill>
        )}
      </div>
      {v.bottlenecks.length > 0 && (v.scope.type === "group" || v.scope.type === "region") && (
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted">{t("Bottlenecks")}</span>
          <ul className="flex flex-col gap-1 text-[13px]">
            {v.bottlenecks.slice(0, 3).map((b) => (
              <li key={b.unitId} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{b.unitName}</span>
                <span className="text-muted">
                  {b.blocked
                    ? t("{blocked} blocked · {atRisk} at risk · {money}/week waiting", {
                        blocked: b.blocked,
                        atRisk: b.atRisk,
                        money: fmtIls(b.impactIls),
                      })
                    : t("{atRisk} at risk · {money}/week waiting", { atRisk: b.atRisk, money: fmtIls(b.impactIls) })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {v.scope.type === "group" ? (
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted">
            {t("In trouble · {n}", { n: internal.length })}
          </span>
          {internal.length === 0 ? (
            <p className="py-2 text-[13px] text-muted">{t("No dependency is at risk or blocked.")}</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {internal.slice(0, 5).map((d) => (
                <DepRow key={d.id} d={d} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-muted">
              {t("We're waiting on · {n}", { n: up.length })}
              {trouble(up) ? ` · ${t("{n} in trouble", { n: trouble(up) })}` : ""}
            </span>
            {up.length === 0 ? (
              <p className="py-2 text-[13px] text-muted">{t("Nothing outstanding from other units.")}</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {up.slice(0, 4).map((d) => (
                  <DepRow key={d.id} d={d} />
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-muted">
              {t("Waiting on us · {n}", { n: down.length + internal.length })}
              {trouble(down) + internal.length
                ? ` · ${t("{n} in trouble", { n: trouble(down) + internal.length })}`
                : ""}
            </span>
            {down.length + internal.length === 0 ? (
              <p className="py-2 text-[13px] text-muted">{t("No other unit is waiting on us.")}</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {[...internal, ...down].slice(0, 4).map((d) => (
                  <DepRow key={d.id} d={d} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
