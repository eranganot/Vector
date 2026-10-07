/**
 * The Cross-department tab (plan v2, E3; cross-department.md §3 layout v3, wireframes v3 screen 4): portfolio rings,
 * the selected initiative's progress map and milestones, and — top right — what waits on the viewer, each with one
 * button. Then the deviations (M1–M5), on-time delivery, barriers, and every initiative in a table. No data access.
 */
import Link from "next/link";
import type { InitiativesView, WorkItem, YourItem } from "@/application/facade";
import type { T } from "@/i18n/t";
import {
  completeMilestoneAction,
  moveMilestoneAction,
  raiseBarrierAction,
  resolveBarrierAction,
  sendReminderAction,
} from "../actions";
import { ils } from "./money-header";
import { Card } from "./ui";

type V = InitiativesView;
type Item = V["items"][number];
type Flag = Item["flags"][number];

const HEX = { good: "#34d399", watch: "#fbbf24", bad: "#f87171", accent: "#22d3ee", muted: "#8fa1bc", line: "#22334f" };
const STATUS_HEX: Record<Item["status"], string> = {
  on_track: HEX.good,
  at_risk: HEX.watch,
  blocked: HEX.bad,
  done: HEX.accent,
};
const STATUS_WORD: Record<Item["status"], string> = {
  on_track: "on track",
  at_risk: "at risk",
  blocked: "blocked",
  done: "done",
};
const STATE_HEX: Record<string, string> = { planned: HEX.accent, at_risk: HEX.watch, late: HEX.bad, done: HEX.good };
const STATE_WORD: Record<string, string> = { planned: "planned", at_risk: "at risk", late: "late", done: "done" };
const STEP_IN_WORD: Record<Flag["stepIn"], string> = {
  sponsor: "sponsor",
  common_manager: "common manager",
  ceo_coo: "CEO / COO",
  cfo_sponsor: "CFO and sponsor",
};

/** One sentence per rule, in the reader's language, from the rule's numbers (ADR-007). */
export function flagText(t: T, rule: Flag["rule"], facts: Flag["facts"], subject: string) {
  switch (rule) {
    case "M1":
      return t("Blocked {n} days: {title}", { n: facts.days ?? 0, title: subject });
    case "M2":
      return facts.days
        ? t("{title}: {n} days late", { title: subject, n: facts.days })
        : t("{title}: at risk, due {date}", { title: subject, date: (facts.due ?? "").slice(5) });
    case "M3":
      return t("Open conflict: {title}", { title: subject });
    case "M4":
      return facts.overLimit
        ? t("Decision over ₪250k: {title}", { title: subject })
        : t("Decision between units: {title}", { title: subject });
    case "M5":
      return facts.spent
        ? t("Spent {pct}% of budget", { pct: facts.pct ?? 0 })
        : t("Projected to spend {pct}% of budget", { pct: facts.pct ?? 0 });
  }
}

function Ring({ value, color, size = 64, label }: { value: number; color: string; size?: number; label?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={HEX.line} strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size / 4.2}
        fontWeight="600"
        fill="#e6edf7"
      >
        {label ?? `${Math.round(value)}%`}
      </text>
    </svg>
  );
}

function Title({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {aside && <span className="text-xs text-muted">{aside}</span>}
    </div>
  );
}

function Chip({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="num inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ borderColor: `${color}99`, color, background: `${color}1a` }}
    >
      {children}
    </span>
  );
}

// ── Portfolio ──────────────────────────────────────────────────────────────────

