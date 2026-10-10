import Link from "next/link";
import { day } from "./format";
import type { api } from "@/application/facade";
import { Band, Card, SectionTitle } from "./ui";
import { getT } from "../_lib/locale";

type Approvals = Awaited<ReturnType<typeof api.myApprovals>>;
type Decisions = Awaited<ReturnType<typeof api.myDecisions>>;
type Actions = Awaited<ReturnType<typeof api.myActions>>;

const KIND_STYLE: Record<string, string> = { Decide: "text-accent", Approve: "text-warn", Do: "text-good" };

/**
 * What the signed-in person must act on: decisions to make, approvals to give, and the tasks they own
 * (Eran, 2026-10-04: "actions I need to take" on every home). Compact; the full list is Waiting on you.
 */
export async function WaitingCard({
  approvals,
  decisions,
  actions = [],
  max = 5,
  showEmpty = false,
  bandOf = {},
}: {
  approvals: Approvals;
  decisions: Decisions;
  actions?: Actions;
  max?: number;
  showEmpty?: boolean;
  /** The band this viewer sees for an insight (local priority on a unit view); falls back to the group band. */
  bandOf?: Record<string, string>;
}) {
  const t = await getT();
  const rows = [
    ...decisions.map((d) => ({
      key: d.decisionId,
      kind: "Decide",
      band: bandOf[d.insightId] ?? d.band,
      title: d.title,
      href: `/insights/${d.insightId}`,
      note: t("accept or decline VECTOR's recommendation"),
    })),
    ...approvals.map((a) => ({
      key: a.approval.id,
      kind: "Approve",
      band: bandOf[a.insightId] ?? a.band,
      title: a.action.title,
      href: "/approvals",
      note: a.insightTitle,
    })),
    ...actions.map((a) => ({
      key: a.action.id,
      kind: "Do",
      band: bandOf[a.insightId] ?? a.band,
      title: a.action.title,
      href: `/insights/${a.insightId}`,
      note:
        a.action.status === "pending_approval"
          ? a.waitingOn.length
            ? t("your task · waiting for approval by {who}", { who: a.waitingOn.join(", ") })
            : t("your task · waiting for approval")
          : a.action.dueAt
            ? t("your task · {status} · due {date}", {
                status: t(a.action.status.replace("_", " ")),
                date: day(t, a.action.dueAt),
              })
            : t("your task · {status}", { status: t(a.action.status.replace("_", " ")) }),
    })),
  ];
  const total = rows.length;
  if (total === 0 && !showEmpty) return null;
  const counts = (["Decide", "Approve", "Do"] as const)
    .map((k) => ({ k, n: rows.filter((r) => r.kind === k).length }))
    .filter((c) => c.n > 0);
  return (
    <Card className={total ? "border-accent/50 shadow-[0_0_24px_rgb(34_211_238/0.08)]" : ""}>
      <SectionTitle
        aside={
          total > 0 && (
            <Link href="/approvals" className="text-sm text-accent">
              {t("All {n} →", { n: total })}
            </Link>
          )
        }
      >
        {t("Waiting on you · {n}", { n: total })}
      </SectionTitle>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {t("Nothing needs your decision or approval, and you own no open task.")}
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            {counts
              .map((c) =>
                c.k === "Decide"
                  ? c.n === 1
                    ? t("{n} decision", { n: c.n })
                    : t("{n} decisions", { n: c.n })
                  : c.k === "Approve"
                    ? c.n === 1
                      ? t("{n} approval", { n: c.n })
                      : t("{n} approvals", { n: c.n })
                    : c.n === 1
                      ? t("{n} task you own", { n: c.n })
                      : t("{n} tasks you own", { n: c.n }),
              )
              .join(" · ")}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {rows.slice(0, max).map((r) => (
              <li key={r.key} className="grid grid-cols-[auto_4.5rem_minmax(0,1fr)] items-baseline gap-x-3 text-sm">
                <Band band={r.band} />
                <span className={`text-xs uppercase tracking-wide ${KIND_STYLE[r.kind]}`}>{t(r.kind)}</span>
                <span className="min-w-0">
                  <Link href={r.href} className="font-semibold no-underline hover:underline">
                    {r.title}
                  </Link>
                  <span className="ms-2 text-xs text-muted">{r.note}</span>
                </span>
              </li>
            ))}
          </ul>
          {total > max && (
            <p className="mt-2 text-xs text-muted">{t("+{n} more in Waiting on you", { n: total - max })}</p>
          )}
        </>
      )}
    </Card>
  );
}
