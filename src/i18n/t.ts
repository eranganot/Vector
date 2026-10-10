/**
 * Translation: `t("All {n} risks →", { n })`. The English text is the key; Hebrew comes from messages/he.ts. A missing
 * Hebrew entry falls back to English (and a unit test lists every `t("…")` in the UI that has no translation).
 */
import type { Locale } from "./locale";
import { heContent } from "./content";
import { HE } from "./messages/he";

export type Params = Record<string, string | number>;
/** Translate; carries the reader's locale so a screen can also format dates for them. */
export type T = ((en: string, params?: Params) => string) & { locale?: Locale };

const fill = (s: string, params?: Params) =>
  params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;

export function makeT(locale: Locale): T {
  const t: T =
    locale === "en" ? (en, params) => fill(en, params) : (en, params) => fill(HE[en] ?? heContent(en) ?? en, params);
  t.locale = locale;
  return t;
}