function Portfolio({ v, t }: { v: V; t: T }) {
  return (
    <Card className="min-w-0" data-testid="portfolio">
      <Title aside={t("progress ring · colour = status")}>{t("Portfolio")}</Title>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {v.items.map((i) => {
          const sel = v.selected?.key === i.key;
          return (
            <li key={i.key} className="shrink-0">
              <Link
                href={`/initiatives?i=${i.key}`}
                data-testid="portfolio-item"
                aria-current={sel ? "true" : undefined}
                title={`${i.title} · ${t(STATUS_WORD[i.status])} · ${i.progress}%`}
                className={`flex w-32 flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center no-underline ${sel ? "border-accent bg-accent/5" : "border-line hover:border-accent/60"}`}
              >
                <Ring value={i.progress} color={STATUS_HEX[i.status]} size={58} />
                <span className="line-clamp-2 text-xs leading-tight text-ink">{i.title}</span>
                <span className="flex min-h-5 flex-wrap justify-center gap-1">
                  {[...new Set(i.flags.map((f) => f.rule))].map((r) => (
                    <Chip key={r} color={r === "M1" || r === "M4" || r === "M5" ? HEX.bad : HEX.watch}>
                      {r}
                    </Chip>
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Progress map ───────────────────────────────────────────────────────────────

function ProgressMap({ i, t }: { i: Item; t: T }) {
  const depts = i.participants
    .map((p) => {
      const ms = i.milestones.filter((m) => m.ownerUnitId === p.id);
      const current = ms.filter((m) => !m.doneOn).sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0] ?? ms.at(-1);
      const progress = ms.length ? ms.reduce((a, m) => a + m.progress, 0) / ms.length : 0;
      const blocked = i.barriers.some((b) => b.ownerUnitId === p.id);
      const state = !ms.length ? "none" : blocked ? "late" : (current?.state ?? "done");
      return { ...p, ms, current, progress, state, start: ms.map((m) => m.startsOn).sort()[0] ?? "9999" };
    })
    .filter((d) => d.ms.length > 0)
    .sort((a, b) => a.start.localeCompare(b.start));
  const W = 640;
  const H = 190;
  const n = Math.max(1, depts.length);
  const x = (k: number) => (W / n) * (k + 0.5);
  const cy = 62;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={t("Progress map")}
      data-testid="progress-map"
    >
      {depts.slice(1).map((d, k) => {
        const waiting = d.state === "late" || d.state === "at_risk";
        return (
          <line
            key={`l${d.id}`}
            x1={x(k) + 34}
            y1={cy}
            x2={x(k + 1) - 34}
            y2={cy}
            stroke={waiting ? HEX.bad : HEX.accent}
            strokeWidth="2.5"
            strokeDasharray={waiting ? "6 5" : undefined}
          >
            <title>{waiting ? t("{name} is waiting or late", { name: d.name }) : t("on track")}</title>
          </line>
        );
      })}
      {depts.map((d, k) => {
        const color = STATE_HEX[d.state] ?? HEX.muted;
        const r = 28;
        const c = 2 * Math.PI * r;
        return (
          <g key={d.id}>
            <title>
              {`${d.name}: ${Math.round(d.progress)}% · ${d.current ? `${d.current.title} (${t(STATE_WORD[d.current.state])}, ${d.current.dueOn.slice(5)})` : ""}`}
            </title>
            <circle cx={x(k)} cy={cy} r={r} fill="#0f1a2c" stroke={HEX.line} strokeWidth="6" />
            <circle
              cx={x(k)}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(d.progress / 100) * c} ${c}`}
              transform={`rotate(-90 ${x(k)} ${cy})`}
            />
            <text x={x(k)} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="600" fill="#e6edf7">
              {`${Math.round(d.progress)}%`}
            </text>
            <text x={x(k)} y={cy + r + 20} textAnchor="middle" fontSize="12" fill="#e6edf7">
              {d.name.length > 18 ? `${d.name.slice(0, 17)}…` : d.name}
            </text>
            {d.current && (
              <>
                <text x={x(k)} y={cy + r + 36} textAnchor="middle" fontSize="10.5" fill="#8fa1bc">
                  {d.current.title.length > 24 ? `${d.current.title.slice(0, 23)}…` : d.current.title}
                </text>
                <text x={x(k)} y={cy + r + 51} textAnchor="middle" fontSize="10.5" fill={STATE_HEX[d.current.state]}>
                  {`${t(STATE_WORD[d.current.state])} · ${d.current.dueOn.slice(5)}`}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Milestones (Gantt) ─────────────────────────────────────────────────────────

const dayNum = (d: string) => Date.parse(`${d}T12:00:00Z`) / 86_400_000;

function Gantt({ i, today, t }: { i: Item; today: string; t: T }) {
  const ms = [...i.milestones].sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.dueOn.localeCompare(b.dueOn));
  const lo = Math.min(...ms.map((m) => dayNum(m.startsOn)), dayNum(today)) - 2;
  const hi = Math.max(...ms.map((m) => dayNum(m.dueOn)), dayNum(today)) + 3;
  const W = 640;
  const left = 190;
  const row = 26;
  const top = 22;
  const H = top + ms.length * row + 8;
  const x = (d: string) => left + ((dayNum(d) - lo) / (hi - lo)) * (W - left - 12);
  // Month ticks
  const months: string[] = [];
  for (let d = new Date((lo + 1) * 86_400_000); d.getTime() / 86_400_000 < hi; d.setUTCMonth(d.getUTCMonth() + 1, 1)) {
    const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
    if (dayNum(iso) >= lo) months.push(iso);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Milestones")} data-testid="gantt">
      {months.map((m) => (
        <g key={m}>
          <line x1={x(m)} x2={x(m)} y1={top - 6} y2={H} stroke={HEX.line} />
          <text x={x(m) + 3} y={12} fontSize="10" fill="#8fa1bc">
            {m.slice(0, 7)}
          </text>
        </g>
      ))}
      {ms.map((m, k) => {
        const y = top + k * row;
        const color = STATE_HEX[m.state];
        const end = m.doneOn && m.doneOn > m.dueOn ? m.doneOn : m.dueOn;
        const w = Math.max(3, x(end) - x(m.startsOn));
        return (
          <a key={m.id} href={`/initiatives?i=${i.key}&item=ms:${m.id}#item`}>
            <title>
              {`${m.ownerName} · ${m.title}: ${m.startsOn.slice(5)} → ${m.dueOn.slice(5)} · ${m.progress}% · ${t(STATE_WORD[m.state])}${m.moves ? ` · ${t("moved {n}×", { n: m.moves })}` : ""}`}
            </title>
            <text x={0} y={y + 10} fontSize="11" fill="#e6edf7">
              {m.title.length > 26 ? `${m.title.slice(0, 25)}…` : m.title}
            </text>
            <text x={0} y={y + 21} fontSize="9.5" fill="#8fa1bc">
              {m.ownerName}
            </text>
            <rect x={x(m.startsOn)} y={y + 3} width={w} height={12} rx="3" fill={`${color}33`} stroke={`${color}aa`} />
            <rect
              x={x(m.startsOn)}
              y={y + 3}
              width={(w * m.progress) / 100}
              height={12}
              rx="3"
              fill={color}
              opacity="0.75"
            />
            <path
              d={`M${x(m.dueOn)},${y + 2} l6,7 l-6,7 l-6,-7z`}
              fill={m.state === "late" ? HEX.bad : m.doneOn ? HEX.good : "#e6edf7"}
            />
          </a>
        );
      })}
      <line
        x1={x(today)}
        x2={x(today)}
        y1={top - 8}
        y2={H}
        stroke={HEX.accent}
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      <text x={x(today) + 3} y={top - 10} fontSize="10" fill={HEX.accent}>
        {t("today")}
      </text>
    </svg>
  );
}

// ── Your action items ──────────────────────────────────────────────────────────

const btnPrimary = "rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-ink";
const btnSecondary = "rounded-md border border-line px-3 py-1 text-xs text-ink hover:border-accent";

function YourItemRow({ y, i, v, t }: { y: YourItem; i: Item; v: V; t: T }) {
  const key = <input type="hidden" name="key" value={i.key} />;
  const reason = y.rule && y.facts ? flagText(t, y.rule, y.facts, y.title) : y.detail;
  const line = (title: string, detail: string, button: React.ReactNode) => (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
      <span className="min-w-0">
        <span className="block text-sm text-ink">{title}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
      {button}
    </div>
  );
  switch (y.kind) {
    case "approve":
      return line(
        y.title,
        y.detail,
        <Link href={y.href!} className={`${btnPrimary} no-underline`}>
          {t("Approve")}
        </Link>,
      );
    case "decide":
      return line(
        y.title,
        y.detail,
        <Link href={y.href!} className={`${btnPrimary} no-underline`}>
          {t("Decide")}
        </Link>,
      );
    case "settle":
      return line(
        t("Settle {title}", { title: y.title }),
        t("open conflict between two participating units"),
        <Link href={y.href!} className={`${btnPrimary} no-underline`}>
          {t("Decide")}
        </Link>,
      );
    case "remind":
    case "reforecast": {
      const body =
        y.kind === "reforecast"
          ? t("{initiative}: {reason}. Please send a re-forecast and the plan to bring spend back within budget.", {
              initiative: i.title,
              reason,
            })
          : t("{initiative}: {reason}. What do you need to close it, and by when?", { initiative: i.title, reason });
      return (
        <form action={sendReminderAction} className="flex flex-col gap-1.5">
          {key}
          <input type="hidden" name="initiativeId" value={i.id} />
          <input type="hidden" name="toUnitId" value={y.toUnitId} />
          <input type="hidden" name="subjectKind" value={y.subjectKind} />
          {y.subjectId && <input type="hidden" name="subjectId" value={y.subjectId} />}
          {line(
            y.kind === "reforecast"
              ? t("Ask {unit} for a re-forecast", { unit: y.unitName ?? "" })
              : t("Nudge {unit}", { unit: y.unitName ?? "" }),
            reason,
            <button className={btnPrimary}>{y.kind === "reforecast" ? t("Ask") : t("Send reminder")}</button>,
          )}
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">{t("Edit the message")}</summary>
            <textarea
              name="body"
              defaultValue={body}
              rows={3}
              className="mt-1 w-full rounded-md border border-line bg-ground p-2 text-xs text-ink"
            />
          </details>
          <span className="text-[11px] text-muted">{t("Sent inside VECTOR (demo)")}</span>
        </form>
      );
    }
    case "resolve":
      return (
        <form action={resolveBarrierAction} className="flex flex-col gap-1.5">
          {key}
          <input type="hidden" name="barrierId" value={y.barrierId} />
          {line(
            t("Decide: {title}", { title: y.title }),
            reason,
            <button className={btnPrimary}>{t("Resolve")}</button>,
          )}
          <textarea
            name="resolution"
            required
            minLength={5}
            rows={2}
            placeholder={t("What did you decide?")}
            className="w-full rounded-md border border-line bg-ground p-2 text-xs text-ink"
          />
        </form>
      );
    case "milestone":
      return (
        <div className="flex flex-col gap-1.5">
          <form action={completeMilestoneAction}>
            {key}
            <input type="hidden" name="milestoneId" value={y.milestoneId} />
            {line(
              y.title,
              t("your milestone · due {date}", { date: y.detail.slice(5) }),
              <button className={btnSecondary}>{t("Mark done")}</button>,
            )}
          </form>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">{t("Move the date")}</summary>
            <form action={moveMilestoneAction} className="mt-1 flex flex-wrap items-center gap-2">
              {key}
              <input type="hidden" name="milestoneId" value={y.milestoneId} />
              <input
                type="date"
                name="dueOn"
                required
                defaultValue={y.detail}
                min={v.today}
                className="rounded-md border border-line bg-ground px-2 py-1 text-xs text-ink"
              />
              <input
                name="reason"
                required
                minLength={5}
                placeholder={t("Why it moves")}
                className="min-w-0 flex-1 rounded-md border border-line bg-ground px-2 py-1 text-xs text-ink"
              />
              <button className={btnSecondary}>{t("Move")}</button>
            </form>
          </details>
        </div>
      );
    case "reminder":
      return line(t("Reminder from {name}", { name: y.title }), y.detail, <span />);
  }
}

const itemHref = (key: string, itemId: string | undefined, f?: string) =>
  `/initiatives?i=${key}${f ? `&f=${f}` : ""}${itemId ? `&item=${encodeURIComponent(itemId)}#item` : ""}`;

function YourItems({ v, i, t, name, f }: { v: V; i: Item; t: T; name: string; f?: string }) {
  return (
    <Card className="min-w-0 border-accent/40 bg-accent/5" data-testid="your-items">
      <Title aside={name}>{t("Your action items")}</Title>
      {v.yours.length === 0 ? (
        <p className="text-sm text-muted">{t("Nothing in this initiative waits on you.")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {v.yours.map((y) => (
            <li key={y.key} className="border-b border-line pb-3 last:border-0 last:pb-0" data-testid="your-item">
              <YourItemRow y={y} i={i} v={v} t={t} />
              {y.itemId && v.work.some((w) => w.id === y.itemId || `ins:${w.insightId}` === y.itemId) && (
                <Link
                  href={itemHref(
                    i.key,
                    v.work.find((w) => w.id === y.itemId || `ins:${w.insightId}` === y.itemId)!.id,
                    f,
                  )}
                  className="mt-1 inline-block text-[11px] text-accent"
                >
                  {t("See the analysis →")}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── What needs to happen (work items) and the item card (E3c) ───────────────────

const WORK_HEX: Record<WorkItem["state"], string> = {
  late: HEX.bad,
  blocked: HEX.bad,
  at_risk: HEX.watch,
  waiting: HEX.watch,
  in_progress: HEX.accent,
  done: HEX.good,
};
const WORK_WORD: Record<WorkItem["state"], string> = {
  late: "late",
  blocked: "blocked",
  at_risk: "at risk",
  waiting: "waiting for a decision",
  in_progress: "in progress",
  done: "done",
};
const KIND_WORD: Record<WorkItem["kind"], string> = {
  milestone: "milestone",
  barrier: "barrier",
  action: "action",
  conflict: "conflict",
  budget: "budget",
};

/** Filters on the status tiles (Eran 2026-10-07: "the status of the items should be clickable"). */
export const WORK_FILTERS: Record<string, (w: WorkItem) => boolean> = {
  attention: (w) => w.state === "late" || w.state === "blocked" || w.state === "at_risk",
  waiting: (w) => w.state === "waiting",
  progress: (w) => w.state === "in_progress",
  done: (w) => w.state === "done",
  you: (w) => (w.yours?.length ?? 0) > 0,
};

function nextStep(t: T, w: WorkItem): string {
  const a = w.analysis;
  switch (a.kind) {
    case "milestone":
      return w.state === "done"
        ? t("Delivered")
        : w.state === "late"
          ? t("Agree a new date or add capacity")
          : w.state === "blocked"
            ? t("Clear the barrier first")
            : w.state === "at_risk"
              ? t("Send a recovery plan")
              : t("On plan");
    case "barrier":
      return a.barrierKind === "decision" ? t("Take the decision") : t("Remove the barrier");
    case "conflict":
      return t("Decide which plan goes ahead");
    case "budget":
      return t("Re-forecast and bring spend back within budget");
    case "action":
      return a.step === "decide"
        ? t("Decide on the recommendation")
        : a.step === "approve"
          ? t("Approve or decline")
          : a.step === "ready"
            ? t("Run it")
            : a.step === "executing"
              ? t("Watch the outcome")
              : a.step === "failed"
                ? t("Retry or cancel")
                : t("Done");
  }
}

function recommendation(t: T, w: WorkItem): string {
  const a = w.analysis;
  const unit = w.unitName ?? "";
  switch (a.kind) {
    case "milestone":
      if (w.state === "done") return t("Delivered {date}.", { date: (a.doneOn ?? "").slice(5) });
      if (w.state === "blocked")
        return t("Blocked by: {list}. Clear the barrier first.", { list: w.blockers.join(" · ") });
      if (w.state === "late")
        return t(
          "{unit} is {n} days late. Agree a new date with {unit} today, or add capacity; the sponsor can send a reminder from here.",
          { unit, n: a.daysLate },
        );
      if (w.state === "at_risk")
        return t("{unit} is behind plan ({p}% done, {e}% expected by today). Ask for a recovery plan before {date}.", {
          unit,
          p: a.progress,
          e: a.expected,
          date: a.dueOn.slice(5),
        });
      return t("On plan: {p}% done, {e}% expected by today.", { p: a.progress, e: a.expected });
    case "barrier":
      return a.barrierKind === "decision"
        ? t("Take the decision. While it stays open the initiative is held up ({n} days so far).", { n: a.days })
        : a.barrierKind === "resource"
          ? t("Find the resource, or re-plan the milestones that depend on it.")
          : a.barrierKind === "budget"
            ? t("Approve the extra cost or cut scope to fit the budget.")
            : a.barrierKind === "dependency"
              ? t("Escalate to the unit it depends on and agree a date.")
              : t("Track it and agree a fallback.");
    case "conflict":
      return t(
        "Two plans collide from {from} to {to}. Decide which plan goes ahead; the trace shows both plans and VECTOR's recommendation.",
        { from: a.from.slice(5), to: a.to.slice(5) },
      );
    case "budget":
      return t(
        "Spent {s} of {b}; at this pace it ends at {p}. Ask for a re-forecast and hold new spend until it is agreed.",
        {
          s: ils(a.spent),
          b: ils(a.budget),
          p: ils(a.projected),
        },
      );
    case "action":
      return a.recommendation ?? t("No recommendation recorded.");
  }
}

function WorkList({ v, i, t, f, item }: { v: V; i: Item; t: T; f?: string; item?: string }) {
  const rows = f && WORK_FILTERS[f] ? v.work.filter(WORK_FILTERS[f]) : v.work;
  return (
    <Card className="min-w-0 overflow-x-auto" data-testid="work-list">
      <Title
        aside={
          f ? (
            <Link href={`/initiatives?i=${i.key}`} className="text-accent">
              {t("Show all ({n})", { n: v.work.length })}
            </Link>
          ) : (
            t("click an item for its analysis and recommendation")
          )
        }
      >
        {t("What needs to happen")}
      </Title>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("Nothing here.")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 text-start font-normal">{t("What")}</th>
              <th className="py-1 text-start font-normal">{t("Who acts")}</th>
              <th className="py-1 text-start font-normal">{t("Due")}</th>
              <th className="py-1 text-start font-normal">{t("Next step")}</th>
              <th className="py-1 text-start font-normal">{t("Blocked by")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr
                key={w.id}
                className={`border-t border-line align-top ${item === w.id ? "bg-accent/5" : ""}`}
                data-testid="work-row"
              >
                <td className="py-2 pe-3">
                  <span className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: WORK_HEX[w.state] }}
                    />
                    <span className="min-w-0">
                      <Link
                        href={itemHref(i.key, w.id, f)}
                        className="font-semibold text-ink no-underline hover:underline"
                      >
                        {w.title}
                      </Link>
                      <span className="block text-xs text-muted">
                        {t(KIND_WORD[w.kind])} ·{" "}
                        <span style={{ color: WORK_HEX[w.state] }}>{t(WORK_WORD[w.state])}</span>
                        {w.rules.length > 0 && ` · ${w.rules.join(" ")}`}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="py-2 pe-3 text-xs">
                  <span className="block text-ink">{w.who.join(", ") || "—"}</span>
                  {w.unitName && <span className="text-muted">{w.unitName}</span>}
                  {(w.yours?.length ?? 0) > 0 && <span className="block font-semibold text-accent">{t("you")}</span>}
                </td>
                <td className={`num py-2 pe-3 text-xs ${w.state === "late" ? "text-p1" : "text-muted"}`}>
                  {w.due ? w.due.slice(5) : "—"}
                </td>
                <td className="py-2 pe-3 text-xs">{nextStep(t, w)}</td>
                <td className="py-2 text-xs text-p1">
                  {w.blockers.length ? w.blockers.join(" · ") : <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ItemCard({ v, i, t, w, f }: { v: V; i: Item; t: T; w: WorkItem; f?: string }) {
  const a = w.analysis;
  const fact = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <span className="num text-end text-ink">{value}</span>
    </div>
  );
  return (
    <Card className="min-w-0 scroll-mt-20 border-accent/60" data-testid="item-card" id="item">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted">
            {t(KIND_WORD[w.kind])} · <span style={{ color: WORK_HEX[w.state] }}>{t(WORK_WORD[w.state])}</span>
            {w.rules.length > 0 && ` · ${w.rules.join(" ")}`}
          </span>
          <h2 className="text-base font-semibold leading-snug">{w.title}</h2>
        </div>
        <Link
          href={`/initiatives?i=${i.key}${f ? `&f=${f}` : ""}`}
          className="text-xs text-muted no-underline"
          aria-label={t("Close")}
        >
          ✕
        </Link>
      </div>
      <div className="mb-3 flex flex-col gap-1">
        {fact(t("Who acts"), w.who.join(", ") || "—")}
        {w.unitName && fact(t("Unit"), w.unitName)}
        {w.due && fact(t("Due"), w.due.slice(5))}
        {fact(t("Next step"), nextStep(t, w))}
      </div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{t("Analysis")}</h3>
      <div className="mb-3 mt-1 flex flex-col gap-1">
        {a.kind === "milestone" && (
          <>
            {fact(t("Progress"), `${a.progress}% · ${t("expected {e}%", { e: a.expected })}`)}
            {fact(t("Window"), `${a.startsOn.slice(5)} → ${a.dueOn.slice(5)}`)}
            {a.daysLate > 0 && fact(t("Late by"), t("{n} days", { n: a.daysLate }))}
            {a.moves.map((m, k) => (
              <p key={k} className="text-xs text-muted">
                {t("Moved {from} → {to}: {reason}", { from: m.from.slice(5), to: m.to.slice(5), reason: m.reason })}
              </p>
            ))}
            {a.reminders.map((r, k) => (
              <p key={k} className="text-xs text-muted">
                {t("Reminder from {name}", { name: r.from })}: {r.body}
              </p>
            ))}
          </>
        )}
        {a.kind === "barrier" && (
          <>
            {fact(t("Kind"), t(a.barrierKind))}
            {fact(t("Open for"), t("{n} days", { n: a.days }))}
            {a.costIls > 0 && fact(t("Cost"), ils(a.costIls))}
          </>
        )}
        {a.kind === "conflict" && (
          <>
            <p className="text-xs">
              {a.a} <span className="text-muted">({a.unitA})</span>
            </p>
            <p className="text-xs text-muted">↔</p>
            <p className="text-xs">
              {a.b} <span className="text-muted">({a.unitB})</span>
            </p>
            {fact(t("Overlap"), `${a.from.slice(5)} → ${a.to.slice(5)}`)}
          </>
        )}
        {a.kind === "budget" && (
          <>
            {fact(t("Budget"), ils(a.budget))}
            {fact(t("Spent"), ils(a.spent))}
            {fact(t("Projected at the end"), ils(a.projected))}
            {fact(t("Work done"), `${a.progress}%`)}
          </>
        )}
        {a.kind === "action" && (
          <>
            <p className="text-xs text-muted">{a.insightTitle}</p>
            <p className="text-xs">{a.what}</p>
            <p className="text-xs text-muted">{a.why}</p>
            {fact(t("Owner"), `${a.owner} · ${a.ownerUnit}`)}
            {a.waitingOn.length > 0 && fact(t("Waiting on"), a.waitingOn.join(", "))}
            {fact(t("Expected impact by quarter end"), ils(a.impact))}
            {fact(t("Cost"), ils(a.cost))}
          </>
        )}
      </div>
      <div className="mb-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">{t("Recommendation")}</h3>
        <p className="mt-1 text-sm" data-testid="item-recommendation">
          {recommendation(t, w)}
        </p>
      </div>
      {w.blockers.length > 0 && (
        <p className="mb-3 text-xs text-p1">{t("Blocked by: {list}", { list: w.blockers.join(" · ") })}</p>
      )}
      {(w.yours ?? []).length > 0 ? (
        <ul className="flex flex-col gap-3">
          {w.yours!.map((y) => (
            <li key={y.key}>
              <YourItemRow y={y} i={i} v={v} t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">
          {t("Nothing here waits on you; {who} acts.", { who: w.who.join(", ") || "—" })}
        </p>
      )}
      {w.href && (
        <Link href={w.href} className="mt-3 inline-block text-xs text-accent">
          {t("Open the full trace →")}
        </Link>
      )}
    </Card>
  );
}

// ── Deviations, on time, barriers ─────────────────────────────────────────────

function Deviations({ i, t, f }: { i: Item; t: T; f?: string }) {
  return (
    <Card className="min-w-0" data-testid="deviations">
      <Title aside={t("management needed")}>{t("Open deviations")}</Title>
      {i.flags.length === 0 ? (
        <p className="text-sm text-muted">{t("None: no rule M1–M5 applies.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {i.flags.map((fl, k) => (
            <li key={`${fl.rule}${k}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 text-sm">
              <span
                aria-hidden
                className="mt-1.5 h-2.5 w-2.5 rounded-full"
                style={{ background: fl.rule === "M2" || fl.rule === "M3" ? HEX.watch : HEX.bad }}
              />
              <span className="min-w-0">
                <Link
                  href={itemHref(i.key, fl.itemId, f)}
                  className="block text-ink no-underline hover:underline"
                  data-testid="deviation-link"
                >
                  {flagText(t, fl.rule, fl.facts, fl.subject.title)}
                </Link>
                <span className="block text-xs text-muted">
                  {t("step in: {who}", { who: `${t(STEP_IN_WORD[fl.stepIn])} (${fl.stepInNames.join(", ")})` })}
                </span>
              </span>
              <Chip color={fl.rule === "M2" || fl.rule === "M3" ? HEX.watch : HEX.bad}>{fl.rule}</Chip>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OnTime({ i, v, t }: { i: Item; v: V; t: T }) {
  const bar = (label: string, rate: number | null, color: string) => (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs">
      <span className="truncate text-muted">{label}</span>
      <span className="block h-2 rounded bg-soft">
        <span className="block h-2 rounded" style={{ width: `${(rate ?? 0) * 100}%`, background: color }} />
      </span>
      <span className="num text-end">{rate === null ? "—" : `${Math.round(rate * 100)}%`}</span>
    </div>
  );
  return (
    <Card className="min-w-0">
      <Title aside={t("milestones delivered by their date")}>{t("On-time delivery")}</Title>
      <div className="flex flex-col gap-2">
        {bar(t("This initiative"), i.onTime, HEX.accent)}
        {bar(t("All initiatives"), v.groupOnTime, HEX.muted)}
      </div>
    </Card>
  );
}

function Barriers({ i, t, canRaise }: { i: Item; t: T; canRaise: boolean }) {
  return (
    <Card className="min-w-0">
      <Title aside={t("open")}>{t("Barriers")}</Title>
      {i.barriers.length === 0 ? (
        <p className="text-sm text-muted">{t("No open barrier.")}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {i.barriers.map((b) => (
            <li key={b.id} className="min-w-0">
              <span className="block">{b.title}</span>
              <span className="block text-xs text-muted">
                {t("{unit} · {kind} · since {date}", { unit: b.ownerName, kind: t(b.kind), date: b.since.slice(5) })}
                {b.costIls ? ` · ${ils(b.costIls)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canRaise && (
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer">{t("+ Raise a barrier")}</summary>
          <form action={raiseBarrierAction} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="key" value={i.key} />
            <input type="hidden" name="initiativeId" value={i.id} />
            <input
              name="title"
              required
              minLength={3}
              placeholder={t("What is in the way?")}
              className="rounded-md border border-line bg-ground px-2 py-1 text-xs text-ink"
            />
            <div className="flex gap-2">
              <select name="kind" className="rounded-md border border-line bg-ground px-2 py-1 text-xs text-ink">
                {["dependency", "resource", "budget", "decision", "external"].map((k) => (
                  <option key={k} value={k}>
                    {t(k)}
                  </option>
                ))}
              </select>
              <select
                name="ownerUnitId"
                className="min-w-0 flex-1 rounded-md border border-line bg-ground px-2 py-1 text-xs text-ink"
              >
                {i.participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                name="costIls"
                type="number"
                min={0}
                placeholder="₪"
                className="w-24 rounded-md border border-line bg-ground px-2 py-1 text-xs text-ink"
              />
            </div>
            <button className={`${btnSecondary} self-start`}>{t("Raise")}</button>
          </form>
        </details>
      )}
    </Card>
  );
}

// ── All initiatives ────────────────────────────────────────────────────────────

function Table({ v, t }: { v: V; t: T }) {
  return (
    <Card className="min-w-0 overflow-x-auto" data-testid="initiative-table">
      <Title aside={t("needs management first")}>{t("All initiatives")}</Title>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr className="text-start">
            <th className="py-1 text-start font-normal">{t("Initiative")}</th>
            <th className="py-1 text-start font-normal">{t("Departments")}</th>
            <th className="py-1 text-start font-normal">{t("Next milestone")}</th>
            <th className="py-1 text-start font-normal">{t("Dependencies")}</th>
            <th className="py-1 text-start font-normal">{t("Management needed")}</th>
          </tr>
        </thead>
        <tbody>
          {v.items.map((i) => (
            <tr key={i.key} className="border-t border-line align-top" data-testid="initiative-row">
              <td className="py-2 pe-3">
                <Link href={`/initiatives?i=${i.key}`} className="font-semibold text-ink no-underline hover:underline">
                  {i.title}
                </Link>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <Chip color={STATUS_HEX[i.status]}>{t(STATUS_WORD[i.status])}</Chip>
                  {i.progress}% · {i.sponsorName}
                </span>
              </td>
              <td className="py-2 pe-3">
                <span className="flex flex-wrap gap-1">
                  {i.participants.map((p) => (
                    <span key={p.id} className="rounded border border-line px-1.5 text-[11px] text-muted">
                      {p.name}
                    </span>
                  ))}
                </span>
              </td>
              <td className="py-2 pe-3 text-xs">
                {i.next ? (
                  <>
                    <span className="block text-ink">{i.next.title}</span>
                    <span style={{ color: STATE_HEX[i.next.state] }}>
                      {`${i.next.dueOn.slice(5)} · ${t(STATE_WORD[i.next.state])}`}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
                {i.barriers.length > 0 && (
                  <span className="block text-p1">{t("{n} open barrier(s)", { n: i.barriers.length })}</span>
                )}
              </td>
              <td className="py-2 pe-3 text-xs text-muted">
                {i.waitingOn.length > 0 && (
                  <span className="block">
                    {t("waits on {list}", { list: [...new Set(i.waitingOn.map((d) => d.unit))].join(", ") })}
                  </span>
                )}
                {i.waitedOnBy.length > 0 && (
                  <span className="block">
                    {t("waited on by {list}", { list: [...new Set(i.waitedOnBy.map((d) => d.unit))].join(", ") })}
                  </span>
                )}
                {i.waitingOn.length + i.waitedOnBy.length === 0 && "—"}
              </td>
              <td className="py-2 text-xs">
                {i.flags.length === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  <span className="flex flex-col gap-1">
                    {i.flags.map((f, k) => (
                      <span key={`${f.rule}${k}`} className="flex items-start gap-1.5">
                        <Chip color={f.rule === "M2" || f.rule === "M3" ? HEX.watch : HEX.bad}>{f.rule}</Chip>
                        <span>{flagText(t, f.rule, f.facts, f.subject.title)}</span>
                      </span>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ── The page ───────────────────────────────────────────────────────────────────

export function InitiativesPage({
  v,
  t,
  name,
  canRaise,
  f,
  item,
}: {
  v: V;
  t: T;
  name: string;
  canRaise: boolean;
  f?: string;
  item?: string;
}) {
  const i = v.selected;
  if (!i) return null;
  const count = (k: string) => v.work.filter(WORK_FILTERS[k]).length;
  const facts = [
    { k: "attention", n: count("attention"), label: t("late, blocked or at risk"), color: HEX.bad },
    { k: "waiting", n: count("waiting"), label: t("waiting for a decision"), color: HEX.watch },
    { k: "progress", n: count("progress"), label: t("in progress"), color: HEX.accent },
    { k: "done", n: count("done"), label: t("done"), color: HEX.good },
    { k: "you", n: count("you"), label: t("wait on you"), color: "#e6edf7" },
  ];
  const selectedItem = item ? v.work.find((w) => w.id === item) : undefined;
  return (
    <div className="flex flex-col gap-4">
      <Portfolio v={v} t={t} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="min-w-0">
            <Title aside={t("who does what, and who waits on whom")}>{i.title}</Title>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <Chip color={STATUS_HEX[i.status]}>{t(STATUS_WORD[i.status])}</Chip>
              <span>{t("sponsor {name}", { name: i.sponsorName })}</span>
              <span>
                · {t("budget {b} · spent {s} · value {v}", { b: ils(i.budget), s: ils(i.spent), v: ils(i.value) })}
              </span>
              {i.endsOn && <span>· {t("ends {date}", { date: i.endsOn.slice(5) })}</span>}
            </div>
            <ProgressMap i={i} t={t} />
            <nav aria-label={t("Filter the items")} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {facts.map((x) => (
                <Link
                  key={x.k}
                  href={f === x.k ? `/initiatives?i=${i.key}` : `/initiatives?i=${i.key}&f=${x.k}`}
                  aria-current={f === x.k ? "true" : undefined}
                  data-testid={`filter-${x.k}`}
                  className={`rounded-lg border px-3 py-2 no-underline ${f === x.k ? "border-accent bg-accent/10" : "border-line hover:border-accent/60"}`}
                >
                  <span className="num block text-xl font-semibold" style={{ color: x.color }}>
                    {x.n}
                  </span>
                  <span className="text-xs text-muted">{x.label}</span>
                </Link>
              ))}
            </nav>
          </Card>
          <WorkList v={v} i={i} t={t} f={f} item={item} />
          <Card className="min-w-0">
            <Title aside={t("◆ = due date · red = late")}>{t("Milestones")}</Title>
            <Gantt i={i} today={v.today} t={t} />
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {selectedItem && <ItemCard v={v} i={i} t={t} w={selectedItem} f={f} />}
          <YourItems v={v} i={i} t={t} name={name} f={f} />
          <Deviations i={i} t={t} f={f} />
          <OnTime i={i} v={v} t={t} />
          <Barriers i={i} t={t} canRaise={canRaise} />
        </div>
      </div>
      <Table v={v} t={t} />
    </div>
  );
}
