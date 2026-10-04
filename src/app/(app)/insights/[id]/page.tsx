import { notFound } from "next/navigation";
import { api } from "@/application/facade";
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
import { requireActor } from "../../../_lib/session";

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
const sourceLabel = (g: string) =>
  g.startsWith("rule:")
    ? `Rule-generated · ${g.slice(5)}`
    : g.startsWith("scenario-catalog")
      ? "Scenario catalog · synthetic feed"
      : g.startsWith("commitment-monitor") || g.startsWith("conflict-rules")
        ? `Rule-generated · ${g} · commitment register`
        : g;

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
  const t = await api.trace(actor, id);
  if (!t) notFound(); // out of scope looks exactly like missing (authorization.md §1)
  const [mayDecide, behind] = await Promise.all([
    api.canDecide(actor, id), // cosmetic; acceptDecision re-checks
    api.commitmentsForInsight(actor, id), // Phase 4: the promises and plans behind this insight
  ]);
  const lessons = await api.lessonsFor(actor, id); // Phase 4f: what we learned last time we did this
  const { insight: ins } = t;
  // Cosmetic (every command re-checks): which lifecycle controls to offer this person.
  const live = ins.status === "open" || ins.status === "acknowledged";
  const [mayAck, mayDismiss, controls] = await Promise.all([
    live && ins.status === "open" ? api.may(actor, "insight.acknowledge", [ins.primaryUnitId]) : false,
    live ? api.may(actor, "insight.dismiss", [ins.primaryUnitId]) : false,
    Promise.all(
      t.actions.map(async (a) => ({
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
  const unitName = (uid: string) => t.units.find((u) => u.id === uid)?.name ?? "unknown unit";
  const personName = (pid: string | null) =>
    t.people.find((p) => p.id === pid)?.name ??
    (pid?.startsWith("system:") || pid?.startsWith("policy:") ? pid : "unknown");
  const pb = ins.priorityBreakdown as PriorityBreakdown;
  const isOpp = ins.workstream === "opportunity";
  const decision = t.decisions[0];
  const owner = ins.ownerDepartmentId ? unitName(ins.ownerDepartmentId) : null;
  const involved = [ins.primaryUnitId, ...ins.affectedUnitIds]
    .filter((id) => id !== ins.ownerDepartmentId)
    .map(unitName);

  return (
    <>
      <BackLink href="/">← Insights</BackLink>
      <Notice error={error} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Band band={t.local?.band ?? ins.priorityBand} score={t.local?.score ?? ins.priorityScore} />
              {t.local && t.local.band !== ins.priorityBand && (
                <Pill>
                  {t.local.band} for {t.local.scopeName} · group-wide {ins.priorityBand}
                </Pill>
              )}
              <Pill tone={isOpp ? "good" : "neutral"}>{isOpp ? "Opportunity workstream" : "Risk workstream"}</Pill>
              <Pill tone={ins.status === "resolved" ? "good" : "neutral"}>{ins.status}</Pill>
              <Pill>{sourceLabel(ins.generatedBy)}</Pill>
              {mayAck && (
                <form action={acknowledgeInsightAction}>
                  <input type="hidden" name="insightId" value={ins.id} />
                  <button className="rounded-lg border border-line px-3 py-1 text-[13px] hover:bg-soft">
                    Acknowledge
                  </button>
                </form>
              )}
              {mayDismiss && (
                <details>
                  <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1 text-[13px] hover:bg-soft">
                    Dismiss…
                  </summary>
                  <form action={dismissInsightAction} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="insightId" value={ins.id} />
                    <input
                      name="rationale"
                      required
                      minLength={3}
                      placeholder="Why it needs no action"
                      className="field min-w-64"
                    />
                    <button className="rounded-lg border border-p1 px-3 py-1 font-semibold text-p1">
                      Dismiss insight
                    </button>
                  </form>
                </details>
              )}
            </div>
            <h1 className="text-[26px] font-semibold leading-tight">{ins.title}</h1>
            <p className="leading-relaxed">
              <b>What happened.</b> {ins.whatHappened}
            </p>
            <p className="leading-relaxed">
              <b>Why it matters.</b> {ins.whyItMatters}
            </p>
          </div>

          <Card className="flex flex-col gap-4 border-ink">
            <h2 className="text-lg font-semibold">Why am I seeing this?</h2>
            <ol className="flex flex-wrap items-center gap-2 text-[13px]">
              {[
                `Signal: ${t.signals.length} × ${SIGNAL_LABEL[t.signals[0]?.type] ?? t.signals[0]?.type}`,
                `Evidence: ${t.evidence.length} frozen snapshots`,
                "Insight",
                `${isOpp ? "Opportunity score" : "Priority"} ${Math.round(pb.score)} = ${pb.band}`,
                "Recommendation",
              ].map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden>→</span>}
                  <span className="rounded-md border border-line px-2 py-1">{s}</span>
                </li>
              ))}
            </ol>
            <div className="grid gap-4 md:grid-cols-2">
              {t.evidence.map((e) => {
                const p = e.payload as {
                  unit?: string;
                  expectedIs?: string;
                  days?: { day: string; actual: number; expected: number }[];
                } & Record<string, unknown>;
                return (
                  <figure key={e.id} className="m-0 flex flex-col gap-2 rounded-lg border border-line p-3">
                    <figcaption className="text-[13px] font-semibold">{e.title}</figcaption>
                    {/* Only a KPI series is drawn; a source record's fields (which may include a "days" count) are listed. */}
                    {e.kind === "kpi_series" && Array.isArray(p.days) ? (
                      <EvidenceChart
                        days={p.days}
                        unit={p.unit ?? ""}
                        expectedLabel={p.expectedIs ?? "usual level for that weekday"}
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
                    <div className="text-xs text-muted">
                      Source: {e.sourceRef} (synthetic) · captured {fmtTime(e.capturedAt)} · frozen · sha256{" "}
                      {e.payloadHash.slice(0, 10)}…
                    </div>
                  </figure>
                );
              })}
            </div>
            <div className="rounded-lg border border-line p-3 text-[13px]">
              <div className="mb-2 font-semibold">
                {isOpp ? "Opportunity score" : "Priority breakdown"} · {pb.model}
                {pb.weightsVersion ? `, ${pb.weightsVersion}` : ""}
              </div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)_48px] items-center gap-x-3 gap-y-1.5 font-mono text-xs">
                {(Object.keys(pb.factors) as (keyof typeof pb.factors)[]).map((k) => (
                  <div key={k} className="contents">
                    <span>
                      {k} ×{pb.weights[k].toFixed(2)}
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
                Confidence {ins.confidence.toFixed(2)} → ×{pb.confidenceMultiplier.toFixed(2)} · score {pb.score} ·{" "}
                {isOpp
                  ? `bands O1 ≥ ${OPPORTUNITY_BANDS.O1} pursue now, O2 ≥ ${OPPORTUNITY_BANDS.O2} plan, else O3 watch`
                  : `bands P1 ≥ ${BANDS.P1}, P2 ≥ ${BANDS.P2}, P3 ≥ ${BANDS.P3}`}
              </p>
              {t.local && (
                <p className="mt-1">
                  For you ({t.local.scopeName}): <b>{t.local.band}</b> · {t.local.score} with {t.local.model} (impact
                  and breadth measured against your own scope; local priority only ever raises an item).
                </p>
              )}
            </div>
            <p className="text-[13px]">
              {owner && (
                <>
                  Owner: <b className="mr-3 text-accent">{owner}</b>
                </>
              )}
              Involved:{" "}
              {[...new Set(involved)].map((n) => (
                <span key={n} className="mr-2 inline-block rounded border border-line px-1.5 py-px">
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
                              `${k.status === "open" ? "Conflict" : `Conflict resolved (${k.resolvedReason})`} on ${k.resource}, ${k.overlap}`,
                          )
                          .join(" · ")
                      : "from the commitment register"}
                  </span>
                }
              >
                {behind.conflicts.length ? "The plans that collide" : "The commitment behind this"}
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
                aside={<span className="text-xs text-muted">reviewed outcomes of the same kind of action</span>}
              >
                Last time we did this
              </SectionTitle>
              {lessons.map((l) => (
                <p key={l.id} className="text-sm">
                  <span className="font-semibold">{l.actionTitle}</span>{" "}
                  <span className="text-muted">({l.verdict?.replaceAll("_", " ")})</span>: “{l.lesson}”{" "}
                  <a href={`/insights/${l.insightId}`} className="text-xs text-accent">
                    see it →
                  </a>
                </p>
              ))}
            </Card>
          )}

          {decision && (
            <Card className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">What should happen</h2>
              <p className="text-sm">
                <b>Decision:</b> {decision.statement}.{" "}
                <span className="text-muted">
                  {decision.status === "recommended" && "Recommended by VECTOR · waiting for a human decision"}
                  {decision.status === "decided" &&
                    (decision.autoRule
                      ? `Decided automatically by rule ${decision.autoRule}`
                      : `Recommended by VECTOR · accepted by ${personName(decision.decidedBy)}`)}
                  {decision.status === "declined" &&
                    `Declined by ${personName(decision.decidedBy)}: ${decision.rationale}`}
                </span>
              </p>
              {t.actions.map((a) => {
                const req = a.approvalRequirement as ApprovalRequirement | null;
                const matched = req?.rules.filter((r) => r.matched) ?? [];
                const ap = t.approvals.filter((x) => x.actionId === a.id).at(-1);
                const out = t.outcomes.find((o) => o.actionId === a.id);
                return (
                  <div key={a.id} className="flex flex-col gap-1.5 rounded-lg border border-line px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>{a.title}</b>
                      <span className="flex items-center gap-2">
                        {a.status === "executed" && <Simulated />}
                        <Pill
                          tone={
                            a.status === "pending_approval" ? "strong" : a.status === "executed" ? "good" : "neutral"
                          }
                        >
                          {ACTION_STATUS[a.status]}
                        </Pill>
                      </span>
                    </div>
                    <div className="font-mono text-xs text-muted">
                      Owner {personName(a.ownerUserId)} · cost ₪{Number(a.estimatedCost).toLocaleString("en-US")} ·{" "}
                      {a.executor === "internal_task" ? "internal task" : "outbox message"}
                    </div>
                    {req && !req.required && (
                      <div className="text-[13px] text-muted">
                        No approval needed: rules AP-1…AP-7 evaluated, none matched.
                      </div>
                    )}
                    {matched.length > 0 && (
                      <div className="text-[13px]">
                        Needs approval: {matched.map((r) => `${r.rule} ${r.name.toLowerCase()}`).join(", ")}. Eligible:{" "}
                        {[
                          ...new Set(
                            matched.flatMap((r) =>
                              r.eligible.map((o) => `${ROLE_LABEL[o.role]} · ${unitName(o.unit.id)}`),
                            ),
                          ),
                        ].join(" or ")}{" "}
                        (must satisfy every rule).
                      </div>
                    )}
                    {ap && (
                      <div className="text-[13px]">
                        Approval {ap.status}
                        {ap.approverUserId && ` by ${personName(ap.approverUserId)}`}
                        {ap.decidedAt && ` at ${fmtTime(ap.decidedAt)}`}
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
                                Retry
                              </button>
                            </form>
                          )}
                          {c.amend && (
                            <details>
                              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1 text-[13px] hover:bg-soft">
                                Amend…
                              </summary>
                              <form action={amendActionAction} className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                                <input type="hidden" name="insightId" value={ins.id} />
                                <input type="hidden" name="actionId" value={a.id} />
                                <label className="flex flex-col gap-1 text-[13px]">
                                  Cost (₪)
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
                                  What changes
                                  <input name="note" className="field" placeholder="e.g. half the volume" />
                                </label>
                                <button className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-ink">
                                  Save revision {a.revision + 1}
                                </button>
                                <span className="basis-full text-xs text-muted">
                                  A new revision withdraws any pending or granted approval; the policy is re-run for the
                                  new one.
                                </span>
                              </form>
                            </details>
                          )}
                          {c.cancel && (
                            <details>
                              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1 text-[13px] hover:bg-soft">
                                Cancel…
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
                                  placeholder="Why"
                                  className="field min-w-56"
                                />
                                <button className="rounded-lg border border-p1 px-3 py-1 font-semibold text-p1">
                                  Cancel action
                                </button>
                              </form>
                            </details>
                          )}
                        </div>
                      );
                    })()}
                    {out && (
                      <div className="text-[13px]">
                        Outcome:{" "}
                        {out.status === "observing"
                          ? `watching OSA until ${fmtTime(out.windowEnd)}`
                          : `${out.verdict?.replaceAll("_", " ")} (OSA ${(out.observed as { baselineMean: number; windowMean: number }).baselineMean.toFixed(1)}% → ${(out.observed as { windowMean: number }).windowMean.toFixed(1)}%)`}
                        {out.lesson && ` · Lesson: ${out.lesson}`}
                        {out.status === "evaluated" && (
                          <form action={reviewOutcomeAction} className="mt-2 flex flex-wrap gap-2">
                            <input type="hidden" name="insightId" value={ins.id} />
                            <input type="hidden" name="outcomeId" value={out.id} />
                            <label htmlFor={`lesson-${out.id}`} className="sr-only">
                              Lesson learned
                            </label>
                            <input
                              id={`lesson-${out.id}`}
                              name="lesson"
                              placeholder="What should we learn?"
                              className="min-w-60 grow rounded-md border border-line px-3 py-1.5"
                            />
                            <button className="rounded-md border border-ink px-3 py-1.5">Record lesson</button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {decision.status === "recommended" && !mayDecide && (
                <p className="text-[13px] text-muted">
                  Waiting for a decision by the manager of {unitName(ins.primaryUnitId)} (or someone above them).
                </p>
              )}
              {decision.status === "recommended" && mayDecide && (
                <div className="flex flex-col gap-3 rounded-lg bg-ground p-4">
                  <form action={acceptDecisionAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="insightId" value={ins.id} />
                    <input type="hidden" name="decisionId" value={decision.id} />
                    <label htmlFor="accept-note" className="sr-only">
                      Note
                    </label>
                    <input
                      id="accept-note"
                      name="rationale"
                      placeholder="Note (optional)"
                      className="min-w-60 grow rounded-md border border-line bg-panel px-3 py-2"
                    />
                    <button className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink">
                      Accept recommendation
                    </button>
                  </form>
                  <form action={declineDecisionAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="insightId" value={ins.id} />
                    <input type="hidden" name="decisionId" value={decision.id} />
                    <label htmlFor="decline-note" className="sr-only">
                      Reason for declining
                    </label>
                    <input
                      id="decline-note"
                      name="rationale"
                      required
                      placeholder="Reason (required to decline)"
                      className="min-w-60 grow rounded-md border border-line bg-panel px-3 py-2"
                    />
                    <button className="rounded-md border border-ink bg-panel px-4 py-2">Decline</button>
                  </form>
                </div>
              )}
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <SectionTitle>Audit trail · {t.audit.length} events</SectionTitle>
            <ol className="mt-3 flex flex-col gap-2.5 text-[13px] leading-snug">
              {t.audit.map((e) => (
                <li key={e.id}>
                  <span className="font-mono text-xs text-muted">
                    #{e.seq} {fmtTime(e.occurredAt)}
                  </span>
                  <br />
                  <b>{e.operation}</b> · {personName(e.actorId)}
                  {e.viaDemoSwitcher && <span className="text-muted"> (via demo switcher)</span>}
                  {e.reason && <span className="text-muted"> · {e.reason}</span>}
                </li>
              ))}
            </ol>
          </Card>
          {t.tasks.length + t.messages.length > 0 && (
            <Card>
              <SectionTitle>Executed (simulated)</SectionTitle>
              <ul className="mt-3 flex flex-col gap-2 text-[13px]">
                {t.tasks.map((x) => (
                  <li key={x.id}>
                    Task for {personName(x.assigneeUserId)}: {x.title} <Simulated />
                  </li>
                ))}
                {t.messages.map((m) => (
                  <li key={m.id}>
                    Outbox → {m.recipients}: {m.subject} <Simulated />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <SectionTitle>Signal</SectionTitle>
            {t.signals.map((sg) => {
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
                  <dt className="text-muted">Type</dt>
                  <dd>{SIGNAL_LABEL[sg.type] ?? sg.type}</dd>
                  <dt className="text-muted">Source</dt>
                  <dd>
                    {sg.detector} v{sg.detectorVersion} · {sg.source.replace(/_/g, " ")}
                  </dd>
                  {isKpi ? (
                    <>
                      <dt className="text-muted">Net sales</dt>
                      <dd>
                        {((m.change ?? 0) * 100).toFixed(1)}% vs usual (z {m.z?.toFixed(1)})
                      </dd>
                      {m.osaChangePts !== undefined && (
                        <>
                          <dt className="text-muted">On-shelf avail.</dt>
                          <dd>
                            {m.osaChangePts.toFixed(1)} pts vs usual (z {m.osaZ?.toFixed(1)})
                          </dd>
                        </>
                      )}
                      <dt className="text-muted">Window</dt>
                      <dd>{m.window?.join(" → ")}</dd>
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
