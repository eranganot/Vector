/** The viewer's language, from the cookie set by the language switch (default English). */
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/locale";
import { makeT } from "@/i18n/t";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** The translator for this request. */
export async function getT() {
  return makeT(await getLocale());
}
