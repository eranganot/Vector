/**
 * The only entry point the UI uses. Binds the database and the active org's context to the
 * application's queries and commands, so UI code never touches the database (lint-enforced).
 */
import { verifyAuditChain } from "./audit";
import {
  acceptDecision,
  declineDecision,
  denyApproval,
  executeReadyActions,
  grantApproval,
} from "./commands/lifecycle";
import { reviewOutcome } from "./commands/outcomes";
import { activeOrgId, createContext, loadUserActor } from "./context";
import {
  canDecide,
  getInsightTrace,
  listInsights,
  listMyActions,
  listMyApprovals,
  listMyDecisions,
} from "./queries/insights";
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
    .select({ id: user.id, name: user.name, title: user.title, email: user.email })
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
  advanceClock: (a: Actor, hours: number) => advanceClock(db(), a, hours),
  resetDemo: (a: Actor, password: string) => resetDemo(db(), a, password),
};
export type { KpiStat, PerformanceView } from "./queries/performance";
export { headlineFor } from "./queries/performance";

export { parseInput } from "./inputs";
