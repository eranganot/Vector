import Link from "next/link";
import { api, demoNow } from "@/application/facade";
import { Band, Card, Pill, SectionTitle } from "../_components/ui";
import { requireActor } from "../_lib/session";

const STATUS: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  dismissed: "Dismissed",
  superseded: "Superseded",
};

const greeting = (d: Date) => {
  const h = (d.getUTCHours() + 3) % 24; // Israel time for the synthetic org
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

type Item = Awaited<ReturnType<typeof api.listInsights>>[number];

function Lane({ title, hint, items, empty }: { title: string; hint: string; items: Item[]; empty: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <SectionTitle aside={<span className="text-xs text-muted">{hint}</span>}>{title}</SectionTitle>
      {items.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      {items.map((i) => {
        const band = i.local?.band ?? i.priorityBand;
        const score = i.local?.score ?? i.priorityScore;
        return (
          <Link
            key={i.id}
            href={`/insights/${i.id}`}
            className="group flex items-start gap-4 rounded-xl border border-line bg-panel/90 px-4 py-3.5 no-underline transition-colors hover:border-accent/60"
          >
            <Band
              band={band}
              score={score}
              title={i.local ? `For ${i.local.scopeName}: ${i.local.band}. Group-wide: ${i.priorityBand}.` : undefined}
            />
            <div className="flex min-w-0 grow flex-col gap-1">
              <span className="text-[15px] font-semibold leading-snug group-hover:text-accent">{i.title}</span>
              <span className="text-[13px] text-muted">
                {i.ownerDepartmentName ? `Owner: ${i.ownerDepartmentName}` : ""}
                {i.primaryUnitName !== i.ownerDepartmentName
                  ? `${i.ownerDepartmentName ? " · " : ""}${i.primaryUnitName}`
                  : ""}
                {i.local && i.local.band !== i.priorityBand && (
                  <>
                    {" · "}
                    <span className="text-ink">
                      {i.local.band} for {i.local.scopeName}
                    </span>{" "}
                    (group {i.priorityBand})
                  </>
                )}
              </span>
            </div>
            <Pill>{STATUS[i.status] ?? i.status}</Pill>
          </Link>
        );
      })}
    </section>
  );
}

export default async function Home() {
  const { actor, me } = await requireActor();
  const [insights, approvals, now] = await Promise.all([api.listInsights(actor), api.myApprovals(actor), demoNow()]);
  const live = insights.filter((i) => i.status === "open" || i.status === "acknowledged");
  const closed = insights.filter((i) => i.status === "resolved" || i.status === "dismissed");
  const risks = live.filter((i) => i.workstream === "risk");
  const opps = live.filter((i) => i.workstream === "opportunity");
  const top = risks.filter((i) => (i.local?.band ?? i.priorityBand) === "P1").length;
  const first = me.name.split(" ")[0];
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight">
          {greeting(now)}, {first}
        </h1>
        <p className="text-sm text-muted">
          {me.title} ·{" "}
          {live.length === 0
            ? "Nothing needs attention in your scope right now."
            : `${risks.length} risk${risks.length === 1 ? "" : "s"}${top ? ` (${top} P1)` : ""} and ${opps.length} opportunit${opps.length === 1 ? "y" : "ies"} in your scope.`}
        </p>
      </div>
      {approvals.length > 0 && (
        <Card className="border-accent/50 shadow-[0_0_24px_rgb(34_211_238/0.08)]">
          <SectionTitle
            aside={
              <Link href="/approvals" className="text-sm text-accent">
                Review all →
              </Link>
            }
          >
            Waiting on you · {approvals.length}
          </SectionTitle>
          <ul className="mt-3 flex flex-col gap-2">
            {approvals.map((a) => (
              <li key={a.approval.id} className="flex flex-wrap items-center gap-3 text-sm">
                <Band band={a.band} />
                <span className="font-semibold">{a.action.title}</span>
                <span className="text-muted">· {a.insightTitle}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Lane
          title={`Risks · ${risks.length}`}
          hint="Ranked by priority (P1–P4) for your scope"
          items={risks}
          empty="No risks in your scope."
        />
        <Lane
          title={`Opportunities · ${opps.length}`}
          hint="O1 pursue · O2 plan · O3 watch"
          items={opps}
          empty="No opportunities in your scope."
        />
      </div>
      {closed.length > 0 && (
        <Lane
          title={`Recently resolved · ${closed.length}`}
          hint="Closed with a measured outcome or a recorded reason"
          items={closed}
          empty=""
        />
      )}
    </>
  );
}
