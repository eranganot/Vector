/**
 * The only entry point the UI uses. Binds the database and the active org's context to the
 * application's queries and commands, so UI code never touches the database (lint-enforced).
 */
import { verifyAuditChain } from "./audit";
import {
  acceptDecision,
  acknowledgeInsight,
  amendAction,
  cancelAction,
  declineDecision,
  denyApproval,
  dismissInsight,
  executeReadyActions,
  grantApproval,
  retryAction,
} from "./commands/lifecycle";
import { unitsByIds } from "./commands/shared";
import { authorizeUser } from "@/domain/policy/authorize";
import type { Capability } from "@/domain/policy/permissions";
import { reviewOutcome } from "./commands/outcomes";
import {
  cancelCommitment,
  completeCommitment,
  recordCommitment,
  type RecordCommitmentInput,
  renegotiateCommitment,
} from "./commands/commitments";
import { commitmentFormOptions, commitmentsForInsight, commitmentsView } from "./queries/commitments";
import { type ActionFilter, actionsView, lessonsForInsight, outcomesView } from "./queries/actions";
import { type AuditFilter, auditExplorer } from "./queries/audit";
import type { CommitmentEffect } from "@/domain/commitments";
import { activeOrgId, createContext, loadUserActor } from "./context";
import {
  canDecide,
  getInsightTrace,
  listInsights,
  listMyActions,
  listMyApprovalHistory,
  listMyApprovals,
  listMyDecisions,
} from "./queries/insights";
import { executiveHome } from "./queries/executive";
import { workstreamMoney } from "./queries/money";
import { valueMap } from "./queries/value-map";
import { commandCenter, orgTree, performanceView } from "./queries/performance";
import { advanceClock, resetDemo } from "./scenario";
import { getDb } from "@/infra/db/client";
import { demoClock, user } from "@/infra/db/schema";
import { eq } from "drizzle-orm";
import type { Actor } from "@/domain/types";
import type { Db } from "./db";

const db = () => getDb() as unknown as Db;

export type SessionInfo = { userId: string; sessionId: string; viaDemoSwitcher: boolean; sessionStartedAt: Date };

export async function actorFor(s: SessionInfo): Promise<Actor> {
  return loadUserActor(db(), await activeOrgId(db()), s.userId, {
    sessionId: s.sessionId,
    viaDemoSwitcher: s.viaDemoSwitcher,
    // AZ-3 is about real time (how long ago the person signed in), never the demo clock.
    sessionAgeHours: (Date.now() - s.sessionStartedAt.getTime()) / 3_600_000,
  });
}

export async function demoNow(): Promise<Date> {
  const orgId = await activeOrgId(db());
  const [row] = await db().select().from(demoClock).where(eq(demoClock.orgId, orgId));
  return row?.now ?? new Date();
}

export async function seededPeople() {
  const orgId = await activeOrgId(db());
  return db()
    .select({ id: user.id, name: user.name, title: user.title, email: user.email })
    .from(user)
    .where(eq(user.orgId, orgId));
}

export async function profile(userId: string) {
  const [u] = await db()
    .select({ id: user.id, name: user.name, title: user.title, email: user.email, isCSuite: user.isCSuite })
    .from(user)
    .where(eq(user.id, userId));
  return u;
}

const ctx = () => createContext(db());

