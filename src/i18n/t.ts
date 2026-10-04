/**
 * Translation: `t("All {n} risks →", { n })`. The English text is the key; Hebrew comes from messages/he.ts. A missing
 * Hebrew entry falls back to English (and a unit test lists every `t("…")` in the UI that has no translation).
 */
import type { Locale } from "./locale";
import { HE } from "./messages/he";

export type Params = Record<string, string | number>;
export type T = (en: string, params?: Params) => string;

const fill = (s: string, params?: Params) =>
  params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;

export function makeT(locale: Locale): T {
  if (locale === "en") return (en, params) => fill(en, params);
  return (en, params) => fill(HE[en] ?? en, params);
}
