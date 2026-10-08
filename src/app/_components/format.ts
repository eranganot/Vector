/** Display formats shared by the screens (plan v2, E4: "the due date and impact in value don't look good"). */
import { dayLabel } from "@/domain/suggest";
import type { Locale } from "@/i18n/locale";
import type { T } from "@/i18n/t";

/** A short, localized day: "26 Oct" / "26 אוק׳". Days are UTC like every time in the synthetic organization. */
export const shortDay = (d: Date | string, locale: Locale) =>
  dayLabel(typeof d === "string" ? d : d.toISOString().slice(0, 10), locale === "he" ? "he" : "en");

/** The same, in the language of the screen's translator: day(t, "2026-10-26") → "26 Oct" / "26 אוק׳". */
export const day = (t: T, d: Date | string | null | undefined) => (d ? shortDay(d, t.locale ?? "en") : "—");

/** A day and a UTC time: "26 Oct 14:05". */
export const dayTime = (t: T, d: Date) => `${day(t, d)} ${d.toISOString().slice(11, 16)}`;
