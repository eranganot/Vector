/**
 * Reports: "Ask your data" (G-E6d, Eran 2026-10-10: "for now just show it, do no develop it"). A preview of the
 * free-text chat an AI agent will answer with read-only text-to-SQL on VECTOR's data. Nothing here is sent anywhere.
 */
import type { T } from "@/i18n/t";
import { Card, SectionTitle } from "./ui";

const EXAMPLES = [
  "Which North branches missed their sales budget last week?",
  "How did our dairy prices move against Shufersal this month?",
  "Show labor cost vs budget by region for the last 8 weeks",
  "Which decisions have waited more than 3 days, and on whom?",
];

export function ReportChatPreview({ t }: { t: T }) {
  return (
    <Card className="flex flex-col gap-3" data-testid="report-chat-preview">
      <SectionTitle
        aside={
          <span className="rounded border border-dashed border-accent px-2 py-0.5 text-[11px] font-semibold text-accent">
            {t("Preview · not active yet")}
          </span>
        }
      >
        {t("Ask your data")}
      </SectionTitle>
      <p className="text-sm text-muted">
        {t(
          "Ask in your own words. An AI agent turns the question into a read-only query on VECTOR's data, limited to what you may see, and answers with a number, a table or a chart you can add to this report. Every question is audited.",
        )}
      </p>
      <div className="flex flex-wrap gap-2" aria-label={t("Example questions")}>
        {EXAMPLES.map((q) => (
          <span key={q} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
            {t(q)}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          disabled
          aria-label={t("Ask your data")}
          placeholder={t("Type a question… (available in the AI stage)")}
          className="min-w-0 grow cursor-not-allowed rounded-lg border border-line bg-ground/60 px-3 py-2 text-sm opacity-70"
        />
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg bg-accent/40 px-4 py-2 text-sm font-semibold text-accent-ink opacity-70"
        >
          {t("Ask")}
        </button>
      </div>
    </Card>
  );
}
