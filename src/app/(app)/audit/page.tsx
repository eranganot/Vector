import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/application/facade";
import { Card, Pill, SectionTitle } from "../../_components/ui";
import { requireActor } from "../../_lib/session";

const when = (d: Date) => d.toISOString().slice(5, 16).replace("T", " ");

/** Scoped audit explorer (Phase 4g): what exactly happened, by whom, in your scope. Insert-only and hash-chained. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; actor?: string; op?: string; denied?: string }>;
}) {
  const sp = await searchParams;
  const { actor } = await requireActor();
  const filter = {
    entity: sp.entity || undefined,
    actor: sp.actor || undefined,
    op: sp.op?.slice(0, 60) || undefined,
    denied: sp.denied === "1",
  };
  const [v, chain] = await Promise.all([api.audit(actor, filter), api.verifyChain()]);
  if (!v) notFound(); // no audit.read: looks missing
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight">Audit trail</h1>
        <p className="text-sm text-muted">
          Every state change and every refused attempt{v.groupWide ? " in the organization" : " in your scope"}: who,
          when, from what to what, and why. Newest first.
        </p>
      </div>
      <Card className="flex flex-wrap items-center gap-3">
        {chain.ok ? (
          <Pill tone="good">Hash chain verified ✓</Pill>
        ) : (
          <Pill tone="bad">Chain broken at #{chain.brokenAt}</Pill>
        )}
        <span className="text-sm">
          {chain.count} events in the chain, insert-only (UPDATE, DELETE and TRUNCATE are rejected by the database).{" "}
          {v.total} visible to you.
        </span>
      </Card>
      <form method="get" className="flex flex-wrap items-end gap-3 text-sm" aria-label="Filter the audit trail">
        <label className="flex flex-col gap-1">
          About
          <select name="entity" defaultValue={filter.entity ?? ""} className="field">
            <option value="">anything</option>
            {v.entityTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          By
          <select name="actor" defaultValue={filter.actor ?? ""} className="field">
            <option value="">anyone</option>
            {v.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Operation contains
          <input name="op" defaultValue={filter.op ?? ""} placeholder="e.g. approval" className="field" />
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input type="checkbox" name="denied" value="1" defaultChecked={filter.denied} /> refusals only
        </label>
        <button className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-ink">Filter</button>
        <Link href="/audit" className="pb-2 text-accent">
          Clear
        </Link>
      </form>
      <section className="flex flex-col gap-2">
        <SectionTitle aside={<span className="text-xs text-muted">showing up to 200</span>}>
          Events · {v.matching}
        </SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">When (demo clock)</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">What</th>
                <th className="px-3 py-2 font-medium">About</th>
                <th className="px-3 py-2 font-medium">Change / reason</th>
              </tr>
            </thead>
            <tbody>
              {v.events.map((e) => (
                <tr
                  key={e.id}
                  className={`border-b border-line/60 align-top last:border-0 ${e.operation.endsWith(".denied") ? "bg-p1/5" : ""}`}
                >
                  <td className="px-3 py-2 font-mono text-xs text-muted">{e.seq}</td>
                  <td className="px-3 py-2 font-mono text-xs">{when(e.at)}</td>
                  <td className="px-3 py-2">
                    {e.actor}
                    {e.viaDemoSwitcher && <div className="text-xs text-muted">via demo switcher</div>}
                  </td>
                  <td className={`px-3 py-2 font-semibold ${e.operation.endsWith(".denied") ? "text-p1" : ""}`}>
                    {e.operation}
                  </td>
                  <td className="max-w-[320px] px-3 py-2">
                    {e.href ? (
                      <Link href={e.href} className="no-underline hover:underline">
                        {e.subject}
                      </Link>
                    ) : (
                      e.subject
                    )}
                    <div className="text-xs text-muted">{e.entityType.replace("_", " ")}</div>
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {e.fromState || e.toState ? `${e.fromState ?? "∅"} → ${e.toState ?? "∅"}` : ""}
                    {e.reason && <div>{e.reason}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </>
  );
}
