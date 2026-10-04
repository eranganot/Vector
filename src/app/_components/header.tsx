import Link from "next/link";
import { demoNow, seededPeople } from "@/application/facade";
import { signOut, switchPersona } from "../actions";
import { demoPersonasEnabled } from "../_lib/session";

export async function Header({
  me,
  approvals,
  roles,
  via,
}: {
  me: { name: string; title: string | null };
  approvals: number;
  roles: string[];
  via: boolean;
}) {
  const now = await demoNow();
  const people = demoPersonasEnabled() ? await seededPeople() : [];
  const seeAudit = roles.includes("executive") || roles.includes("admin");
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-x-8 gap-y-2 border-b border-line bg-panel px-4 py-2 sm:px-8">
      <Link href="/" className="text-[15px] font-semibold tracking-[0.12em] no-underline">
        VECTOR
      </Link>
      <nav className="flex flex-wrap gap-6 text-sm">
        <Link href="/" className="hover:underline">
          Insights
        </Link>
        <Link href="/approvals" className="hover:underline">
          Approvals{" "}
          {approvals > 0 && <span className="ml-1 rounded-full bg-ink px-2 py-px text-xs text-white">{approvals}</span>}
        </Link>
        {seeAudit && (
          <Link href="/audit" className="hover:underline">
            Audit
          </Link>
        )}
        {roles.includes("admin") && (
          <Link href="/admin/demo" className="hover:underline">
            Demo
          </Link>
        )}
      </nav>
      <div className="grow" />
      <span className="font-mono text-xs text-muted" title="Demo clock">
        {now.toISOString().slice(0, 16).replace("T", " ")} UTC · synthetic data
      </span>
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-full border border-line bg-ground px-3.5 py-1.5 text-[13px]">
          {via ? "Viewing as " : ""}
          <b>{me.name}</b> · {me.title} {via ? "· demo" : ""} ▾
        </summary>
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-[10px] border border-line bg-panel p-2 shadow-sm">
          {people.length > 0 && <p className="px-2 pb-1 pt-1 text-xs text-muted">Switch persona (demo)</p>}
          {people.map((p) => (
            <form key={p.id} action={switchPersona}>
              <input type="hidden" name="email" value={p.email} />
              <button className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-ground">
                <b>{p.name}</b> <span className="text-muted">· {p.title}</span>
              </button>
            </form>
          ))}
          <form action={signOut} className="mt-1 border-t border-line pt-1">
            <button className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-ground">Sign out</button>
          </form>
        </div>
      </details>
    </header>
  );
}
