/**
 * From event to action plan (plan v2, E4d; Eran's E4 review): the tasks a meeting produced, each saying what it is, who
 * owns it, where it stands against its date (late is red), what waits on it in other departments, and the ₪ of doing
 * it, of not doing it and of each week it slips (knock-on-v1). One next step per task.
 */
import Link from "next/link";
import type { EventPlan as EventPlanView } from "@/application/facade";
import type { Locale } from "@/i18n/locale";
import type { T } from "@/i18n/t";
import { shortDay } from "./format";
import { ils } from "./money-header";
import { Card, SectionTitle } from "./ui";

type Task = EventPlanView["tasks"][number];

export const FLOW_HEX: Record<Task["flowStatus"], string> = {
  late: "#f87171",
  at_risk: "#fbbf24",
  due_soon: "#fbbf24",
  on_track: "#34d399",
  done: "#8fa1bc",
};

function statusText(t: T, x: Task, locale: Locale) {
  switch (x.flowStatus) {
    case "late":
      return x.overdueDays > 0
        ? t("Late · {n} d past {day}", { n: x.overdueDays, day: shortDay(x.due, locale) })
        : t("Late · due {day}", { day: shortDay(x.due, locale) });
    case "at_risk":
      return t("At risk · lands {n} d late", { n: x.daysLate });
    case "due_soon":
      return x.daysLeft !== null && x.daysLeft <= 0
        ? t("Due today")
        : t("Due in {n} d · {day}", { n: x.daysLeft ?? 0, day: shortDay(x.due, locale) });
    case "on_track":
      return t("On track · due {day}", { day: shortDay(x.due, locale) });
    default:
      return t("Done");
  }
}

function nextStep(t: T, x: Task, locale: Locale) {
  const first = x.owner.split(" ")[0];
  if (x.flowStatus === "done") return t("Nothing to do: delivered.");
  if (x.flowStatus === "late")
    return x.slackDays !== null && x.slackDays >= 0
      ? t("Ask {name} for a firm date before {day}, when {unit} needs it.", {
          name: first,
          day: shortDay(x.waiting[0]?.needBy ?? x.due, locale),
          unit: x.waiting.map((w) => w.unitName)[0] ?? "",
        })
      : t("Escalate: ask {name} for a new date, or add help.", { name: first });
  if (x.flowStatus === "at_risk")
    return t("Unblock it: {what} ({unit}) is late.", {
      what: x.waitsOn[0]?.title ?? "",
      unit: x.waitsOn[0]?.unitName ?? "",
    });
  if (x.flowStatus === "due_soon")
    return t("Confirm with {name} that it lands on {day}.", { name: first, day: shortDay(x.due, locale) });
  return t("Nothing to do now; VECTOR watches the date.");
}

