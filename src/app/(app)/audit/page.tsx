import { notFound } from "next/navigation";
import { api } from "@/application/facade";
import { Card, Pill } from "../../_components/ui";
import { can, requireActor } from "../../_lib/session";

export default async function AuditPage() {
  const { actor } = await requireActor();
  if (!can(actor, "executive") && !can(actor, "admin")) notFound(); // group-wide audit is for Executive/Admin in Phase 2
  const chain = await api.verifyChain();
  return (
    <>
      <h1 className="text-[22px] font-semibold">Audit trail</h1>
      <Card className="flex flex-wrap items-center gap-3">
        {chain.ok ? (
          <Pill tone="good">Hash chain verified ✓</Pill>
        ) : (
          <Pill tone="strong">Chain broken at #{chain.brokenAt}</Pill>
        )}
        <span className="text-sm">
          {chain.count} events, insert-only (UPDATE/DELETE/TRUNCATE are rejected by the database).
        </span>
      </Card>
      <p className="text-sm text-muted">
        Each insight&apos;s own trail is on its trace page. A full explorer with filters arrives with Phase 4.
      </p>
    </>
  );
}
