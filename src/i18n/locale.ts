/**
 * Languages (Eran, 2026-10-05: Hebrew as a second language, right-to-left, chosen by the user). English is the source
 * language: every UI string is written in English in the code and translated through `t()`; Hebrew renders RTL.
 */
export const LOCALES = ["en", "he"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "vector_lang";
export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const dirOf = (l: Locale) => (l === "he" ? "rtl" : "ltr");
/** BCP-47 tag for dates and numbers. */
export const intlOf = (l: Locale) => (l === "he" ? "he-IL" : "en-GB");