function TaskCard({ x, t, locale }: { x: Task; t: T; locale: Locale }) {
  const color = FLOW_HEX[x.flowStatus];
  const href = x.insightId ? `/action-center?item=${x.insightId}` : "/commitments";
  return (
    <li
      data-testid="event-task"
      data-status={x.flowStatus}
      className="grid gap-3 rounded-lg border border-line bg-ground/40 p-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,4fr)]"
      style={{ borderInlineStartWidth: 4, borderInlineStartColor: color }}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className="self-start whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold"
          style={{ background: `${color}22`, color }}
          data-testid="event-task-status"
        >
          {statusText(t, x, locale)}
        </span>
        <b className="text-[15px] leading-snug">{x.title}</b>
        <span className="text-xs text-muted">{t("{name} · {unit}", { name: x.owner, unit: x.unitName })}</span>
        {x.detail && <span className="text-xs text-muted">{x.detail}</span>}
        <span className="mt-1 text-[13px]">
          <b>{t("Next step")}:</b> {nextStep(t, x, locale)}
        </span>
        <Link href={href} className="text-xs text-accent">
          {x.insightId ? t("Make it an action →") : t("Open in Commitments →")}
        </Link>
      </div>

      <div className="flex min-w-0 flex-col gap-1 text-[13px]">
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t("Who waits on it")}</span>
        {x.waiting.length === 0 ? (
          <span className="text-muted">{t("No other department waits on it.")}</span>
        ) : (
          <ul className="flex flex-col gap-1">
            {x.waiting.map((w, k) => (
              <li key={k} className="flex flex-col">
                <span>
                  <b>{w.unitName}</b> · {w.what}
                </span>
                <span className={`text-xs ${w.daysLate > 0 ? "text-p1" : "text-muted"}`}>
                  {t("needs it by {day}", { day: shortDay(w.needBy, locale) })} ·{" "}
                  {t("{v} a week at stake", { v: ils(w.weeklyIls) })}
                  {w.daysLate > 0 ? ` · ${t("gets it {n} d late", { n: w.daysLate })}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {x.waitsOn.length > 0 && (
          <span className="text-xs text-warn">
            {t("Waits on {list}", { list: x.waitsOn.map((u) => `${u.title} (${u.unitName})`).join(", ") })}
          </span>
        )}
      </div>

      <dl
        className="grid content-start grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]"
        data-testid="event-task-money"
      >
        <dt className="text-muted">{t("Cost to do")}</dt>
        <dd className="num font-semibold">{x.costIls === null ? "—" : ils(x.costIls)}</dd>
        <dt className="text-muted">{t("At stake if not done")}</dt>
        <dd className="num font-semibold text-p1">{t("{v} a week", { v: ils(x.weeklyIls) })}</dd>
        {x.weekLate && (
          <>
            <dt className="text-muted">{t("Each week it slips")}</dt>
            <dd>
              <span className="num font-semibold text-p1">+{ils(x.weekLate.extraIls)}</span>
              {x.weekLate.units.length > 0 && (
                <span className="block text-xs text-muted">
                  {t("late for {list}", { list: x.weekLate.units.join(", ") })}
                </span>
              )}
            </dd>
          </>
        )}
        <dt className="text-muted">{t("Lost so far")}</dt>
        <dd className={`num font-semibold ${x.lostIls > 0 ? "text-p1" : "text-good"}`}>
          {ils(x.lostIls)}
          {x.flowStatus !== "done" && x.slackDays !== null && x.slackDays >= 0 && (
            <span className="block text-xs font-normal text-muted">
              {x.slackDays === 0
                ? t("last day before others are hit")
                : t("{n} d before others are hit", { n: x.slackDays })}
            </span>
          )}
        </dd>
      </dl>
    </li>
  );
}

export function EventPlan({ e, t, locale }: { e: EventPlanView; t: T; locale: Locale }) {
  const tiles = [
    { k: "late", n: e.counts.late, label: t("late"), color: FLOW_HEX.late },
    { k: "risk", n: e.counts.atRisk, label: t("at risk or due soon"), color: FLOW_HEX.at_risk },
    { k: "track", n: e.counts.onTrack, label: t("on track"), color: FLOW_HEX.on_track },
    { k: "done", n: e.counts.done, label: t("done"), color: FLOW_HEX.done },
  ];
  return (
    <Card className="flex flex-col gap-4" data-testid="event-plan">
      <SectionTitle
        aside={
          <Link href="/commitments" className="text-xs text-accent">
            {t("all commitments →")}
          </Link>
        }
      >
        {t("From event to action plan")}
      </SectionTitle>
      <div className="flex flex-col gap-1">
        <p className="text-[15px]">
          <b>{e.source}</b>{" "}
          <span className="text-muted">
            {t("produced {n} tasks. Other departments depend on them: {d} departments are involved.", {
              n: e.tasks.length,
              d: e.departments,
            })}
          </span>
        </p>
        <p className="text-xs text-muted">
          {t(
            "Each task is a commitment made at the meeting. VECTOR tracks it against its date and against what other departments need from it, and prices the delay.",
          )}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {tiles.map((x) => (
          <div key={x.k} className="rounded-lg border border-line px-3 py-2">
            <span className="num block text-xl font-semibold" style={{ color: x.color }}>
              {x.n}
            </span>
            <span className="text-xs text-muted">{x.label}</span>
          </div>
        ))}
        <div className="rounded-lg border border-line px-3 py-2">
          <span className="num block text-xl font-semibold text-p1">{ils(e.weeklyAtStake)}</span>
          <span className="text-xs text-muted">{t("a week depends on the open tasks")}</span>
        </div>
        <div className="rounded-lg border border-line px-3 py-2">
          <span className={`num block text-xl font-semibold ${e.lostIls > 0 ? "text-p1" : "text-good"}`}>
            {ils(e.lostIls)}
          </span>
          <span className="text-xs text-muted">{t("lost so far to delays")}</span>
        </div>
      </div>
      <ol className="flex flex-col gap-2">
        {e.tasks.map((x) => (
          <TaskCard key={x.id} x={x} t={t} locale={locale} />
        ))}
      </ol>
    </Card>
  );
}
