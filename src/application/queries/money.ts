/**
 * The ₪ header of the Risks and Opportunities tabs (plan v2, E2c; executive-home.md §6), for the items the page
 * shows (scope and band filter). Read-only; visibility is re-checked here, so ids the viewer may not read are ignored.
 */
import { and, arrayOverlaps, eq, inArray } from "drizzle-orm";
import { endOfQuarter } from "@/domain/economics";
import { opportunityHeader, riskHeader } from "@/domain/money-headers";
import type { Actor } from "@/domain/types";
import { action, demoClock, insight, outcome } from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { readScope } from "./insights";

type Input = Record<string, number | string | undefined>;

export async function workstreamMoney(db: DbOrTx, orgId: string, actor: Actor, insightIds: string[]) {
  const scope = readScope(actor);
  if (scope.length === 0 || insightIds.length === 0) return null;
  const [rows, [clock]] = await Promise.all([
    db
      .select({
        id: insight.id,
        workstream: insight.workstream,
        band: insight.priorityBand,
        confidence: insight.confidence,
        breakdown: insight.priorityBreakdown,
      })
      .from(insight)
      .where(
        and(eq(insight.orgId, orgId), inArray(insight.id, insightIds), arrayOverlaps(insight.visibleUnitIds, scope)),
      ),
    db.select().from(demoClock).where(eq(demoClock.orgId, orgId)),
  ]);
  if (rows.length === 0) return null;
  const ids = rows.map((r) => r.id);
  const acts = await db
    .select({ id: action.id, insightId: action.insightId, status: action.status })
    .from(action)
    .where(inArray(action.insightId, ids));
  const outs = acts.length
    ? await db
        .select({ actionId: outcome.actionId, verdict: outcome.verdict })
        .from(outcome)
        .where(
          inArray(
            outcome.actionId,
            acts.map((a) => a.id),
          ),
        )
    : [];
  const input = (r: (typeof rows)[number]) => ((r.breakdown as { input?: Input })?.input ?? {}) as Input;
  const statuses = (id: string) => acts.filter((a) => a.insightId === id).map((a) => a.status as string);
  const verdicts = (id: string) =>
    outs
      .filter((o) => acts.some((a) => a.id === o.actionId && a.insightId === id))
      .map((o) => o.verdict)
      .filter((v): v is NonNullable<typeof v> => !!v);
  const now = clock?.now ?? new Date();
  const weeksToEoq = Math.max(1, Math.round((endOfQuarter(now).getTime() - now.getTime()) / (7 * 86_400_000)));
  const risks = rows.filter((r) => r.workstream === "risk");
  const opps = rows.filter((r) => r.workstream === "opportunity");
  return {
    risk: risks.length
      ? riskHeader(
          risks.map((r) => ({
            band: r.band,
            impactIls: Number(input(r).impactIls ?? 0),
            actionStatuses: statuses(r.id),
          })),
        )
      : null,
    opportunity: opps.length
      ? opportunityHeader(
          opps.map((r) => ({
            valueIls: Number(input(r).valueIls ?? 0),
            costIls: Number(input(r).costIls ?? 0),
            confidence: r.confidence,
            actionStatuses: statuses(r.id),
            verdicts: verdicts(r.id),
          })),
          weeksToEoq,
        )
      : null,
    weeksToEoq,
  };
}
