import Link from "next/link";
import type { api } from "@/application/facade";
import { Band, Card, SectionTitle } from "./ui";

type Approvals = Awaited<ReturnType<typeof api.myApprovals>>;
type Decisions = Awaited<ReturnType<typeof api.myDecisions>>;

/** What is waiting on the signed-in person: decisions to make and approvals to give (compact). */
export function WaitingCard({
  approvals,
  decisions,
  max = 4,
  bandOf = {},
}: {
  approvals: Approvals;
  decisions: Decisions;
  max?: number;
  /** The band this viewer sees for an insight (local priority on a unit view); falls back to the group band. */
  bandOf?: Record<string, string>;
}) {
  const total = approvals.length + decisions.length;
  if (total === 0) return null;
  const rows = [
    ...decisions.map((d) => ({
      key: d.decisionId,
      kind: "Decide",
      band: bandOf[d.insightId] ?? d.band,
      title: d.title,
      href: `/insights/${d.insightId}`,
    })),
    ...approvals.map((a) => ({
      key: a.approval.id,
      kind: "Approve",
      band: bandOf[a.insightId] ?? a.band,
      title: a.action.title,
      href: "/approvals",
    })),
  ];
  return (
    <Card className="border-accent/50 shadow-[0_0_24px_rgb(34_211_238/0.08)]">
      <SectionTitle
        aside={
          <Link href="/approvals" className="text-sm text-accent">
            All {total} →
          </Link>
        }
      >
        Waiting on you · {total}
      </SectionTitle>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.slice(0, max).map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-3 text-sm">
            <Band band={r.band} />
            <span className={`text-xs uppercase tracking-wide ${r.kind === "Decide" ? "text-accent" : "text-warn"}`}>
              {r.kind}
            </span>
            <Link href={r.href} className="font-semibold no-underline hover:underline">
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
