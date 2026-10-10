import Link from "next/link";
import { demoNow, seededPeople } from "@/application/facade";
import { localized } from "@/app/_lib/api";
import { signOut, switchPersona } from "../actions";
import { demoPersonasEnabled } from "../_lib/session";
import { makeT } from "@/i18n/t";
import { getLocale } from "../_lib/locale";
import { LanguageSwitch } from "./language-switch";
import { NavLink } from "./nav-link";
import { Logo } from "./ui";
import { PRODUCT, TAGLINE } from "@/i18n/brand";

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ICONS = {
  today: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  performance: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  risks: "M12 3l9 16H3zM12 10v4M12 17h.01",
  opportunities: "M3 17l6-6 4 4 8-8M15 7h6v6",
  commitments: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9",
  actions: "M4 6h16M4 12h10M4 18h7M17 15l2 2 4-4",
  org: "M12 3v6M12 9H5v5M12 9h7v5M3 14h4v4H3zM10 14h4v4h-4zM17 14h4v4h-4z",
  approvals: "M9 12l2 2 4-4M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z",
  audit: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  demo: "M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  cross: "M5 5h5v5H5zM14 14h5v5h-5zM14 5h5v5h-5zM10 7.5h4M16.5 10v4M7.5 10v6.5H14",
  center: "M13 2L4 14h7l-1 8 9-12h-7z",
  reports: "M7 3h7l5 5v13H7zM14 3v5h5M10 17v-3M13 17v-6M16 17v-4",
  market: "M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6",
  inbox: "M4 4h16v12H15l-3 3-3-3H4zM8 9h8M8 12h5",
};

function groupOf(title: string | null) {
  const t = title ?? "";
  if (/Regional|Branch/.test(t)) return "Regions & branches";
  if (/^(CEO|CFO|COO)$|Board|administrator/.test(t)) return "Leadership & admin";
  return "Departments";
}

