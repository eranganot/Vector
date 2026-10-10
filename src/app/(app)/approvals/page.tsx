import Link from "next/link";
import { demoNow } from "@/application/facade";
import { api } from "@/app/_lib/api";
import type { ApprovalRequirement } from "@/domain/policy/approval-rules";
import { approveAction } from "../../actions";
import { Band, Card, Notice, Pill, SectionTitle } from "../../_components/ui";
import { getLocale, getT } from "../../_lib/locale";
import { shortDay, dayTime } from "../../_components/format";
import { requireActor } from "../../_lib/session";

const ROLE_LABEL: Record<string, string> = {
  executive: "Executive",
  department_manager: "Department Manager",
  regional_manager: "Regional Manager",
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
  const { actor } = await requireActor();
  const t = await getT();
  const [items, decisions, mine, now, history, messages, locale] = await Promise.all([
    api.myApprovals(actor),
    api.myDecisions(actor),
    api.myActions(actor),
    demoNow(),
    api.approvalHistory(actor),
    api.messagesForMe(actor),
    getLocale(),
  ]);
  const ACTION_STATE: Record<string, string> = {
    proposed: t("Waiting for the decision"),
    pending_approval: t("Waiting for approval"),
    ready: t("Ready to execute"),
    executing: t("Executing"),
    failed: t("Failed: retry or cancel"),
  };
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">{t("Waiting on you")}</h1>
        <p className="text-sm text-muted">
          {decisions.length === 1
            ? t("{n} decision to make", { n: decisions.length })
            : t("{n} decisions to make", { n: decisions.length })}{" "}
          ·{" "}
          {items.length === 1
            ? t("{n} approval to give", { n: items.length })
            : t("{n} approvals to give", { n: items.length })}{" "}
          ·{" "}
          {mine.length === 1
            ? t("{n} of your action in flight", { n: mine.length })
            : t("{n} of your actions in flight", { n: mine.length })}
        </p>
      </div>
      {messages.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="messages-for-you">
          <SectionTitle aside={<span className="text-xs text-muted">{t("delivered in VECTOR only")}</span>}>
            {t("Messages for you · {n}", { n: messages.length })}
          </SectionTitle>
          {messages.map((m) => (
            <Card key={m.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>
                  {m.copy ? t("{name} copied you", { name: m.from }) : t("from {name}", { name: m.from })} ·{" "}
                  {shortDay(m.sentAt, locale)}
                </span>
                <Link href={`/insights/${m.insightId}`} className="ms-auto text-accent">
                  {t("full analysis →")}
                </Link>
              </div>
              <b>{m.subject}</b>
              <p className="whitespace-pre-line text-sm text-muted">{m.body}</p>
            </Card>
          ))}
        </section>
      )}
      <section className="flex flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">{t("VECTOR recommends; you decide")}</span>}>
          {t("Decisions to make · {n}", { n: decisions.length })}
        </SectionTitle>
        {decisions.length === 0 && (
          <p className="text-sm text-muted">{t("No recommendation is waiting for your decision.")}</p>
        )}
        {decisions.map((d) => (
          <Link
            key={d.decisionId}
            href={`/insights/${d.insightId}`}
            className="flex flex-wrap items-start gap-4 rounded-xl border border-line bg-panel/90 px-4 py-3.5 no-underline hover:border-accent/60"
          >
            <Band band={d.band} score={d.score} />
            <span className="flex min-w-0 grow flex-col gap-1">
              <span className="text-[15px] font-semibold">{d.title}</span>
              <span className="text-[13px] text-muted">
                {t("Recommendation: {statement}", { statement: d.statement })}
              </span>
            </span>
            <span className="text-sm text-accent">{t("Accept or decline →")}</span>
          </Link>
        ))}
      </section>
      <SectionTitle>{t("Approvals to give · {n}", { n: items.length })}</SectionTitle>
      <Notice
        error={error}
        done={
          done === "grant"
            ? t("Approved. Execution started (simulated).")
            : done === "deny"
              ? t("Denied. The action is rejected.")
              : undefined
        }
      />
      {items.length === 0 && <p className="text-sm text-muted">{t("No approval request is waiting for you.")}</p>}
      {items.map(({ approval, action, insightTitle, band, insightId, alsoAsked, targetNames }) => {
        const req = approval.requirement as ApprovalRequirement;
        const matched = req.rules.filter((r) => r.matched);
        const hoursLeft = Math.max(0, 72 - (now.getTime() - approval.requestedAt.getTime()) / 3_600_000);
        return (
          <Card key={approval.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Band band={band} />
              <span className="text-muted">
                {t("For insight: {title}", { title: insightTitle })} ·{" "}
                <Link href={`/insights/${insightId}`} className="underline">
                  {t("open full trace")}
                </Link>
              </span>
            </div>
            <h2 className="text-xl font-semibold">{action.title}</h2>
            <div className="flex flex-col gap-1 rounded-lg bg-ground px-4 py-3 text-sm">
              <b>{t("Why you are asked")}</b>
              {matched.map((r) => (
                <span key={r.rule}>
                  {r.rule} {r.name} ({r.reason}) →{" "}
                  {[...new Set(r.eligible.map((o) => (ROLE_LABEL[o.role] ? t(ROLE_LABEL[o.role]) : o.role)))].join(
                    ` ${t("or")} `,
                  )}
                </span>
              ))}
              <span className="text-[13px] text-muted">
                {t("You are eligible under every rule, and you neither proposed nor own this action.")}{" "}
                {alsoAsked.length > 0
                  ? t("Also asked: {names} (the first answer counts).", { names: alsoAsked.join(", ") })
                  : t("Nobody else is asked.")}
              </span>
            </div>
            <div className="font-mono text-[13px] text-muted">
              {t("Cost")} <span className="num">₪{Number(action.estimatedCost).toLocaleString("en-US")}</span> ·{" "}
              {t("for {names}", { names: targetNames.join(", ") })}
              {action.dueAt ? (
                <>
                  {" "}
                  · {t("due")} <span className="num">{dayTime(t, action.dueAt)}</span>
                </>
              ) : (
                ""
              )}{" "}
              · {t("revision")} <span className="num">{action.revision}</span> ·{" "}
              <span className={hoursLeft < 12 ? "text-warn" : ""}>
                {t("request expires in about {hours} h (demo clock); unanswered, it goes back to the owner", {
                  hours: Math.round(hoursLeft),
                })}
              </span>
            </div>
            <form action={approveAction} className="flex flex-col gap-3">
              <input type="hidden" name="actionId" value={action.id} />
              <label htmlFor={`note-${approval.id}`} className="text-[13px] font-semibold">
                {t("Note (required if you deny)")}
              </label>
              <textarea
                id={`note-${approval.id}`}
                name="rationale"
                rows={2}
                className="rounded-lg border border-line px-3 py-2"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  name="verdict"
                  value="grant"
                  className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink"
                >
                  {t("Approve")}
                </button>
                <button name="verdict" value="deny" className="rounded-lg border border-ink bg-panel px-5 py-2.5">
                  {t("Deny")}
                </button>
                <span className="text-xs text-muted">
                  {t("Recorded with your name, time and session. Silence never approves.")}
                </span>
              </div>
            </form>
          </Card>
        );
      })}
      <section className="flex flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">{t("actions you own")}</span>}>
          {t("Your actions in flight · {n}", { n: mine.length })}
        </SectionTitle>
        {mine.length === 0 && <p className="text-sm text-muted">{t("You own no open actions.")}</p>}
        {mine.map(({ action: a, insightTitle, insightId, band, waitingOn }) => (
          <Link
            key={a.id}
            href={`/insights/${insightId}`}
            className="flex flex-wrap items-start gap-4 rounded-xl border border-line bg-panel/90 px-4 py-3.5 no-underline hover:border-accent/60"
          >
            <Band band={band} />
            <span className="flex min-w-0 grow flex-col gap-1">
              <span className="text-[15px] font-semibold">{a.title}</span>
              <span className="text-[13px] text-muted">
                {insightTitle}
                {waitingOn.length > 0 && ` · ${t("approver: {names}", { names: waitingOn.join(` ${t("or")} `) })}`}
              </span>
            </span>
            <Pill tone={a.status === "pending_approval" ? "warn" : a.status === "failed" ? "bad" : "neutral"}>
              {ACTION_STATE[a.status] ?? a.status}
            </Pill>
          </Link>
        ))}
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">{t("recorded in the audit trail")}</span>}>
          {t("Your recent answers · {n}", { n: history.length })}
        </SectionTitle>
        {history.length === 0 ? (
          <p className="text-sm text-muted">{t("You have not answered an approval request yet.")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line/60 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 py-2">
                <Band band={h.band} />
                <Pill tone={h.status === "granted" ? "good" : h.status === "denied" ? "bad" : "neutral"}>
                  {h.status === "granted" ? t("Approved") : h.status === "denied" ? t("Denied") : h.status}
                </Pill>
                <Link href={`/insights/${h.insightId}`} className="min-w-0 no-underline hover:underline">
                  {h.actionTitle}
                </Link>
                <span className="text-xs text-muted">
                  {t("rev")} <span className="num">{h.revision}</span>
                  {h.decidedAt && (
                    <>
                      {" "}
                      · <span className="num">{dayTime(t, h.decidedAt)}</span>
                    </>
                  )}
                  {h.rationale ? ` · “${h.rationale}”` : ""} ·{" "}
                  {t("now {status}", { status: h.actionStatus.replace("_", " ") })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
