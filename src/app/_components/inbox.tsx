/**
 * Inbox (plan v2, E7; mail-agent.md; wireframes v3 "Inbox"). What waits for you across email and Slack: decisions
 * first, then replies, each with ₪ at stake, the benefit of acting now and VECTOR's recommendation, prepared answers
 * to follow-up questions, and a suggested reply you can edit, approve and send (in VECTOR only in the demo).
 */
import Link from "next/link";
import { replyToThreadAction } from "@/app/actions";
import type { InboxView } from "@/application/facade";
import type { T } from "@/i18n/t";
import { dayTime } from "./format";
import { ils } from "./money-header";
import { Card, Pill, SectionTitle } from "./ui";

type Row = InboxView["threads"][number];
type Sel = NonNullable<InboxView["selected"]>;

const CLASS_WORD: Record<Row["cls"], string> = {
  decision: "needs a decision",
  reply: "waiting for your reply",
  recent: "asks you",
  fyi: "for your information",
  done: "answered",
};
const CLASS_TONE: Record<Row["cls"], "bad" | "warn" | "strong" | "neutral" | "good"> = {
  decision: "bad",
  reply: "warn",
  recent: "strong",
  fyi: "neutral",
  done: "good",
};
const SECTIONS: { cls: Row["cls"]; title: string }[] = [
  { cls: "decision", title: "Needs a decision" },
  { cls: "reply", title: "Waiting for your reply" },
  { cls: "recent", title: "New questions" },
  { cls: "fyi", title: "For your information" },
  { cls: "done", title: "Answered" },
];

const age = (t: T, h: number) =>
  h < 1 ? t("now") : h < 48 ? t("{h} h", { h }) : t("{d} d", { d: Math.floor(h / 24) });
const channelWord = (t: T, c: string) => (c === "slack" ? "Slack" : t("Email"));

function ThreadRow({ r, t, active }: { r: Row; t: T; active: boolean }) {
  return (
    <li>
      <Link
        href={`/inbox?t=${r.id}#thread`}
        className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 no-underline transition-colors ${active ? "border-accent bg-accent/10" : "border-line hover:border-accent/60"}`}
        data-testid="inbox-thread"
        data-cls={r.cls}
      >
        <span className="flex flex-wrap items-center gap-2 text-xs">
          <Pill tone={CLASS_TONE[r.cls]}>{t(CLASS_WORD[r.cls])}</Pill>
          <span className={r.overdue ? "font-semibold text-p1" : "text-muted"}>{age(t, r.waitingHours)}</span>
          <span className="text-muted">
            {channelWord(t, r.channel)} · {r.counterpartName}
          </span>
          {r.impactIls !== null && (
            <span className="num ms-auto font-semibold text-ink">
              {t("{money}/week at stake", { money: ils(r.impactIls) })}
            </span>
          )}
        </span>
        <span className="text-sm font-semibold text-ink">{r.subject}</span>
        {r.recommendation && r.cls !== "done" ? (
          <span className="text-[13px] text-muted">
            <b className="text-accent">{t("VECTOR recommends")}:</b> {r.recommendation}
          </span>
        ) : (
          <span className="truncate text-[13px] text-muted">{r.snippet}</span>
        )}
      </Link>
    </li>
  );
}

function ThreadView({ s, t, q, locale }: { s: Sel; t: T; q?: string; locale: string }) {
  const open = s.followUps.find((f) => f.key === q);
  const fill = (x: string, p: Record<string, string | number>) => t(x, p);
  const answered = s.cls === "done";
  return (
    <Card className="flex flex-col gap-4" data-testid="inbox-selected" id="thread">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Pill tone={CLASS_TONE[s.cls]}>{t(CLASS_WORD[s.cls])}</Pill>
            {channelWord(t, s.channel)} · {s.counterpartName}, {s.counterpartRole}
            {!s.internal && (
              <span className="rounded border border-dashed border-muted px-1">{t("outside VECTOR")}</span>
            )}
          </span>
          <h2 className="text-lg font-semibold">{s.subject}</h2>
          <span className="text-xs text-muted">{s.reasons.map((x) => t(x)).join(" · ")}</span>
        </div>
        {s.link && (
          <Link href={s.link.href} className="text-sm text-accent" data-testid="inbox-link">
            {t("Open in VECTOR")}: {s.link.title} →
          </Link>
        )}
      </div>

      <ol className="flex flex-col gap-2" data-testid="inbox-messages">
        {s.messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg border p-3 text-sm ${m.fromOwner ? "ms-8 border-accent/40 bg-accent/5" : "me-8 border-line"}`}
          >
            <span className="mb-1 flex flex-wrap gap-2 text-xs text-muted">
              <b className="text-ink">{m.fromName}</b> · {dayTime(t, new Date(m.at))}
              {m.sent && <span className="text-good">{t("sent from VECTOR")}</span>}
            </span>
            <p className="whitespace-pre-line">{m.body}</p>
          </li>
        ))}
      </ol>

      {(s.impactIls !== null || s.costIls !== null || s.deadline || s.benefit || s.recommendation) && (
        <div className="flex flex-col gap-3" data-testid="inbox-impact">
          <dl className="grid grid-cols-3 gap-2 rounded-lg border border-line p-3 text-center">
            <div>
              <dt className="text-[11px] text-muted">{t("at stake")}</dt>
              <dd className="num font-semibold">{s.impactIls !== null ? `${ils(s.impactIls)}${t("/wk")}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">{t("cost")}</dt>
              <dd className="num font-semibold">{s.costIls !== null ? ils(s.costIls) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">{t("deadline")}</dt>
              <dd className="num font-semibold">{s.deadline ? dayTime(t, new Date(s.deadline)) : "—"}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
            {s.benefit && (
              <p>
                <b>{t("Benefit of acting now")}:</b> {s.benefit}
              </p>
            )}
            {s.recommendation && (
              <p>
                <b className="text-accent">{t("VECTOR recommends")}:</b> {s.recommendation}
              </p>
            )}
          </div>
        </div>
      )}

      {s.followUps.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="inbox-followups">
          <span className="text-xs text-muted">{t("Ask before you decide")}</span>
          <div className="flex flex-wrap gap-2">
            {s.followUps.map((f) => (
              <Link
                key={f.key}
                href={`/inbox?t=${s.id}&q=${f.key}#thread`}
                className={`rounded-full border px-3 py-1 text-xs no-underline ${q === f.key ? "border-accent bg-accent/10 text-accent" : "border-line text-ink hover:border-accent/60"}`}
                data-testid="followup"
              >
                {t(f.q)}
              </Link>
            ))}
          </div>
          {open && (
            <p
              className="rounded-md border-s-2 border-accent bg-accent/5 px-3 py-2 text-sm"
              data-testid="followup-answer"
            >
              <b>{t(open.q)}</b> {fill(open.a, open.params)}
            </p>
          )}
          <span className="text-[11px] text-muted">
            {t("Prepared answers from VECTOR's data. Free-form questions come with the AI stage.")}
          </span>
        </div>
      )}

      {s.suggestedReply && !answered && (
        <form action={replyToThreadAction} className="flex flex-col gap-2" data-testid="inbox-reply">
          <input type="hidden" name="thread" value={s.id} />
          <input type="hidden" name="suggested" value={s.suggestedReply} />
          <input type="hidden" name="language" value={locale} />
          <label className="text-xs text-muted" htmlFor="reply-body">
            {t("Suggested reply: edit it if you like, then approve and send")}
          </label>
          <textarea
            id="reply-body"
            name="body"
            defaultValue={s.suggestedReply}
            rows={4}
            className="rounded-lg border border-line bg-ground/60 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
              data-testid="send-reply"
            >
              {t("Approve and send")}
            </button>
            <span className="text-xs text-muted">
              {s.internal
                ? t("Delivered to {name} in VECTOR; audited.", { name: s.counterpartName })
                : t("Recorded and audited; outside parties are not contacted in the demo.")}
            </span>
          </div>
        </form>
      )}
    </Card>
  );
}

