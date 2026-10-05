/** EN | עברית: the viewer's language (a cookie; the page reloads in that language and direction). */
import type { Locale } from "@/i18n/locale";
import { setLanguageAction } from "../actions";

export function LanguageSwitch({ locale }: { locale: Locale }) {
  return (
    <form action={setLanguageAction} className="flex items-center gap-1 text-xs" aria-label="Language / שפה">
      {(
        [
          ["en", "EN"],
          ["he", "עברית"],
        ] as const
      ).map(([l, label]) => (
        <button
          key={l}
          name="lang"
          value={l}
          aria-pressed={locale === l}
          lang={l}
          className={`rounded-md border px-2 py-1 ${locale === l ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </form>
  );
}
