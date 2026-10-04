import { notFound } from "next/navigation";
import { demoNow } from "@/application/facade";
import { advanceClockAction, resetDemoAction } from "../../../actions";
import { Card, Notice } from "../../../_components/ui";
import { can, requireActor } from "../../../_lib/session";

export default async function DemoControls({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
  const { actor } = await requireActor();
  if (!can(actor, "admin")) notFound();
  const now = await demoNow();
  return (
    <>
      <h1 className="text-[22px] font-semibold">Demo controls</h1>
      <Notice
        error={error}
        done={
          done === "reset"
            ? "Demo reset: a fresh organization epoch was seeded and the detector ran."
            : done === "advanced"
              ? "Clock advanced; data generated, jobs and detector ran."
              : undefined
        }
      />
      <Card className="flex flex-col gap-4">
        <p className="text-sm">
          Demo clock: <b className="font-mono">{now.toISOString().slice(0, 16).replace("T", " ")} UTC</b>
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            ["1", "+1 hour"],
            ["24", "+1 day"],
            ["73", "+73 hours (expire approvals)"],
            ["193", "+8 days (close outcome windows)"],
          ].map(([h, label]) => (
            <form key={h} action={advanceClockAction}>
              <input type="hidden" name="hours" value={h} />
              <button className="rounded-lg border border-ink bg-panel px-4 py-2 text-sm">{label}</button>
            </form>
          ))}
        </div>
      </Card>
      <Card className="flex flex-col gap-3">
        <p className="text-sm">
          Reset starts a new organization epoch from the seed (the previous epoch and its audit trail are kept, never
          deleted).
        </p>
        <form action={resetDemoAction}>
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Reset demo</button>
        </form>
      </Card>
    </>
  );
}
