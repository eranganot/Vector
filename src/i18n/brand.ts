import type { Locale } from "./locale";

/**
 * The product's name (FB-2, Eran 2026-10-06): everywhere it appears it is "VECTOR | Organizational Intelligence",
 * and in Hebrew "VECTOR | אינטליגנציה ארגונית" (standard spelling, Eran 17:52). One source, so no screen drifts.
 */
export const PRODUCT = "VECTOR";
export const TAGLINE: Record<Locale, string> = {
  en: "Organizational Intelligence",
  he: "אינטליגנציה ארגונית",
};
export const productName = (locale: Locale) => `${PRODUCT} | ${TAGLINE[locale]}`;
/** Browser tab title: the page first, then the product. */
export const pageTitle = (locale: Locale, page?: string) =>
  page ? `${page} · ${productName(locale)}` : productName(locale);