export const api = {
  listInsights: async (a: Actor) => listInsights(db(), await activeOrgId(db()), a),
  trace: async (a: Actor, id: string) => getInsightTrace(db(), await activeOrgId(db()), a, id),
  myApprovals: async (a: Actor) => listMyApprovals(db(), await activeOrgId(db()), a),
  myDecisions: async (a: Actor) => listMyDecisions(db(), await activeOrgId(db()), a),
  myActions: async (a: Actor) => listMyActions(db(), await activeOrgId(db()), a),
  canDecide: async (a: Actor, insightId: string) => canDecide(db(), await activeOrgId(db()), a, insightId),
  performance: async (a: Actor) => performanceView(db(), await activeOrgId(db()), a),
  unit: async (a: Actor, unitId: string) => performanceView(db(), await activeOrgId(db()), a, unitId),
  commandCenter: async (a: Actor) => commandCenter(db(), await activeOrgId(db()), a),
  executiveHome: async (a: Actor, unitId?: string) => executiveHome(db(), await activeOrgId(db()), a, { unitId }),
  valueMap: async (a: Actor, insightIds: string[]) => valueMap(db(), await activeOrgId(db()), a, insightIds),
  workstreamMoney: async (a: Actor, insightIds: string[]) =>
    workstreamMoney(db(), await activeOrgId(db()), a, insightIds),
  orgTree: async (a: Actor) => orgTree(db(), await activeOrgId(db()), a),
  verifyChain: async () => verifyAuditChain(db(), await activeOrgId(db())),
  acceptDecision: async (a: Actor, decisionId: string, rationale?: string) => {
    const c = await ctx();
    await acceptDecision(c, a, decisionId, rationale);
    await executeReadyActions(c);
  },
  declineDecision: async (a: Actor, decisionId: string, rationale: string) =>
    declineDecision(await ctx(), a, decisionId, rationale),
  grant: async (a: Actor, actionId: string, rationale?: string) => {
    const c = await ctx();
    await grantApproval(c, a, actionId, rationale);
    await executeReadyActions(c);
  },
  deny: async (a: Actor, actionId: string, rationale: string) => denyApproval(await ctx(), a, actionId, rationale),
  review: async (a: Actor, outcomeId: string, lesson: string) => reviewOutcome(await ctx(), a, outcomeId, { lesson }),
  commitments: async (a: Actor, unitId?: string) => commitmentsView(db(), await activeOrgId(db()), a, unitId),
  commitmentsForInsight: async (a: Actor, insightId: string) =>
    commitmentsForInsight(db(), await activeOrgId(db()), a, insightId),
  commitmentFormOptions: async (a: Actor) => commitmentFormOptions(db(), await activeOrgId(db()), a),
  recordCommitment: async (a: Actor, input: RecordCommitmentInput) => recordCommitment(await ctx(), a, input),
  completeCommitment: async (a: Actor, id: string) => completeCommitment(await ctx(), a, id),
  renegotiateCommitment: async (
    a: Actor,
    id: string,
    input: { dueAt: Date; rationale: string; effects?: CommitmentEffect[] },
  ) => renegotiateCommitment(await ctx(), a, id, input),
  cancelCommitment: async (a: Actor, id: string, rationale: string) => cancelCommitment(await ctx(), a, id, rationale),
  audit: async (a: Actor, f?: AuditFilter) => auditExplorer(db(), await activeOrgId(db()), a, f),
  actions: async (a: Actor, filter?: ActionFilter, unitId?: string) =>
    actionsView(db(), await activeOrgId(db()), a, filter, unitId),
  outcomes: async (a: Actor, unitId?: string) => outcomesView(db(), await activeOrgId(db()), a, unitId),
  lessonsFor: async (a: Actor, insightId: string) => lessonsForInsight(db(), await activeOrgId(db()), a, insightId),
  approvalHistory: async (a: Actor) => listMyApprovalHistory(db(), await activeOrgId(db()), a),
  /** Cosmetic (every command re-checks): may this person use this capability over these units? */
  may: async (a: Actor, capability: Capability, unitIds: string[]) => {
    if (a.kind !== "user") return false;
    const units = await unitsByIds(db(), await activeOrgId(db()), unitIds);
    return authorizeUser(a, capability, { targetUnits: units }).ok;
  },
  acknowledge: async (a: Actor, insightId: string) => acknowledgeInsight(await ctx(), a, insightId),
  dismiss: async (a: Actor, insightId: string, rationale: string) =>
    dismissInsight(await ctx(), a, insightId, rationale),
  cancelAction: async (a: Actor, actionId: string, rationale: string) =>
    cancelAction(await ctx(), a, actionId, rationale),
  amendAction: async (a: Actor, actionId: string, estimatedCost: number, note?: string) => {
    const c = await ctx();
    await amendAction(c, a, actionId, { estimatedCost, ...(note ? { params: { amendNote: note } } : {}) });
    await executeReadyActions(c); // an amendment that needs no approval goes straight to ready
  },
  retryAction: async (a: Actor, actionId: string) => {
    const c = await ctx();
    await retryAction(c, a, actionId);
    await executeReadyActions(c);
  },
  advanceClock: (a: Actor, hours: number) => advanceClock(db(), a, hours),
  resetDemo: (a: Actor, password: string) => resetDemo(db(), a, password),
};
export type { KpiStat, PerformanceView } from "./queries/performance";
export type { ExecutiveHome, MoneyLine } from "./queries/executive";
export type { ValuePoint } from "./queries/value-map";
export { headlineFor } from "./queries/performance";
export type { ActionFilter } from "./queries/actions";

export { parseInput } from "./inputs";
