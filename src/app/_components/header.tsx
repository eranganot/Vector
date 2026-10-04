import Link from "next/link";
import { demoNow, seededPeople } from "@/application/facade";
import { signOut, switchPersona } from "../actions";
import { demoPersonasEnabled } from "../_lib/session";
import { NavLink } from "./nav-link";
import { Logo } from "./ui";

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
};

function groupOf(title: string | null) {
  const t = title ?? "";
  if (/Regional|Branch/.test(t)) return "Regions & branches";
  if (/CEO|Board|administrator/.test(t)) return "Leadership & admin";
  return "Departments";
}

/** App shell: sidebar navigation (desktop) / top bar (mobile), demo clock and persona menu. */
export async function Shell({
  me,
  approvals,
  roles,
  via,
  children,
}: {
  me: { name: string; title: string | null };
  approvals: number;
  roles: string[];
  via: boolean;
  children: React.ReactNode;
}) {
  const now = await demoNow();
  const people = demoPersonasEnabled() ? await seededPeople() : [];
  const groups = ["Leadership & admin", "Regions & branches", "Departments"].map((g) => ({
    g,
    people: people.filter((p) => groupOf(p.title) === g),
  }));
  // audit.read (authorization.md §2): Executive, Admin and managers; the explorer scopes what each one sees.
  const seeAudit = ["executive", "admin", "department_manager", "regional_manager"].some((r) => roles.includes(r));
  const nav = (
    <>
      <NavLink href="/">
        <Icon d={ICONS.today} /> Home
      </NavLink>
      <NavLink href="/risks">
        <Icon d={ICONS.risks} /> Risks
      </NavLink>
      <NavLink href="/opportunities">
        <Icon d={ICONS.opportunities} /> Opportunities
      </NavLink>
      <NavLink href="/commitments">
        <Icon d={ICONS.commitments} /> Commitments
      </NavLink>
      <NavLink href="/actions">
        <Icon d={ICONS.actions} /> Actions &amp; outcomes
      </NavLink>
      <NavLink href="/org">
        <Icon d={ICONS.org} /> Organization
      </NavLink>
      <NavLink href="/approvals">
        <Icon d={ICONS.approvals} /> Waiting on you
        {approvals > 0 && (
          <span className="ml-auto rounded-full bg-accent px-2 py-px text-xs font-semibold text-accent-ink">
            {approvals}
          </span>
        )}
      </NavLink>
      {seeAudit && (
        <NavLink href="/audit">
          <Icon d={ICONS.audit} /> Audit
        </NavLink>
      )}
      {roles.includes("admin") && (
        <NavLink href="/admin/demo">
          <Icon d={ICONS.demo} /> Demo controls
        </NavLink>
      )}
    </>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-panel/60 px-4 py-6 lg:flex lg:flex-col lg:gap-8">
        <Link href="/" className="flex items-center gap-2.5 px-2 no-underline">
          <Logo />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-[0.14em]">VECTOR</span>
            <span className="text-[11px] text-muted">Organizational intelligence</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {nav}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-muted">
          Synthetic organization. Executions are simulated.
        </p>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-panel/40 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2 no-underline lg:hidden">
            <Logo size={22} />
            <span className="text-sm font-semibold tracking-[0.14em]">VECTOR</span>
          </Link>
          <nav className="flex w-full gap-1 overflow-x-auto lg:hidden" aria-label="Main (mobile)">
            {nav}
          </nav>
          <div className="grow" />
          <span className="font-mono text-xs text-muted" title="Demo clock">
            {now.toISOString().slice(0, 16).replace("T", " ")} UTC · demo clock
          </span>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full border border-line bg-soft px-3.5 py-1.5 text-[13px]">
              {via ? "Viewing as " : ""}
              <b>{me.name}</b> · {me.title} {via ? "· demo" : ""} ▾
            </summary>
            <div className="absolute right-0 z-20 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-line bg-panel p-2 shadow-2xl">
              {people.length > 0 && <p className="px-2 pb-1 pt-1 text-xs text-muted">Switch persona (demo)</p>}
              {groups.map(
                ({ g, people: ps }) =>
                  ps.length > 0 && (
                    <div key={g} className="border-t border-line py-1 first:border-t-0">
                      <p className="px-2 pt-1 text-[11px] uppercase tracking-wide text-muted">{g}</p>
                      {ps.map((p) => (
                        <form key={p.id} action={switchPersona}>
                          <input type="hidden" name="email" value={p.email} />
                          <button className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-soft">
                            <b>{p.name}</b> <span className="text-muted">· {p.title}</span>
                          </button>
                        </form>
                      ))}
                    </div>
                  ),
              )}
              <form action={signOut} className="mt-1 border-t border-line pt-1">
                <button className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-soft">Sign out</button>
              </form>
            </div>
          </details>
        </header>
        <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