/** App shell: sidebar navigation (desktop) / top bar (mobile), demo clock and persona menu. */
export async function Shell({
  me,
  approvals,
  inbox = 0,
  roles,
  via,
  children,
}: {
  me: { name: string; title: string | null; isCSuite?: boolean };
  approvals: number;
  /** Inbox threads that need a decision or a reply (E7). */
  inbox?: number;
  roles: string[];
  via: boolean;
  children: React.ReactNode;
}) {
  const now = await demoNow();
  me = await localized(me);
  const locale = await getLocale();
  const t = makeT(locale);
  const people = demoPersonasEnabled() ? await seededPeople() : [];
  const groups = ["Leadership & admin", "Regions & branches", "Departments"].map((g) => ({
    g,
    people: people.filter((p) => groupOf(p.title) === g),
  }));
  const shownGroups = await localized(groups);
  // audit.read (authorization.md §2): Executive, Admin and managers; the explorer scopes what each one sees.
  const seeAudit = ["executive", "admin", "department_manager", "regional_manager"].some((r) => roles.includes(r));
  const waiting = (
    <NavLink href="/approvals">
      <Icon d={ICONS.approvals} /> {t("Waiting on you")}
      {approvals > 0 && (
        <span className="ms-auto rounded-full bg-accent px-2 py-px text-xs font-semibold text-accent-ink">
          {approvals}
        </span>
      )}
    </NavLink>
  );
  // C-suite navigation (IA v2, executive-home.md §2): what waits on you comes right after Home.
  const cSuite = !!me.isCSuite;
  // Cross-department (E3): the C-suite and anyone who manages a department or the group, where initiatives live.
  const seeCross = cSuite || ["executive", "department_manager"].some((r) => roles.includes(r));
  // Action Center (E4): whoever decides or approves: the C-suite and managers.
  const seeCenter = cSuite || ["executive", "department_manager", "regional_manager"].some((r) => roles.includes(r));
  const center = seeCenter && (
    <NavLink href="/action-center">
      <Icon d={ICONS.center} /> {t("Action Center")}
    </NavLink>
  );
  const nav = (
    <>
      <NavLink href="/">
        <Icon d={ICONS.today} /> {t("Home")}
      </NavLink>
      {cSuite && waiting}
      {cSuite && (
        <NavLink href="/inbox">
          <Icon d={ICONS.inbox} /> {t("Inbox")}
          {inbox > 0 && (
            <span className="ms-auto rounded-full bg-accent px-2 py-px text-xs font-semibold text-accent-ink">
              {inbox}
            </span>
          )}
        </NavLink>
      )}
      {cSuite && center}
      <NavLink href="/risks">
        <Icon d={ICONS.risks} /> {t("Risks")}
      </NavLink>
      <NavLink href="/opportunities">
        <Icon d={ICONS.opportunities} /> {t("Opportunities")}
      </NavLink>
      {seeCross && (
        <NavLink href="/initiatives">
          <Icon d={ICONS.cross} /> {t("Cross-department")}
        </NavLink>
      )}
      {seeCross && (
        <NavLink href="/market">
          <Icon d={ICONS.market} /> {t("Market & competitors")}
        </NavLink>
      )}
      {seeCross && (
        <NavLink href="/reports">
          <Icon d={ICONS.reports} /> {t("Reports")}
        </NavLink>
      )}
      <NavLink href="/commitments">
        <Icon d={ICONS.commitments} /> {t("Commitments")}
      </NavLink>
      <NavLink href="/actions">
        <Icon d={ICONS.actions} /> {t("Actions & outcomes")}
      </NavLink>
      <NavLink href="/org">
        <Icon d={ICONS.org} /> {t("Organization")}
      </NavLink>
      {!cSuite && waiting}
      {!cSuite && center}
      {seeAudit && (
        <NavLink href="/audit">
          <Icon d={ICONS.audit} /> {t("Audit")}
        </NavLink>
      )}
      {roles.includes("admin") && (
        <NavLink href="/admin/demo">
          <Icon d={ICONS.demo} /> {t("Demo controls")}
        </NavLink>
      )}
    </>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)] print:block">
      <aside
        data-shell="nav"
        className="hidden border-e border-line bg-panel/60 px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-8 lg:overflow-y-auto"
      >
        <Link href="/" className="flex items-center gap-2.5 px-2 no-underline">
          <Logo />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-[0.14em]">{PRODUCT}</span>
            <span className="text-[11px] text-muted">| {TAGLINE[locale]}</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1" aria-label={t("Main")}>
          {nav}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-muted">
          {t("Synthetic organization. Executions are simulated.")}
        </p>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header
          data-shell="top"
          className="sticky top-0 z-30 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-ground/90 px-4 py-3 backdrop-blur sm:px-8"
        >
          <Link href="/" className="flex items-center gap-2 no-underline lg:hidden">
            <Logo size={22} />
            <span className="text-sm font-semibold tracking-[0.14em]">{PRODUCT}</span>
            <span className="text-[11px] text-muted">| {TAGLINE[locale]}</span>
          </Link>
          <nav className="flex w-full gap-1 overflow-x-auto lg:hidden" aria-label={t("Main (mobile)")}>
            {nav}
          </nav>
          <div className="grow" />
          <LanguageSwitch locale={locale} />
          <span className="font-mono text-xs text-muted" title={t("Demo clock")}>
            {now.toISOString().slice(0, 16).replace("T", " ")} UTC · {t("demo clock")}
          </span>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full border border-line bg-soft px-3.5 py-1.5 text-[13px]">
              {via ? `${t("Viewing as")} ` : ""}
              <b>{me.name}</b> · {me.title} {via ? `· ${t("demo")}` : ""} ▾
            </summary>
            <div className="absolute end-0 z-20 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-line bg-panel p-2 shadow-2xl">
              {people.length > 0 && <p className="px-2 pb-1 pt-1 text-xs text-muted">{t("Switch persona (demo)")}</p>}
              {shownGroups.map(
                ({ g, people: ps }) =>
                  ps.length > 0 && (
                    <div key={g} className="border-t border-line py-1 first:border-t-0">
                      <p className="px-2 pt-1 text-[11px] uppercase tracking-wide text-muted">{t(g)}</p>
                      {ps.map((p) => (
                        <form key={p.id} action={switchPersona}>
                          <input type="hidden" name="email" value={p.email} />
                          <button className="w-full rounded-md px-2 py-1.5 text-start text-sm hover:bg-soft">
                            <b>{p.name}</b> <span className="text-muted">· {p.title}</span>
                          </button>
                        </form>
                      ))}
                    </div>
                  ),
              )}
              <form action={signOut} className="mt-1 border-t border-line pt-1">
                <button className="w-full rounded-md px-2 py-1.5 text-start text-sm hover:bg-soft">
                  {t("Sign out")}
                </button>
              </form>
            </div>
          </details>
        </header>
        <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
