/** Phase 0 placeholder. The product experience starts in Phase 2. */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">VECTOR</h1>
      <p className="text-lg opacity-80">Signal → Insight → Decision → Action → Outcome</p>
      <p className="text-sm opacity-60">
        Foundation build. Health:{" "}
        <a className="underline" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
