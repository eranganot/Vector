/** Display formats shared by the screens (plan v2, E4: "the due date and impact in value don't look good"). */
import { dayLabel } from "@/domain/suggest";
import type { Locale } from "@/i18n/locale";

/** A short, localized day: "26 Oct" / "26 אוק׳". Days are UTC like every time in the synthetic organization. */
export const shortDay = (d: Date | string, locale: Locale) =>
  dayLabel(typeof d === "string" ? d : d.toISOString().slice(0, 10), locale === "he" ? "he" : "en");
