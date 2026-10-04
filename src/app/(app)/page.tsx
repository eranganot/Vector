import Link from "next/link";
import { api } from "@/application/facade";
import { Band, Card, Pill, SectionTitle } from "../_components/ui";
import { requireActor } from "../_lib/session";

const STATUS: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  dismissed: "Dismissed",
  superseded: "Superseded",
};

export default async function Home() {
  const { actor, me } = await requireActor();
  const [insights, approvals] = await Promise.all([api.listInsights(actor), api.myApprovals(actor)]);
  const open = insights.filter((i) => i.status === "open" || i.status === "acknowledged");
  const headline =
    open.length === 0
      ? "Nothing needs attention in your scope right now."
      : `${open.length} insight${open.length > 1 ? "s" : ""} need${open.length > 1 ? "" : "s"} attention in your scope.`;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold">{headline}</h1>
        <p className="text-sm text-muted">
          Risks ranked by priority; opportunities are a separate workstream. {me.name}, {me.title}.
        </p>
      </div>
      {approvals.length > 0 && (
        <Card className="border-ink">
          <SectionTitle>Waiting on you</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2">
            {approvals.map((a) => (
              <li key={a.approval.id} className="flex flex-wrap items-center gap-3 text-sm">
                <Band band={a.band} />
                <span className="font-semibold">{a.action.title}</span>
                <Link href="/approvals" className="underline">
                  Review approval
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {(["risk", "opportunity"] as const).map((ws) => {
        const items = insights.filter((i) => i.workstream === ws);
        return (
          <section key={ws} className="flex flex-col gap-3">
            <SectionTitle>{ws === "risk" ? "Risks" : "Opportunities"}</SectionTitle>
            {items.length === 0 && (
              <p className="text-sm text-muted">
                {ws === "risk" ? "No risks in your scope." : "No opportunities in your scope yet."}
              </p>
            )}
            {items.map((i) => (
              <Link
                key={i.id}
                href={`/insights/${i.id}`}
                className="flex flex-wrap items-center gap-4 rounded-[10px] border border-line bg-panel px-5 py-4 no-underline hover:border-ink"
              >
                <Band band={i.priorityBand} score={i.priorityScore} />
                <div className="flex min-w-0 grow flex-col">
                  <span className="text-[17px] font-semibold">{i.title}</span>
                  <span className="text-sm text-muted">{i.primaryUnitName}</span>
                </div>
                <Pill>{STATUS[i.status] ?? i.status}</Pill>
                <span className="text-sm underline">Why am I seeing this?</span>
              </Link>
            ))}
          </section>
        );
      })}
    </>
  );
}
