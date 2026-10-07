/**
 * The suggested message of the Action Center (plan v2, E4; action-center.md §3, `action-suggest-v1`). Pure and
 * deterministic: the same facts always give the same message. Facts arrive already in the reader's language.
 */
export const SUGGEST_MODEL = "action-suggest-v1";

export type MessageInput = {
  locale: "en" | "he";
  /** First names. */
  to: string;
  from: string;
  workstream: "risk" | "opportunity";
  insightTitle: string;
  steps: { title: string; costIls: number }[];
  weeklyIls: number;
  /** ISO day the first step is due, if any. */
  due: string | null;
  /** Approvals VECTOR will still ask for before it runs (the policy, evaluated live), one per step. */
  approvals: { names: string[]; costIls: number }[];
  informed: string[];
};

export type SuggestedMessage = { templateId: string; subject: string; body: string };

const money = (v: number) => {
  const a = Math.abs(v);
  return a >= 1_000_000
    ? `₪${(a / 1_000_000).toFixed(1)}M`
    : a >= 1000
      ? `₪${Math.round(a / 1000)}k`
      : `₪${Math.round(a)}`;
};
const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  he: ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"],
};
export const dayLabel = (iso: string, locale: "en" | "he") =>
  `${Number(iso.slice(8, 10))} ${MONTHS[locale][Number(iso.slice(5, 7)) - 1]}`;

export function suggestMessage(i: MessageInput): SuggestedMessage {
  const list = i.steps.map((s, n) => `${n + 1}. ${s.title}`).join("\n");
  if (i.locale === "he") {
    const stake =
      i.workstream === "opportunity"
        ? `הפוטנציאל הוא כ־${money(i.weeklyIls)} בשבוע.`
        : `על הכף כ־${money(i.weeklyIls)} בשבוע.`;
    const parts = [
      `${i.to}, ${i.insightTitle}.`,
      stake,
      `נא לבצע:\n${list}`,
      i.due ? `יעד: ${dayLabel(i.due, "he")}.` : "",
      i.approvals.length
        ? `VECTOR יבקש אישור: ${i.approvals.map((a) => `${a.names.join(" או ")} (${money(a.costIls)})`).join("; ")}.`
        : "",
      i.informed.length ? `בהעתק: ${i.informed.join(", ")}.` : "",
      i.from,
    ];
    return {
      templateId: `${SUGGEST_MODEL}:${i.workstream}:he`,
      subject: i.insightTitle,
      body: parts.filter(Boolean).join("\n"),
    };
  }
  const stake =
    i.workstream === "opportunity"
      ? `The upside is about ${money(i.weeklyIls)} a week.`
      : `About ${money(i.weeklyIls)} a week is at stake.`;
  const parts = [
    `${i.to}, ${i.insightTitle}.`,
    stake,
    `Please:\n${list}`,
    i.due ? `Due ${dayLabel(i.due, "en")}.` : "",
    i.approvals.length
      ? `VECTOR will ask for approval: ${i.approvals.map((a) => `${a.names.join(" or ")} (${money(a.costIls)})`).join("; ")}.`
      : "",
    i.informed.length ? `Copying ${i.informed.join(", ")}.` : "",
    i.from,
  ];
  return {
    templateId: `${SUGGEST_MODEL}:${i.workstream}:en`,
    subject: i.insightTitle,
    body: parts.filter(Boolean).join("\n"),
  };
}
