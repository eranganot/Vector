import { seededPeople } from "@/application/facade";
import { signIn, switchPersona } from "../actions";
import { Logo, Notice } from "../_components/ui";
import { demoPersonasEnabled } from "../_lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const people = demoPersonasEnabled() ? await seededPeople().catch(() => []) : [];
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-4 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <h1 className="text-3xl font-semibold tracking-[0.14em]">VECTOR</h1>
        </div>
        <p className="text-lg text-muted">Signal → Insight → Decision → Action → Outcome</p>
      </div>
      <Notice error={error} />
      <div className="grid gap-6 md:grid-cols-2">
        <form action={signIn} className="flex flex-col gap-3 rounded-[10px] border border-line bg-panel p-6">
          <h2 className="text-lg font-semibold">Sign in</h2>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded-md border border-line px-3 py-2"
          />
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-line px-3 py-2"
          />
          <button className="mt-2 rounded-md bg-accent px-4 py-2.5 font-semibold text-accent-ink">Sign in</button>
        </form>
        {people.length > 0 && (
          <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-[10px] border border-line bg-panel p-6">
            <h2 className="text-lg font-semibold">Demo personas</h2>
            <p className="text-sm text-muted">
              Synthetic organization. Signing in as a persona is recorded in the audit trail.
            </p>
            {people.map((p) => (
              <form key={p.id} action={switchPersona}>
                <input type="hidden" name="email" value={p.email} />
                <button className="w-full rounded-md border border-line px-3 py-2 text-left text-sm hover:border-accent">
                  <b>{p.name}</b> <span className="text-muted">· {p.title}</span>
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
