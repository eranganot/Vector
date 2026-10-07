/**
 * Action Center screen (plan v2, E4; action-center.md §2–§5, layout v3): the queue on one side, the selected item on
 * the other. One button per item. The selected item says what VECTOR will do when you approve, with whom and why, and
 * shows the message it suggests, editable before it goes. The backend decides who may do what; buttons here only
 * reflect it.
 */
import Link from "next/link";
import type { ActionCenterView, EventPlan as EventPlanView } from "@/application/facade";
import { EventPlan } from "./event-plan";
import type { Locale } from "@/i18n/locale";
import type { T } from "@/i18n/t";
import { approveAndSendAction, declineInCenterAction } from "../actions";
import { getT } from "../_lib/locale";
import { shortDay } from "./format";
import { ils, MoneyHeader } from "./money-header";
import { Band, Card, Notice, Pill, SectionTitle } from "./ui";

type Selected = NonNullable<ActionCenterView["selected"]>;
type Reason = Selected["cc"][number]["reason"];

const BUTTON: Record<ActionCenterView["queue"][number]["button"], string> = {
  approve_send: "Approve and send",
  approve: "Approve",
  resolve: "Resolve",
  open: "Open",
};

const STEP_STATE: Record<string, string> = {
  proposed: "proposed",
  pending_approval: "waiting for approval",
  ready: "ready",
  executing: "executing",
  executed: "done",
  failed: "failed",
};

const CHAIN_TONE: Record<string, "warn" | "good" | "strong" | "neutral"> = {
  waiting: "warn",
  done: "good",
  started: "strong",
  proposed: "neutral",
};

const OPERATION: Record<string, string> = {
  "insight.created": "insight detected",
  "insight.acknowledged": "acknowledged",
  "decision.recommended": "recommendation made",
  "decision.accepted": "decision accepted",
  "decision.declined": "decision declined",
  "action.proposed": "action proposed",
  "action.submitted": "submitted for approval",
  "approval.requested": "approval requested",
  "approval.granted": "approval granted",
  "approval.denied": "approval denied",
  "action.executing": "execution started",
  "action.executed": "executed",
  "message.drafted": "message drafted",
  "message.edited": "message edited",
  "message.approved": "message approved",
  "message.sent": "message sent (in VECTOR)",
  "message.cancelled": "message cancelled",
};

export function reasonText(t: T, r: Reason) {
  return r.kind === "owns"
    ? t("owns {what}", { what: r.of })
    : r.kind === "head"
      ? t("head of {unit}", { unit: r.of })
      : r.kind === "affected"
        ? t("head of {unit}, affected", { unit: r.of })
        : t("sponsor of {initiative}", { initiative: r.of });
}

const hoursText = (t: T, h: number | null) =>
  h === null
    ? null
    : h <= 0
      ? t("window passed")
      : h < 48
        ? t("{n} h left", { n: h })
        : t("{n} d left", { n: Math.round(h / 24) });

