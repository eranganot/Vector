import { notFound } from "next/navigation";
import { api } from "@/app/_lib/api";
import type { ApprovalRequirement } from "@/domain/policy/approval-rules";
import { BANDS, OPPORTUNITY_BANDS, type PriorityBreakdown } from "@/domain/priority";
import {
  acceptDecisionAction,
  acknowledgeInsightAction,
  amendActionAction,
  cancelActionAction,
  declineDecisionAction,
  dismissInsightAction,
  retryActionAction,
  reviewOutcomeAction,
} from "../../../actions";
import { CommitmentCard } from "../../../_components/commitments";
import { BackLink, Band, Card, EvidenceChart, Notice, Pill, SectionTitle, Simulated } from "../../../_components/ui";
import { getLocale } from "../../../_lib/locale";
import { requireActor } from "../../../_lib/session";
import { intlOf } from "@/i18n/locale";
import { makeT, type T } from "@/i18n/t";

const ROLE_LABEL: Record<string, string> = {
  executive: "Executive",
  department_manager: "Department Manager",
  regional_manager: "Regional Manager",
  admin: "Admin",
  viewer: "Viewer",
};
const ACTION_STATUS: Record<string, string> = {
  proposed: "Proposed",
  pending_approval: "Pending approval",
  ready: "Ready",
  executing: "Executing",
  executed: "Executed",
  failed: "Failed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
const fmtTime = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
const SIGNAL_LABEL: Record<string, string> = {
  kpi_deviation: "KPI deviation",
  external_event: "external event",
  dependency_delay: "dependency delay",
  commitment_overdue: "overdue commitment",
  decision_conflict: "decision conflict",
  incident: "incident",
  facility_review: "facility review",
};
const sourceLabel = (t: T, g: string) =>
  g.startsWith("rule:")
    ? t("Rule-generated · {rule}", { rule: g.slice(5) })
    : g.startsWith("scenario-catalog")
      ? t("Scenario catalog · synthetic feed")
      : g.startsWith("commitment-monitor") || g.startsWith("conflict-rules")
        ? t("Rule-generated · {rule} · commitment register", { rule: g })
        : g;

/** Priority and opportunity factor names (keys of the stored breakdown). */
const FACTOR: Record<string, string> = {
  impact: "impact",
  breadth: "breadth",
  urgency: "urgency",
  magnitude: "magnitude",
  strategic: "strategic",
  compliance: "compliance",
  value: "value",
  window: "window",
  reach: "reach",
  ease: "ease",
};

export default async function TracePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { actor } = await requireActor();
  const locale = await getLocale();
  const t = makeT(locale);
  const trace = await api.trace(actor, id);
  if (!trace) notFound(); // out of scope looks exactly like missing (authorization.md §1)
  const [mayDecide, behind] = await Promise.all([
    api.canDecide(actor, id), // cosmetic; acceptDecision re-checks
    api.commitmentsForInsight(actor, id), // Phase 4: the promises and plans behind this insight
  ]);
  const lessons = await api.lessonsFor(actor, id); // Phase 4f: what we learned last time we did this
  const { insight: ins } = trace;
  // Cosmetic (every command re-checks): which lifecycle controls to offer this person.
  const live = ins.status === "open" || ins.status === "acknowledged";
  const [mayAck, mayDismiss, controls] = await Promise.all([
    live && ins.status === "open" ? api.may(actor, "insight.acknowledge", [ins.primaryUnitId]) : false,
    live ? api.may(actor, "insight.dismiss", [ins.primaryUnitId]) : false,
    Promise.all(
      trace.actions.map(async (a) => ({
        id: a.id,
        cancel:
          ["proposed", "pending_approval", "ready"].includes(a.status) &&
          (await api.may(actor, "action.cancel", a.targetUnitIds)),
        amend:
          ["proposed", "pending_approval", "ready"].includes(a.status) &&
          (await api.may(actor, "action.propose", a.targetUnitIds)),
        retry: a.status === "failed" && (await api.may(actor, "action.execute", a.targetUnitIds)),
      })),
    ),
  ]);
  const unitName = (uid: string) => trace.units.find((u) => u.id === uid)?.name ?? t("unknown unit");
  const personName = (pid: string | null) =>
    trace.people.find((p) => p.id === pid)?.name ??
    (pid?.startsWith("system:") || pid?.startsWith("policy:") ? pid : t("unknown"));
  const pb = ins.priorityBreakdown as PriorityBreakdown;
  const isOpp = ins.workstream === "opportunity";
  const decision = trace.decisions[0];
  const owner = ins.ownerDepartmentId ? unitName(ins.ownerDepartmentId) : null;
  const involved = [ins.primaryUnitId, ...ins.affectedUnitIds]
    .filter((id) => id !== ins.ownerDepartmentId)
    .map(unitName);

  return (
    <>
      <BackLink href="/">{t("← Insights")}</BackLink>
      <Notice error={error} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Band band={trace.local?.band ?? ins.priorityBand} score={trace.local?.score ?? ins.priorityScore} />
              {trace.local && trace.local.band !== ins.priorityBand && (
                <Pill>
                  {t("{band} for {scope} · group-wide {groupBand}", {
                    band: trace.local.band,
                    scope: trace.local.scopeName,
                    groupBand: ins.priorityBand,
                  })}
                </Pill>
              )}
              <Pill tone={isOpp ? "good" : "neutral"}>
                {isOpp ? t("Opportunity workstream") : t("Risk workstream")}
              </Pill>
              <Pill tone={ins.status === "resolved" ? "good" : "neutral"}>{t(ins.status)}</Pill>
              <Pill>{sourceLabel(t, ins.generatedBy)}</Pill>
              {mayAck && (
                <form action={acknowledgeInsightAction}>
                  <input type="hidden" name="insightId" value={ins.id} />
                  <button className="rounded-lg border border-line px-3 py-1 text-[13px] hover:bg-soft">
                    {t("Acknowledge")}
                  </button>
                </form>
              )}
              {mayDismiss && (
                <details>
                  <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1 text-[13px] hover:bg-soft">
                    {t("Dismiss…")}
                  </summary>
                  <form action={dismissInsightAction} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="insightId" value={ins.id} />
                    <input
                      name="rationale"
                      required
                      minLength={3}
                      placeholder={t("Why it needs no action")}
                      className="field min-w-64"
                    />
                    <button className="rounded-lg border border-p1 px-3 py-1 font-semibold text-p1">
                      {t("Dismiss insight")}
                    </button>
                  </form>
                </details>
              )}
            </div>
            <h1 className="text-[26px] font-semibold leading-tight">{ins.title}</h1>
            <p className="leading-relaxed">
              <b>{t("What happened.")}</b> {ins.whatHappened}
            </p>
            <p className="leading-relaxed">
              <b>{t("Why it matters.")}</b> {ins.whyItMatters}
            </p>
          </div>

          <Card className="flex flex-col gap-4 border-ink">
            <h2 className="text-lg font-semibold">{t("Why am I seeing this?")}</h2>
            <ol className="flex flex-wrap items-center gap-2 text-[13px]">
              {[
                t("Signal: {n} × {type}", {
                  n: trace.signals.length,
                  type: SIGNAL_LABEL[trace.signals[0]?.type]
                    ? t(SIGNAL_LABEL[trace.signals[0]?.type])
                    : String(trace.signals[0]?.type),
                }),
                t("Evidence: {n} frozen snapshots", { n: trace.evidence.length }),
                t("Insight"),
                isOpp
                  ? t("Opportunity score {score} = {band}", { score: Math.round(pb.score), band: pb.band })
                  : t("Priority {score} = {band}", { score: Math.round(pb.score), band: pb.band }),
                t("Recommendation"),
              ].map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  {i > 0 && (
                    <span aria-hidden className="rtl:-scale-x-100">
                      →
                    </span>
                  )}
                  <span className="rounded-md border border-line px-2 py-1">{s}</span>
                </li>
              ))}
            </ol>
            <div className="grid gap-4 md:grid-cols-2">
              {trace.evidence.map((e) => {
                const p = e.payload as {
                  unit?: string;
                  expectedIs?: string;
                  days?: { day: string; actual: number; expected: number }[];
                } & Record<string, unknown>;
                return (
                  <figure key={e.id} className="m-0 flex flex-col gap-2 rounded-lg border border-line p-3">
                    <figcaption className="text-[13px] font-semibold">{e.title}</figcaption>
                    {/* Only a KPI series is drawn; a source record's fields (which may include a "days" count) are listed. */}
                    {e.kind.startsWith("market_") && Array.isArray(p.rows) ? (
                      <dl
                        className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]"
                        data-testid="market-evidence"
                      >
                        {(p.rows as { label: string; value: string }[]).map((r) => (
                          <div key={r.label} className="contents">
                            <dt className="text-muted">{r.label}</dt>
                            <dd className="num">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : e.kind === "kpi_series" && Array.isArray(p.days) ? (
                      <EvidenceChart
                        days={p.days}
                        unit={p.unit ?? ""}
                        expectedLabel={p.expectedIs ?? t("usual level for that weekday")}
                      />
                    ) : (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                        {Object.entries(p).map(([k, val]) => (
                          <div key={k} className="contents">
                            <dt className="text-muted">{k}</dt>
                            <dd className="font-mono">{String(val)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {p.real === true && typeof p.url === "string" ? (
                      <a href={p.url} className="text-xs text-accent underline" target="_blank" rel="noreferrer">
                        {t("Open the source")}
                      </a>
                    ) : null}
                    <div className="text-xs text-muted">
                      {p.real === true
                        ? t("Source: {ref} · captured {time} · frozen · sha256 {hash}…", {
                            ref: e.sourceRef,
                            time: fmtTime(e.capturedAt),
                            hash: e.payloadHash.slice(0, 10),
                          })
                        : t("Source: {ref} (synthetic) · captured {time} · frozen · sha256 {hash}…", {
                            ref: e.sourceRef,
                            time: fmtTime(e.capturedAt),
                            hash: e.payloadHash.slice(0, 10),
                          })}
                    </div>
                  </figure>
                );
              })}
            </div>
            <div className="rounded-lg border border-line p-3 text-[13px]">
              <div className="mb-2 font-semibold">
                {isOpp ? t("Opportunity score") : t("Priority breakdown")} · {pb.model}
                {pb.weightsVersion ? `, ${pb.weightsVersion}` : ""}
              </div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)_48px] items-center gap-x-3 gap-y-1.5 font-mono text-xs">
                {(Object.keys(pb.factors) as (keyof typeof pb.factors)[]).map((k) => (
                  <div key={k} className="contents">
                    <span>
                      {t(FACTOR[k] ?? k)} ×{pb.weights[k].toFixed(2)}
                    </span>
                    <span className="h-2 rounded bg-soft">
                      <span
                        className="block h-2 rounded bg-accent"
                        style={{ width: `${Math.round(pb.factors[k] * 100)}%` }}
                      />
                    </span>
                    <span>{pb.factors[k].toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-muted">
                {t("Confidence {confidence} → ×{multiplier} · score {score}", {
                  confidence: ins.confidence.toFixed(2),
                  multiplier: pb.confidenceMultiplier.toFixed(2),
                  score: pb.score,
                })}{" "}
                ·{" "}
                {isOpp
                  ? t("bands O1 ≥ {o1} pursue now, O2 ≥ {o2} plan, else O3 watch", {
                      o1: OPPORTUNITY_BANDS.O1,
                      o2: OPPORTUNITY_BANDS.O2,
                    })
                  : t("bands P1 ≥ {p1}, P2 ≥ {p2}, P3 ≥ {p3}", { p1: BANDS.P1, p2: BANDS.P2, p3: BANDS.P3 })}
              </p>
              {trace.local && (
                <p className="mt-1">
                  {t("For you ({scope}):", { scope: trace.local.scopeName })} <b>{trace.local.band}</b> ·{" "}
                  {t(
                    "{score} with {model} (impact and breadth measured against your own scope; local priority only ever raises an item).",
                    { score: trace.local.score, model: trace.local.model },
                  )}
                </p>
              )}
            </div>
            <p className="text-[13px]">
              {owner && (
                <>
                  {t("Owner:")} <b className="me-3 text-accent">{owner}</b>
                </>
              )}
              {t("Involved:")}{" "}
              {[...new Set(involved)].map((n) => (
                <span key={n} className="me-2 inline-block rounded border border-line px-1.5 py-px">
                  {n}
                </span>
              ))}
            </p>
          </Card>

          {behind && behind.commitments.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle
                aside={
                  <span className="text-xs text-muted">
                    {behind.conflicts.length
                      ? behind.conflicts
                          .map(
                            (k) =>
                              `${
                                k.status === "open"
                                  ? t("Conflict on {resource}, {overlap}", { resource: k.resource, overlap: k.overlap })
                                  : t("Conflict resolved ({reason}) on {resource}, {overlap}", {
                                      reason: String(k.resolvedReason),
                                      resource: k.resource,
                                      overlap: k.overlap,
                                    })
                              }${
                                k.escalatedTo && k.status === "open"
                                  ? ` · ${t("escalated to {who} (common manager) {time}", {
                                      who: k.escalatedTo,
                                      time: String(k.escalatedAt?.toISOString().slice(5, 16).replace("T", " ")),
                                    })}`
                                  : ""
                              }`,
                          )
                          .join(" · ")
                      : t("from the commitment register")}
                  </span>
                }
              >
                {behind.conflicts.length ? t("The plans that collide") : t("The commitment behind this")}
              </SectionTitle>
              <div className={`grid gap-4 ${behind.commitments.length > 1 ? "xl:grid-cols-2" : ""}`}>
                {behind.commitments.map((c) => (
                  <CommitmentCard key={c.id} c={c} />
                ))}
              </div>
            </section>
          )}

          {lessons.length > 0 && (
            <Card className="flex flex-col gap-2 border-good/50">
              <SectionTitle
                aside={<span className="text-xs text-muted">{t("reviewed outcomes of the same kind of action")}</span>}
              >
                {t("Last time we did this")}
              </SectionTitle>
              {lessons.map((l) => (
                <p key={l.id} className="text-sm">
                  <span className="font-semibold">{l.actionTitle}</span>{" "}
                  <span className="text-muted">({l.verdict ? t(l.verdict.replaceAll("_", " ")) : l.verdict})</span>: “
                  {l.lesson}”{" "}
                  <a href={`/insights/${l.insightId}`} className="text-xs text-accent">
                    {t("see it →")}
                  </a>
                </p>
              ))}
            </Card>
          )}

          {decision && (
            <Card className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">{t("What should happen")}</h2>
              <p className="text-sm">
                <b>{t("Decision:")}</b> {decision.statement}.{" "}
                <span className="text-muted">
                  {decision.status === "recommended" && t("Recommended by VECTOR · waiting for a human decision")}
                  {decision.status === "decided" &&
                    (decision.autoRule
                      ? t("Decided automatically by rule {rule}", { rule: decision.autoRule })
                      : t("Recommended by VECTOR · accepted by {name}", { name: personName(decision.decidedBy) }))}
                  {decision.status === "declined" &&
                    t("Declined by {name}: {rationale}", {
                      name: personName(decision.decidedBy),
                      rationale: String(decision.rationale),
                    })}
                </span>
              </p>
              {trace.actions.map((a) => {
                const req = a.approvalRequirement as ApprovalRequirement | null;
                const matched = req?.rules.filter((r) => r.matched) ?? [];
                const ap = trace.approvals.filter((x) => x.actionId === a.id).at(-1);
                const out = trace.outcomes.find((o) => o.actionId === a.id);
                return (
                  <div
                    key={a.id}
                    id={`action-${a.id}`}
                    className="flex scroll-mt-20 flex-col gap-1.5 rounded-lg border border-line px-4 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>{a.title}</b>
                      <span className="flex items-center gap-2">
                        {a.status === "executed" && <Simulated />}
                        <Pill
                          tone={
                            a.status === "pending_approval" ? "strong" : a.status === "executed" ? "good" : "neutral"
                          }
                        >
                          {ACTION_STATUS[a.status] ? t(ACTION_STATUS[a.status]) : ACTION_STATUS[a.status]}
                        </Pill>
                      </span>
                    </div>
                    <div className="font-mono text-xs text-muted">
                      {t("Owner {name} · cost {cost} · {executor}", {
                        name: personName(a.ownerUserId),
                        cost: `₪${Number(a.estimatedCost).toLocaleString(intlOf(locale))}`,
                        executor: a.executor === "internal_task" ? t("internal task") : t("outbox message"),
                      })}
                    </div>
                    {req && !req.required && (
                      <div className="text-[13px] text-muted">
                        {t("No approval needed: rules AP-1…AP-7 evaluated, none matched.")}
                      </div>
                    )}
                    {matched.length > 0 && (
                      <div className="text-[13px]">
                        {t("Needs approval: {rules}. Eligible: {eligible} (must satisfy every rule).", {
                          rules: matched.map((r) => `${r.rule} ${r.name.toLowerCase()}`).join(", "),
                          eligible: [
                            ...new Set(
                              matched.flatMap((r) =>
                                r.eligible.map(
                                  (o) =>
                                    `${ROLE_LABEL[o.role] ? t(ROLE_LABEL[o.role]) : ROLE_LABEL[o.role]} · ${unitName(o.unit.id)}`,
                                ),
                              ),
                            ),
                          ].join(` ${t("or")} `),
                        })}
                      </div>
                    )}
                    {ap && (
                      <div className="text-[13px]">
                        {t("Approval {status}", { status: t(ap.status) })}
                        {ap.approverUserId && ` ${t("by {name}", { name: personName(ap.approverUserId) })}`}
                        {ap.decidedAt && ` ${t("at {time}", { time: fmtTime(ap.decidedAt) })}`}
                        {ap.rationale && `: “${ap.rationale}”`}
                      </div>
                    )}
                    {(() => {
                      const c = controls.find((x) => x.id === a.id);
                      if (!c || !(c.cancel || c.amend || c.retry)) return null;
                      return (
                        <div className="mt-1 flex flex-wrap items-start gap-2">
                          {c.retry && (
                            <form action={retryActionAction}>
                              <input type="hidden" name="insightId" value={ins.id} />
                              <input type="hidden" name="actionId" value={a.id} />
                              <button className="rounded-lg border border-accent px-3 py-1 text-[13px] text-accent">
                                {t("Retry")}
                              </button>
                            </form>
                          )}
                          {c.amend && (
                            <details>
                              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1 text-[13px] hover:bg-soft">
                                {t("Amend…")}
                              </summary>
                              <form action={amendActionAction} className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                                <input type="hidden" name="insightId" value={ins.id} />
                                <input type="hidden" name="actionId" value={a.id} />
                                <label className="flex flex-col gap-1 text-[13px]">
                                  {t("Cost (₪)")}
                                  <input
                                    type="number"
                                    name="estimatedCost"
                                    min={0}
                                    step={500}
                                    defaultValue={Number(a.estimatedCost)}
                                    className="field w-32"
                                  />
                                </label>
                                <label className="flex grow flex-col gap-1 text-[13px]">
                                  {t("What changes")}
                                  <input name="note" className="field" placeholder={t("e.g. half the volume")} />
                                </label>
                                <button className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-ink">
                                  {t("Save revision {n}", { n: a.revision + 1 })}
                                </button>
                                <span className="basis-full text-xs text-muted">
                                  {t(
                                    "A new revision withdraws any pending or granted approval; the policy is re-run for the new one.",
                                  )}
                                </span>
                              </form>
                            </details>
                          )}
                          {c.cancel && (
                            <details>
                              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1 text-[13px] hover:bg-soft">
                                {t("Cancel…")}
                              </summary>
                              <form
                                action={cancelActionAction}
                                className="mt-2 flex flex-wrap items-center gap-2 text-sm"
                              >
                                <input type="hidden" name="insightId" value={ins.id} />
                                <input type="hidden" name="actionId" value={a.id} />
                                <input
                                  name="rationale"
                                  required
                                  minLength={3}
                                  placeholder={t("Why")}
                                  className="field min-w-56"
                                />
                                <button className="rounded-lg border border-p1 px-3 py-1 font-semibold text-p1">
                                  {t("Cancel action")}
                                </button>
                              </form>
                            </details>
                          )}
                        </div>
                      );
                    })()}
                    {out && (
                      <div className="text-[13px]">
                        {t("Outcome:")}{" "}
                        {out.status === "observing"
                          ? t("watching OSA until {time}", { time: fmtTime(out.windowEnd) })
                          : t("{verdict} (OSA {from}% → {to}%)", {
                              verdict: out.verdict ? t(out.verdict.replaceAll("_", " ")) : String(out.verdict),
                              from: (out.observed as { baselineMean: number; windowMean: number }).baselineMean.toFixed(
                                1,
                              ),
                              to: (out.observed as { windowMean: number }).windowMean.toFixed(1),
                            })}
                        {out.lesson && ` · ${t("Lesson: {lesson}", { lesson: out.lesson })}`}
                        {out.status === "evaluated" && (
                          <form action={reviewOutcomeAction} className="mt-2 flex flex-wrap gap-2">
                            <input type="hidden" name="insightId" value={ins.id} />
                            <input type="hidden" name="outcomeId" value={out.id} />
                            <label htmlFor={`lesson-${out.id}`} className="sr-only">
                              {t("Lesson learned")}
                            </label>
                            <input
                              id={`lesson-${out.id}`}
                              name="lesson"
                              placeholder={t("What should we learn?")}
                              className="min-w-60 grow rounded-md border border-line px-3 py-1.5"
                            />
                            <button className="rounded-md border border-ink px-3 py-1.5">{t("Record lesson")}</button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {decision.status === "recommended" && !mayDecide && (
                <p className="text-[13px] text-muted">
                  {t("Waiting for a decision by the manager of {unit} (or someone above them).", {
                    unit: unitName(ins.primaryUnitId),
                  })}
                </p>
              )}
              {decision.status === "recommended" && mayDecide && (
                <div className="flex flex-col gap-3 rounded-lg bg-ground p-4">
                  <form action={acceptDecisionAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="insightId" value={ins.id} />
                    <input type="hidden" name="decisionId" value={decision.id} />
                    <label htmlFor="accept-note" className="sr-only">
                      {t("Note")}
                    </label>
                    <input
                      id="accept-note"
                      name="rationale"
                      placeholder={t("Note (optional)")}
                      className="min-w-60 grow rounded-md border border-line bg-panel px-3 py-2"
                    />
                    <button className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink">
                      {t("Accept recommendation")}
                    </button>
                  </form>
                  <form action={declineDecisionAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="insightId" value={ins.id} />
                    <input type="hidden" name="decisionId" value={decision.id} />
                    <label htmlFor="decline-note" className="sr-only">
                      {t("Reason for declining")}
                    </label>
                    <input
                      id="decline-note"
                      name="rationale"
                      required
                      placeholder={t("Reason (required to decline)")}
                      className="min-w-60 grow rounded-md border border-line bg-panel px-3 py-2"
                    />
                    <button className="rounded-md border border-ink bg-panel px-4 py-2">{t("Decline")}</button>
                  </form>
                </div>
              )}
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <SectionTitle>{t("Audit trail · {n} events", { n: trace.audit.length })}</SectionTitle>
            <ol className="mt-3 flex flex-col gap-2.5 text-[13px] leading-snug">
              {trace.audit.map((e) => (
                <li key={e.id}>
                  <span className="font-mono text-xs text-muted">
                    #{e.seq} {fmtTime(e.occurredAt)}
                  </span>
                  <br />
                  <b>{e.operation}</b> · {personName(e.actorId)}
                  {e.viaDemoSwitcher && <span className="text-muted"> {t("(via demo switcher)")}</span>}
                  {e.reason && <span className="text-muted"> · {e.reason}</span>}
                </li>
              ))}
            </ol>
          </Card>
          {trace.tasks.length + trace.messages.length > 0 && (
            <Card>
              <SectionTitle>{t("Executed (simulated)")}</SectionTitle>
              <ul className="mt-3 flex flex-col gap-2 text-[13px]">
                {trace.tasks.map((x) => (
                  <li key={x.id}>
                    {t("Task for {name}: {title}", { name: personName(x.assigneeUserId), title: x.title })}{" "}
                    <Simulated />
                  </li>
                ))}
                {trace.messages.map((m) => (
                  <li key={m.id}>
                    {t("Outbox → {recipients}: {subject}", { recipients: String(m.recipients), subject: m.subject })}{" "}
                    <Simulated />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <SectionTitle>{t("Signal")}</SectionTitle>
            {trace.signals.map((sg) => {
              const m = sg.measurements as Record<string, unknown> & {
                kpi?: string;
                change?: number;
                z?: number;
                window?: string[];
                osaChangePts?: number;
                osaZ?: number;
              };
              const isKpi = m.kpi === "net_sales";
              return (
                <dl key={sg.id} className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                  <dt className="text-muted">{t("Type")}</dt>
                  <dd>{SIGNAL_LABEL[sg.type] ? t(SIGNAL_LABEL[sg.type]) : sg.type}</dd>
                  <dt className="text-muted">{t("Source")}</dt>
                  <dd>
                    {sg.detector} v{sg.detectorVersion} · {sg.source.replace(/_/g, " ")}
                  </dd>
                  {isKpi ? (
                    <>
                      <dt className="text-muted">{t("Net sales")}</dt>
                      <dd>
                        {t("{pct}% vs usual (z {z})", {
                          pct: ((m.change ?? 0) * 100).toFixed(1),
                          z: m.z?.toFixed(1) ?? "",
                        })}
                      </dd>
                      {m.osaChangePts !== undefined && (
                        <>
                          <dt className="text-muted">{t("On-shelf avail.")}</dt>
                          <dd>
                            {t("{pts} pts vs usual (z {z})", {
                              pts: m.osaChangePts.toFixed(1),
                              z: m.osaZ?.toFixed(1) ?? "",
                            })}
                          </dd>
                        </>
                      )}
                      <dt className="text-muted">{t("Window")}</dt>
                      <dd className="num">{m.window?.join(" → ")}</dd>
                    </>
                  ) : (
                    Object.entries(m).map(([k, val]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted">{k}</dt>
                        <dd className="font-mono">{String(val)}</dd>
                      </div>
                    ))
                  )}
                </dl>
              );
            })}
          </Card>
        </aside>
      </div>
    </>
  );
}
