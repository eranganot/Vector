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

export type CommitmentsView = NonNullable<Awaited<ReturnType<typeof api.commitments>>>;
export type CommitmentItem = CommitmentsView["owe"][number];
type Dep = CommitmentsView["waitingOn"][number];
type FormOptions = Awaited<ReturnType<typeof api.commitmentFormOptions>>;

const fmtWhen = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const local = (d: Date) => d.toISOString().slice(0, 16);

export function CommitmentStatus({ c }: { c: Pick<CommitmentItem, "status" | "daysToDue" | "late"> }) {
  if (c.status === "overdue")
    return (
      <Pill tone="bad">
        {Math.max(1, -c.daysToDue)} day{-c.daysToDue === 1 ? "" : "s"} overdue
      </Pill>
    );
  if (c.status === "done") return <Pill tone="good">{c.late ? "Delivered late" : "Delivered on time"}</Pill>;
  if (c.status === "cancelled") return <Pill>Cancelled</Pill>;
  return (
    <Pill tone={c.daysToDue <= 1 ? "warn" : "neutral"}>
      {c.daysToDue <= 0 ? "Due today" : `Due in ${c.daysToDue} day${c.daysToDue === 1 ? "" : "s"}`}
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
export const DepStatus = ({ s }: { s: string }) => <Pill tone={DEP[s]?.tone}>{DEP[s]?.label ?? s}</Pill>;

/** One commitment: what, who, when, who waits on it, what it collides with, and the owner's actions. */
export function CommitmentCard({ c }: { c: CommitmentItem }) {
  return (
    <article aria-label={`Commitment: ${c.title}`} className="min-w-0">
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
          <dt className="text-muted">Due</dt>
          <dd>
            {fmtWhen(c.dueAt)}
            {c.completedAt && <span className="text-muted"> · delivered {fmtWhen(c.completedAt)}</span>}
          </dd>
          {c.beneficiaries.length > 0 && (
            <>
              <dt className="text-muted">Owed to</dt>
              <dd>{c.beneficiaries.join(", ")}</dd>
            </>
          )}
          {c.impactIls > 0 && (
            <>
              <dt className="text-muted">If late</dt>
              <dd>
                {fmtIls(c.impactIls)}/week at stake{c.compliance >= 0.6 ? " · compliance exposure" : ""}
              </dd>
            </>
          )}
          {c.effects.length > 0 && (
            <>
              <dt className="text-muted">Affects</dt>
              <dd className="font-mono text-xs">
                {c.effects
                  .map((e) => `${e.effect.replace("_", " ")} ${e.resource} (${e.windowStart} → ${e.windowEnd})`)
                  .join(" · ")}
              </dd>
            </>
          )}
        </dl>
        {c.dependents.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-line pt-2">
            <span className="text-xs uppercase tracking-wide text-muted">Waiting on it · {c.dependents.length}</span>
            <ul className="flex flex-col gap-1 text-[13px]">
              {c.dependents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <DepStatus s={d.status} />
                  <span className="font-semibold">{d.downstreamUnitName}</span>
                  <span className="text-muted">needs it by {fmtWhen(d.needBy)}</span>
                  <span className="min-w-0 text-muted">· {d.downstreamCommitmentTitle ?? d.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {c.conflicts.map((k) => (
          <p key={k.id} className="rounded-md border border-p1/60 bg-p1/10 px-3 py-2 text-[13px]">
            <span className="font-semibold text-p1">Conflict</span> with {k.other.unitName}&apos;s “{k.other.title}” on{" "}
            <span className="font-mono text-xs">{k.resource}</span> ({k.overlap}).{" "}
            {k.insightId && (
              <Link href={`/insights/${k.insightId}`} className="text-accent">
                See the insight →
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
                Date moved {fmtDay(new Date(h.from))} → {fmtDay(new Date(h.to))}: {h.rationale}
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
                  Mark delivered
                </button>
              </form>
            )}
            <details className="group">
              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-soft">
                Move the date
              </summary>
              <form action={renegotiateCommitmentAction} className="mt-2 flex flex-col gap-2 text-sm">
                <input type="hidden" name="commitmentId" value={c.id} />
                <label className="flex flex-col gap-1">
                  New due date (UTC)
                  <input type="datetime-local" name="dueAt" defaultValue={local(c.dueAt)} required className="field" />
                </label>
                {c.effects.length > 0 && (
                  <div className="flex gap-2">
                    <label className="flex flex-col gap-1">
                      Window from
                      <input type="date" name="windowStart" defaultValue={c.effects[0].windowStart} className="field" />
                    </label>
                    <label className="flex flex-col gap-1">
                      to
                      <input type="date" name="windowEnd" defaultValue={c.effects[0].windowEnd} className="field" />
                    </label>
                  </div>
                )}
                <label className="flex flex-col gap-1">
                  Why (the teams waiting on it will see this)
                  <input name="rationale" required minLength={3} className="field" />
                </label>
                <button className="self-start rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-ink">
                  Move the date
                </button>
              </form>
            </details>
            {c.canUpdate && (
              <details>
                <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-soft">
                  Cancel
                </summary>
                <form action={cancelCommitmentAction} className="mt-2 flex flex-col gap-2 text-sm">
                  <input type="hidden" name="commitmentId" value={c.id} />
                  <label className="flex flex-col gap-1">
                    Why
                    <input name="rationale" required minLength={3} className="field" />
                  </label>
                  <button className="self-start rounded-lg border border-p1 px-3 py-1.5 font-semibold text-p1">
                    Cancel the commitment
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
export function RecordCommitmentForm({ options, now }: { options: FormOptions; now: Date }) {
  if (options.units.length === 0) return null;
  const due = new Date(now.getTime() + 3 * 86_400_000);
  return (
    <details className="rounded-xl border border-line bg-panel/60 p-4 open:shadow-[0_0_24px_rgb(34_211_238/0.06)]">
      <summary className="cursor-pointer list-none text-sm font-semibold text-accent">+ Record a commitment</summary>
      <form action={recordCommitmentAction} className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          What was promised
          <input
            name="title"
            required
            minLength={5}
            maxLength={200}
            className="field"
            placeholder="e.g. Weekend dairy discount in South"
          />
        </label>
        <label className="flex flex-col gap-1">
          Owning unit
          <select name="ownerUnitId" required className="field">
            {options.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Owner
          <select name="ownerUserId" required className="field">
            {options.people.map((p) => (
              <option key={`${p.id}-${p.unitId}`} value={p.id}>
                {p.name} · {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Due (UTC)
          <input type="datetime-local" name="dueAt" required defaultValue={local(due)} className="field" />
        </label>
        <label className="flex flex-col gap-1">
          Where it was promised
          <input name="source" required defaultValue="Weekly ops meeting" className="field" />
        </label>
        <label className="flex flex-col gap-1">
          Owed to (hold Ctrl/⌘ for several)
          <select name="beneficiaryUnitIds" multiple size={4} className="field">
            {options.allUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          ₪ per week at stake if late
          <input type="number" name="impactIls" min={0} step={1000} defaultValue={0} className="field" />
        </label>
        <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3 md:col-span-2">
          <legend className="px-1 text-xs text-muted">Optional: what it changes (the conflict rules check it)</legend>
          <div className="grid gap-2 md:grid-cols-4">
            <input name="resource" className="field" placeholder="resource, e.g. sku-set:south-dairy-6" />
            <select name="effect" className="field" defaultValue="">
              <option value="">effect…</option>
              <option value="promote">promote</option>
              <option value="delist">delist</option>
              <option value="spend">spend</option>
              <option value="freeze_spend">freeze spend</option>
              <option value="cutover">cut over</option>
              <option value="peak_trading">peak trading</option>
            </select>
            <input type="date" name="windowStart" className="field" aria-label="window start" />
            <input type="date" name="windowEnd" className="field" aria-label="window end" />
          </div>
        </fieldset>
        <button className="self-start rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink md:col-span-2 md:justify-self-start">
          Record commitment
        </button>
      </form>
    </details>
  );
}

function DepRow({ d }: { d: Dep }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 py-2 text-[13px]">
      <DepStatus s={d.status} />
      <span className="min-w-0">
        <span className="font-semibold">{d.downstreamUnitName}</span>
        <span className="text-muted"> waits on </span>
        <span className="font-semibold">{d.ownerUnitName}</span>
        <span className="text-muted">
          {" "}
          · {d.commitmentTitle} · needed by {fmtDay(d.needBy)}
        </span>
      </span>
    </li>
  );
}

const rank: Record<string, number> = { blocked: 0, at_risk: 1, waiting: 2, met: 3, cancelled: 4 };
const worstFirst = (ds: Dep[]) =>
  [...ds].sort((a, b) => rank[a.status] - rank[b.status] || a.needBy.getTime() - b.needBy.getTime());

/** The dashboard's Dependencies card: real dependencies on commitments (who we wait on, who waits on us). */
export function DependenciesCard({ v, unitId }: { v: CommitmentsView; unitId?: string }) {
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
            Commitments →
          </Link>
        }
      >
        Dependencies
      </SectionTitle>
      <div className="flex flex-wrap gap-2 text-xs">
        <Pill tone={v.summary.overdue ? "bad" : "good"}>{v.summary.overdue} overdue</Pill>
        <Pill>{v.summary.open} open</Pill>
        {rate !== null && (
          <Pill tone={rate >= 0.8 ? "good" : rate >= 0.6 ? "warn" : "bad"}>{Math.round(rate * 100)}% on time</Pill>
        )}
        {v.summary.conflicts > 0 && (
          <Pill tone="bad">
            {v.summary.conflicts} conflict{v.summary.conflicts === 1 ? "" : "s"}
          </Pill>
        )}
      </div>
      {v.bottlenecks.length > 0 && (v.scope.type === "group" || v.scope.type === "region") && (
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted">Bottlenecks</span>
          <ul className="flex flex-col gap-1 text-[13px]">
            {v.bottlenecks.slice(0, 3).map((b) => (
              <li key={b.unitId} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{b.unitName}</span>
                <span className="text-muted">
                  {b.blocked ? `${b.blocked} blocked · ` : ""}
                  {b.atRisk} at risk · {fmtIls(b.impactIls)}/week waiting
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {v.scope.type === "group" ? (
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted">In trouble · {internal.length}</span>
          {internal.length === 0 ? (
            <p className="py-2 text-[13px] text-muted">No dependency is at risk or blocked.</p>
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
              We&apos;re waiting on · {up.length}
              {trouble(up) ? ` · ${trouble(up)} in trouble` : ""}
            </span>
            {up.length === 0 ? (
              <p className="py-2 text-[13px] text-muted">Nothing outstanding from other units.</p>
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
              Waiting on us · {down.length + internal.length}
              {trouble(down) + internal.length ? ` · ${trouble(down) + internal.length} in trouble` : ""}
            </span>
            {down.length + internal.length === 0 ? (
              <p className="py-2 text-[13px] text-muted">No other unit is waiting on us.</p>
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
