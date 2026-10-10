/** The ₪ header at the top of a list page (plan v2, FB-5; executive-home.md §6): 3–4 figures for what the page shows. */
import { fmtIls } from "./ui";

export type MoneyFigure = {
  icon: string;
  label: string;
  value: string;
  /** What the figure adds up (hover). */
  hint: string;
  tone?: "accent" | "good" | "warn" | "bad" | "muted";
};

const TONE: Record<NonNullable<MoneyFigure["tone"]>, string> = {
  accent: "#22d3ee",
  good: "#34d399",
  warn: "#fbbf24",
  bad: "#f87171",
  muted: "#8fa1bc",
};

export const ils = (v: number) => (Math.abs(v) < 1000 ? `₪${Math.round(v)}` : fmtIls(v));

export function MoneyHeader({ figures, label }: { figures: MoneyFigure[]; label: string }) {
  return (
    <section aria-label={label} data-testid="money-header" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {figures.map((f) => (
        <div
          key={f.label}
          title={f.hint}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-panel/90 px-4 py-3"
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] font-semibold"
            style={{ background: `${TONE[f.tone ?? "accent"]}22`, color: TONE[f.tone ?? "accent"] }}
          >
            {f.icon}
          </span>
          <span className="min-w-0">
            <span className="num block text-[22px] font-semibold leading-tight tracking-tight">{f.value}</span>
            <span className="block truncate text-xs text-muted">{f.label}</span>
          </span>
        </div>
      ))}
    </section>
  );
}