export function InboxScreen({ v, t, q, locale }: { v: InboxView; t: T; q?: string; locale: string }) {
  const top = v.threads.filter((r) => r.cls === "decision" || r.cls === "reply");
  const atStake = top.reduce((a, r) => a + (r.impactIls ?? 0), 0);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-tight">{t("Inbox")}</h1>
          <p className="text-sm text-muted" data-testid="inbox-summary">
            {t("{reply} wait for your reply · {decision} need a decision · {total} threads in the last 7 days", {
              reply: v.counts.reply,
              decision: v.counts.decision,
              total: v.counts.total,
            })}
          </p>
        </div>
        <span className="rounded border border-dashed border-muted px-2 py-0.5 text-xs text-muted">
          {t("Email + Slack · synthetic in the demo")}
        </span>
      </div>
      {top.length > 0 && (
        <p
          className="rounded-md border-s-2 border-accent bg-accent/5 px-3 py-2 text-[13px] leading-relaxed"
          data-testid="takeaway"
        >
          <b className="text-accent">{t("What it means")}:</b>{" "}
          {t("{n} threads need you; {money} a week rides on them. Start with: {first}.", {
            n: top.length,
            money: ils(atStake),
            first: top[0].subject,
          })}
        </p>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {SECTIONS.map((sec) => {
            const rows = v.threads.filter((r) => r.cls === sec.cls);
            if (!rows.length) return null;
            return (
              <Card key={sec.cls} className="flex flex-col gap-2" data-testid={`inbox-${sec.cls}`}>
                <SectionTitle aside={<span className="text-xs text-muted">{rows.length}</span>}>
                  {t(sec.title)}
                </SectionTitle>
                <ul className="flex flex-col gap-2">
                  {rows.map((r) => (
                    <ThreadRow key={r.id} r={r} t={t} active={v.selected?.id === r.id} />
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20">
          {v.selected ? (
            <ThreadView s={v.selected} t={t} q={q} locale={locale} />
          ) : (
            <Card>
              <p className="text-sm text-muted">
                {t("Choose a thread to see its impact, VECTOR's recommendation and a suggested reply.")}
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
