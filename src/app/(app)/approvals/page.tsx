import Link from "next/link";
import { api, demoNow } from "@/application/facade";
import type { ApprovalRequirement } from "@/domain/policy/approval-rules";
import { approveAction } from "../../actions";
import { Band, Card, Notice, Pill, SectionTitle } from "../../_components/ui";
import { requireActor } from "../../_lib/session";

const ROLE_LABEL: Record<string, string> = {
  executive: "Executive",
  department_manager: "Department Manager",
  regional_manager: "Regional Manager",
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
  const { actor } = await requireActor();
  const [items, decisions, mine, now] = await Promise.all([
    api.myApprovals(actor),
    api.myDecisions(actor),
    api.myActions(actor),
    demoNow(),
  ]);
  const ACTION_STATE: Record<string, string> = {
    proposed: "Waiting for the decision",
    pending_approval: "Waiting for approval",
    ready: "Ready to execute",
    executing: "Executing",
    failed: "Failed: retry or cancel",
  };
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Waiting on you</h1>
        <p className="text-sm text-muted">
          {decisions.length} decision{decisions.length === 1 ? "" : "s"} to make · {items.length} approval
          {items.length === 1 ? "" : "s"} to give · {mine.length} of your action{mine.length === 1 ? "" : "s"} in flight
        </p>
      </div>
      <section className="flex flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">VECTOR recommends; you decide</span>}>
          Decisions to make · {decisions.length}
        </SectionTitle>
        {decisions.length === 0 && (
          <p className="text-sm text-muted">No recommendation is waiting for your decision.</p>
        )}
        {decisions.map((d) => (
          <Link
            key={d.decisionId}
            href={`/insights/${d.insightId}`}
            className="flex flex-wrap items-start gap-4 rounded-xl border border-line bg-panel/90 px-4 py-3.5 no-underline hover:border-accent/60"
          >
            <Band band={d.band} score={d.score} />
            <span className="flex min-w-0 grow flex-col gap-1">
              <span className="text-[15px] font-semibold">{d.title}</span>
              <span className="text-[13px] text-muted">Recommendation: {d.statement}</span>
            </span>
            <span className="text-sm text-accent">Accept or decline →</span>
          </Link>
        ))}
      </section>
      <SectionTitle>Approvals to give · {items.length}</SectionTitle>
      <Notice
        error={error}
        done={
          done === "grant"
            ? "Approved. Execution started (simulated)."
            : done === "deny"
              ? "Denied. The action is rejected."
              : undefined
        }
      />
      {items.length === 0 && <p className="text-sm text-muted">No approval request is waiting for you.</p>}
      {items.map(({ approval, action, insightTitle, band, insightId }) => {
        const req = approval.requirement as ApprovalRequirement;
        const matched = req.rules.filter((r) => r.matched);
        const hoursLeft = Math.max(0, 72 - (now.getTime() - approval.requestedAt.getTime()) / 3_600_000);
        return (
          <Card key={approval.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Band band={band} />
              <span className="text-muted">
                For insight: {insightTitle} ·{" "}
                <Link href={`/insights/${insightId}`} className="underline">
                  open full trace
                </Link>
              </span>
            </div>
            <h2 className="text-xl font-semibold">{action.title}</h2>
            <div className="flex flex-col gap-1 rounded-lg bg-ground px-4 py-3 text-sm">
              <b>Why you are asked</b>
              {matched.map((r) => (
                <span key={r.rule}>
                  {r.rule} {r.name} ({r.reason}) →{" "}
                  {[...new Set(r.eligible.map((o) => ROLE_LABEL[o.role] ?? o.role))].join(" or ")}
                </span>
              ))}
              <span className="text-[13px] text-muted">
                You are eligible under every rule, and you neither proposed nor own this action.
              </span>
            </div>
            <div className="font-mono text-[13px] text-muted">
              Cost ₪{Number(action.estimatedCost).toLocaleString("en-US")} · revision {action.revision} · request
              expires in about {Math.round(hoursLeft)} h (demo clock)
            </div>
            <form action={approveAction} className="flex flex-col gap-3">
              <input type="hidden" name="actionId" value={action.id} />
              <label htmlFor={`note-${approval.id}`} className="text-[13px] font-semibold">
                Note (required if you deny)
              </label>
              <textarea
                id={`note-${approval.id}`}
                name="rationale"
                rows={2}
                className="rounded-lg border border-line px-3 py-2"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  name="verdict"
                  value="grant"
                  className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink"
                >
                  Approve
                </button>
                <button name="verdict" value="deny" className="rounded-lg border border-ink bg-panel px-5 py-2.5">
                  Deny
                </button>
                <span className="text-xs text-muted">
                  Recorded with your name, time and session. Silence never approves.
                </span>
              </div>
            </form>
          </Card>
        );
      })}
      <section className="flex flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">actions you own</span>}>
          Your actions in flight · {mine.length}
        </SectionTitle>
        {mine.length === 0 && <p className="text-sm text-muted">You own no open actions.</p>}
        {mine.map(({ action: a, insightTitle, insightId, band, waitingOn }) => (
          <Link
            key={a.id}
            href={`/insights/${insightId}`}
            className="flex flex-wrap items-start gap-4 rounded-xl border border-line bg-panel/90 px-4 py-3.5 no-underline hover:border-accent/60"
          >
            <Band band={band} />
            <span className="flex min-w-0 grow flex-col gap-1">
              <span className="text-[15px] font-semibold">{a.title}</span>
              <span className="text-[13px] text-muted">
                {insightTitle}
                {waitingOn.length > 0 && ` · approver: ${waitingOn.join(" or ")}`}
              </span>
            </span>
            <Pill tone={a.status === "pending_approval" ? "warn" : a.status === "failed" ? "bad" : "neutral"}>
              {ACTION_STATE[a.status] ?? a.status}
            </Pill>
          </Link>
        ))}
      </section>
    </>
  );
}