export async function ActionCenterScreen({
  v,
  event,
  locale,
  done,
  error,
}: {
  v: ActionCenterView;
  event: EventPlanView | null;
  locale: Locale;
  done?: string;
  error?: string;
}) {
  const t = await getT();
  const sel = v.selected;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">{t("Action Center")}</h1>
        <p className="text-sm text-muted">
          {t("What can become an action now, ranked by ₪ at stake and urgency. Nothing is sent without your approval.")}
        </p>
      </div>
      <MoneyHeader
        label={t("Action Center in ₪")}
        figures={[
          {
            icon: "₪",
            label: t("a week waiting for a decision"),
            value: ils(v.money.waiting),
            hint: t("₪ a week at stake or on offer in the items below"),
            tone: "warn",
          },
          {
            icon: "✓",
            label: t("expected impact awaiting approval"),
            value: ils(v.money.awaitingApproval),
            hint: t("Expected ₪ of actions waiting for an approval"),
            tone: "accent",
          },
          {
            icon: "→",
            label: t("items you can act on"),
            value: String(v.money.toAct),
            hint: t("Items with a button for you"),
            tone: "good",
          },
          {
            icon: "✉",
            label: t("messages sent this week"),
            value: String(v.money.sentThisWeek),
            hint: t("Delivered inside VECTOR (in the demo nothing leaves VECTOR)"),
            tone: "muted",
          },
        ]}
      />
      <Notice
        error={error}
        done={
          done === "sent"
            ? t("Approved. The message goes out in VECTOR as soon as every approval is in; you can follow it below.")
            : done === "declined"
              ? t("Declined. The reason is recorded.")
              : undefined
        }
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Queue v={v} t={t} locale={locale} />
        {sel ? (
          <SelectedPanel s={sel} t={t} locale={locale} />
        ) : (
          <Card>
            <p className="text-sm text-muted">{t("Nothing waits for an action from you right now.")}</p>
          </Card>
        )}
      </div>
      {event && <EventPlan e={event} t={t} locale={locale} />}
      {v.sent.length > 0 && (
        <Card data-testid="recent-messages">
          <SectionTitle aside={<span className="text-xs text-muted">{t("delivered in VECTOR only")}</span>}>
            {t("Recent messages")}
          </SectionTitle>
          <ul className="mt-3 flex flex-col divide-y divide-line/60 text-sm">
            {v.sent.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                <Pill tone={m.status === "sent" ? "good" : m.status === "approved" ? "warn" : "neutral"}>
                  {m.status === "sent" ? t("sent") : m.status === "approved" ? t("waiting for approval") : t(m.status)}
                </Pill>
                <Link href={`/action-center?item=${m.insightId}`} className="min-w-0 grow no-underline hover:underline">
                  {m.subject}
                </Link>
                <span className="whitespace-nowrap text-xs text-muted">
                  {m.mine ? t("to {names}", { names: m.to.join(", ") }) : t("from {name}", { name: m.from })} ·{" "}
                  {shortDay(m.at, locale)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Queue({ v, t, locale }: { v: ActionCenterView; t: T; locale: Locale }) {
  return (
    <Card className="flex min-w-0 flex-col gap-3" data-testid="action-queue">
      <SectionTitle aside={<span className="text-xs text-muted">{t("₪ × urgency")}</span>}>
        {t("Queue · {n}", { n: v.queue.length })}
      </SectionTitle>
      {v.queue.length === 0 && <p className="text-sm text-muted">{t("Nothing waits for an action from you.")}</p>}
      <ol className="flex flex-col gap-2">
        {v.queue.map((q) => {
          const active = v.selected?.id === q.insightId;
          const left = hoursText(t, q.hoursLeft);
          return (
            <li key={q.insightId}>
              <Link
                href={q.href ?? `/action-center?item=${q.insightId}`}
                data-testid="queue-item"
                aria-current={active ? "true" : undefined}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 no-underline ${
                  active ? "border-accent bg-accent/10" : "border-line hover:border-accent/60"
                }`}
              >
                <Band band={q.band} />
                <span className="min-w-0 grow">
                  <span className="block text-[14px] font-semibold leading-snug text-ink">{q.title}</span>
                  <span className="block text-xs text-muted">
                    {q.kind === "conflict" ? t("conflict · {who}", { who: q.owner }) : q.owner}
                    {q.due ? ` · ${t("due {day}", { day: shortDay(q.due, locale) })}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 whitespace-nowrap text-xs">
                  <span
                    className={`num text-[14px] font-semibold ${q.kind === "opportunity" ? "text-good" : "text-p1"}`}
                  >
                    {ils(q.ils)}
                    <span className="text-[11px] font-normal text-muted">{t("/wk")}</span>
                  </span>
                  {left && (
                    <span className={q.hoursLeft !== null && q.hoursLeft < 72 ? "text-warn" : "text-muted"}>
                      {left}
                    </span>
                  )}
                  <span
                    className={`rounded-md px-2 py-0.5 font-semibold ${
                      q.button === "open" ? "border border-line text-muted" : "bg-accent text-accent-ink"
                    }`}
                  >
                    {t(BUTTON[q.button])}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function SelectedPanel({ s, t, locale }: { s: Selected; t: T; locale: Locale }) {
  const toGrant = s.steps.filter(
    (x) => x.approval?.youMay && (x.status === "pending_approval" || x.status === "proposed"),
  );
  const toAsk = s.steps.filter(
    (x) => x.approval && !x.approval.youMay && x.status !== "ready" && x.status !== "executed",
  );
  const outcomes = s.steps.filter((x) => x.outcome);
  const left = hoursText(t, s.hoursLeft);
  const decided = s.decision?.status === "decided";
  const pending = s.messages.find((m) => m.status === "approved");
  const people = [...(s.to ? [{ id: s.to.id, name: s.to.name }] : []), ...s.alternatives].filter(
    (p, i, all) => all.findIndex((x) => x.id === p.id) === i,
  );
  return (
    <Card className="flex min-w-0 flex-col gap-5" data-testid="selected-item">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Band band={s.band} score={s.score} />
          <span>{s.workstream === "opportunity" ? t("Opportunity") : t("Risk")}</span>
          <span>·</span>
          <span>{s.ownerDepartment}</span>
          <Link href={`/insights/${s.id}`} className="ms-auto text-accent">
            {t("full analysis →")}
          </Link>
        </div>
        <h2 className="text-xl font-semibold leading-snug">{s.title}</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            <span className={`num text-lg font-semibold ${s.workstream === "opportunity" ? "text-good" : "text-p1"}`}>
              {ils(s.ils)}
            </span>{" "}
            <span className="text-muted">
              {s.workstream === "opportunity" ? t("a week on offer") : t("a week at stake")}
            </span>
          </span>
          {left && <span className="text-warn">{left}</span>}
        </div>
        <p className="text-sm">{s.what}</p>
        <p className="text-sm text-muted">{s.why}</p>
        {s.decision && (
          <p className="rounded-lg bg-ground px-3 py-2 text-sm">
            <b>{t("VECTOR recommends")}:</b> {s.decision.statement}
            {decided && <span className="ms-2 text-good">· {t("decided")}</span>}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-2" data-testid="who-involved">
        <SectionTitle>{t("Who is involved")}</SectionTitle>
        <ol className="flex flex-wrap items-stretch gap-2 text-xs">
          {s.chain.map((c, k) => (
            <li key={c.department} className="flex items-center gap-2">
              {k > 0 && <span className="text-muted">→</span>}
              <span className="flex flex-col gap-1 rounded-lg border border-line px-3 py-2">
                <span className="flex items-center gap-2">
                  <b className="text-ink">{c.department}</b>
                  <Pill tone={CHAIN_TONE[c.status]}>{t(c.status)}</Pill>
                </span>
                <span className="text-muted">{c.part.join(" · ")}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>{t("Steps · {n}", { n: s.steps.length })}</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="steps">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pe-3 text-start font-normal">{t("Step")}</th>
                <th className="py-1 pe-3 text-start font-normal">{t("Owner")}</th>
                <th className="whitespace-nowrap py-1 pe-3 text-end font-normal">{t("Cost")}</th>
                <th className="whitespace-nowrap py-1 pe-3 text-end font-normal">{t("Impact")}</th>
                <th className="whitespace-nowrap py-1 pe-3 text-start font-normal">{t("Due")}</th>
                <th className="py-1 text-start font-normal">{t("Approval")}</th>
              </tr>
            </thead>
            <tbody>
              {s.steps.map((x) => (
                <tr key={x.id} className="border-t border-line align-top">
                  <td className="py-2 pe-3">
                    <span className="block font-semibold">{x.title}</span>
                    <span className="text-xs text-muted">{t(STEP_STATE[x.status] ?? x.status)}</span>
                  </td>
                  <td className="py-2 pe-3 text-xs">
                    <span className="block">{x.owner}</span>
                    <span className="text-muted">{x.department}</span>
                  </td>
                  <td className="num whitespace-nowrap py-2 pe-3 text-end text-xs">{ils(x.cost)}</td>
                  <td className="num whitespace-nowrap py-2 pe-3 text-end text-xs text-good">
                    {x.impact ? `+${ils(x.impact)}` : "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 pe-3 text-xs">{x.due ? shortDay(x.due, locale) : "—"}</td>
                  <td className="py-2 text-xs">
                    {!x.approval ? (
                      <span className="text-muted">{t("none needed")}</span>
                    ) : (
                      <>
                        <span className="block">
                          {x.approval.rules.join(", ")} → {x.approval.approvers.join(` ${t("or")} `)}
                        </span>
                        {x.approval.youMay && <span className="font-semibold text-accent">{t("you approve")}</span>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {s.canSend && s.message && s.to ? (
        <form key={s.id} action={approveAndSendAction} className="flex flex-col gap-4" data-testid="approve-form">
          <section className="flex flex-col gap-2 rounded-lg bg-ground px-4 py-3 text-sm" data-testid="will-do">
            <b>{t("When you approve, VECTOR will…")}</b>
            <ol className="flex list-decimal flex-col gap-1 ps-5">
              {s.canDecide && <li>{t("record your decision to go ahead, with your name and time;")}</li>}
              {toGrant.map((x) => (
                <li key={x.id}>{t("record your approval for “{step}”;", { step: x.title })}</li>
              ))}
              {toAsk.map((x) => (
                <li key={x.id}>
                  {t("ask {names} to approve “{step}” ({cost}) under {rules};", {
                    names: x.approval!.approvers.join(` ${t("or")} `),
                    step: x.title,
                    cost: ils(x.cost),
                    rules: x.approval!.rules.join(", "),
                  })}
                </li>
              ))}
              <li>
                {toAsk.length
                  ? t(
                      "send your message inside VECTOR once those approvals are in (nothing leaves VECTOR in the demo);",
                    )
                  : t("send your message inside VECTOR now (nothing leaves VECTOR in the demo);")}
              </li>
              {outcomes.map((x) => (
                <li key={x.id}>
                  {t("measure {kpi} over {days} days to judge whether “{step}” worked.", {
                    kpi: x.outcome!.kpi,
                    days: x.outcome!.days,
                    step: x.title,
                  })}
                </li>
              ))}
            </ol>
          </section>

          <input type="hidden" name="insightId" value={s.id} />
          <input type="hidden" name="language" value={locale === "he" ? "he" : "en"} />
          <input type="hidden" name="templateId" value={s.message.templateId} />
          <input type="hidden" name="suggestedBody" value={s.message.body} />
          {toGrant.map((x) => (
            <input key={x.id} type="hidden" name="grant" value={x.id} />
          ))}

          <fieldset className="flex flex-col gap-2" data-testid="with-whom">
            <legend className="mb-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t("With whom")}
            </legend>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-12 text-muted">{t("To")}</span>
              <select
                name="toUserId"
                defaultValue={s.to.id}
                className="rounded-lg border border-line bg-panel px-3 py-1.5"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted">
                {t("suggested: {reason}", { reason: reasonText(t, s.to.reason) })}
              </span>
            </label>
            {s.cc.length > 0 && (
              <div className="flex flex-wrap items-start gap-2 text-sm">
                <span className="w-12 pt-1 text-muted">{t("Cc")}</span>
                <span className="flex min-w-0 grow flex-col gap-1">
                  {s.cc.map((c) => (
                    <label key={c.id} className="flex flex-wrap items-center gap-2">
                      <input type="checkbox" name="cc" value={c.id} defaultChecked />
                      <span>{c.name}</span>
                      <span className="text-xs text-muted">{reasonText(t, c.reason)}</span>
                    </label>
                  ))}
                </span>
              </div>
            )}
          </fieldset>

          <section className="flex flex-col gap-2">
            <SectionTitle aside={<span className="text-xs text-muted">{t("suggested by VECTOR · edit freely")}</span>}>
              {t("Message")}
            </SectionTitle>
            <input
              name="subject"
              aria-label={t("Subject")}
              defaultValue={s.message.subject}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold"
            />
            <textarea
              name="body"
              aria-label={t("Message")}
              rows={Math.min(14, s.message.body.split("\n").length + 2)}
              defaultValue={s.message.body}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm leading-relaxed"
            />
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink">
              {t("Approve and send")}
            </button>
            <span className="text-xs text-muted">
              {t("Recorded with your name and time. Delivered inside VECTOR only.")}
            </span>
          </div>
        </form>
      ) : (
        <p className="rounded-lg bg-ground px-4 py-3 text-sm text-muted" data-testid="not-yours">
          {pending
            ? t("Approved by {name}; the message waits for the remaining approvals.", { name: pending.from })
            : s.deciders.length
              ? t("{names} decides this one. You can follow it here.", { names: s.deciders.join(` ${t("or")} `) })
              : t("You can follow this one here.")}
        </p>
      )}

      {s.canDecide && (
        <details className="text-sm" data-testid="decline">
          <summary className="cursor-pointer text-muted">{t("Decline this recommendation")}</summary>
          <form key={s.id} action={declineInCenterAction} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="insightId" value={s.id} />
            <label htmlFor="decline-reason" className="text-[13px] font-semibold">
              {t("Why (required)")}
            </label>
            <textarea
              id="decline-reason"
              name="rationale"
              rows={2}
              className="rounded-lg border border-line px-3 py-2"
            />
            <button className="self-start rounded-lg border border-ink bg-panel px-4 py-2">{t("Decline")}</button>
          </form>
        </details>
      )}

      {s.messages.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="item-messages">
          <SectionTitle>{t("Messages")}</SectionTitle>
          {s.messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-line px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Pill tone={m.status === "sent" ? "good" : m.status === "approved" ? "warn" : "neutral"}>
                  {m.status === "sent" ? t("sent") : m.status === "approved" ? t("waiting for approval") : t(m.status)}
                </Pill>
                <span>
                  {t("from {name} to {names}", { name: m.from, names: m.to.join(", ") })}
                  {m.cc.length ? ` · ${t("cc {names}", { names: m.cc.join(", ") })}` : ""}
                  {m.edited ? ` · ${t("edited")}` : ""}
                </span>
              </div>
              <b className="mt-1 block">{m.subject}</b>
              <p className="whitespace-pre-line text-muted">{m.body}</p>
            </div>
          ))}
        </section>
      )}

      <details className="text-sm" data-testid="history">
        <summary className="cursor-pointer text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
          {t("History · {n}", { n: s.history.length })}
        </summary>
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {s.history.map((h, k) => (
            <li key={k} className="flex flex-wrap gap-2">
              <span className="num whitespace-nowrap text-muted">
                {shortDay(h.at, locale)} {h.at.toISOString().slice(11, 16)}
              </span>
              <span>{t(OPERATION[h.operation] ?? h.operation)}</span>
              <span className="text-muted">· {h.actor.startsWith("system:") ? t("VECTOR") : h.actor}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
