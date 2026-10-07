/**
 * E3b: the Cross-department tab's read model and commands (cross-department.md §3–§6): derived status and M1–M5,
 * visibility per C-suite persona (ADR-008), "your action items", and audited milestone, barrier and reminder commands.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { createContext, loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import {
  completeMilestone,
  moveMilestone,
  resolveBarrier,
  sendInitiativeReminder,
} from "@/application/commands/initiatives";
import { initiativesView, type InitiativesView } from "@/application/queries/initiatives";
import { resetDemo } from "@/application/scenario";
import { DomainError } from "@/domain/errors";
import * as s from "@/infra/db/schema";
import { seed } from "@/infra/seed/seed";
import { setupDb } from "./helpers";

let owner: Pool;
let app: Pool;
let appDb: Db;
let orgId: string;

const as = async (key: string) => {
  const [u] = await appDb
    .select()
    .from(s.user)
    .where(eq(s.user.email, `${key}@vector-retail.example`));
  return loadUserActor(appDb, orgId, u.id, { sessionId: `in-${key}`, viaDemoSwitcher: true });
};
const view = async (key: string, i?: string) =>
  (await initiativesView(appDb, orgId, await as(key), { key: i })) as InitiativesView;

beforeAll(async () => {
  const d = await setupDb();
  ({ owner, app } = d);
  appDb = d.appDb as Db;
  orgId = (await seed(d.ownerDb as Db, { password: "test-password" })).orgId;
  orgId = (await resetDemo(appDb, await as("admin"), "test-password")).orgId;
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

describe("Cross-department read model (E3b)", () => {
  it("the CEO sees all eight; the three that need management come first", async () => {
    const v = await view("dana");
    expect(v.items).toHaveLength(8);
    expect(v.items.slice(0, 3).map((i) => i.key)).toEqual(["I-NORTH-DC", "I-POS", "I-HOLIDAY"]);
    expect(v.items.slice(3).every((i) => i.flags.length === 0)).toBe(true);
    const north = v.items[0];
    expect(north.status).toBe("blocked");
    expect([...new Set(north.flags.map((f) => f.rule))].sort()).toEqual(["M1", "M2", "M3", "M4"]);
    expect(v.money.flagged).toBe(3);
  });

  it("ADR-008: the CFO and COO see all; Hila (HR) sees only what HR takes part in", async () => {
    for (const k of ["michal", "oren"]) expect((await view(k)).items, k).toHaveLength(8);
    const hila = await view("hila");
    expect(hila.items.map((i) => i.key).sort()).toEqual(["I-BUDGET-REVIEW", "I-HOLIDAY", "I-NORTH-DC", "I-WAGE"]);
    expect(await initiativesView(appDb, orgId, await as("hila"), { key: "I-POS" })).toEqual({ notFound: true });
  });

  it("puts the right people on the hook: the CEO settles the conflict and decides the overtime exception; the sponsor nudges", async () => {
    const dana = await view("dana", "I-NORTH-DC");
    expect(dana.yours.map((y) => y.kind)).toEqual(expect.arrayContaining(["settle", "resolve"]));
    const oren = await view("oren", "I-NORTH-DC"); // sponsor and COO
    expect(oren.yours.map((y) => y.kind)).toEqual(expect.arrayContaining(["remind", "resolve"]));
    const m4 = dana.selected!.flags.find((f) => f.rule === "M4")!;
    expect(m4.stepInNames.sort()).toEqual(["Dana Levi", "Oren Halevi"]);
  });

  it("a reminder reaches the unit that owns the late item; Hila marks it done; the flag clears", async () => {
    const ctx = await createContext(appDb);
    const oren = await view("oren", "I-NORTH-DC");
    const nudge = oren.yours.find((y) => y.kind === "remind" && y.title === "Temporary DC staff hired")!;
    expect(nudge).toBeTruthy();
    await sendInitiativeReminder(ctx, await as("oren"), oren.selected!.id, {
      toUnitId: nudge.toUnitId!,
      subjectKind: "milestone",
      subjectId: nudge.subjectId,
      body: "Temporary DC staff hired is 4 days late. What do you need, and by when?",
    });
    const hila = await view("hila", "I-NORTH-DC");
    expect(hila.yours.some((y) => y.kind === "reminder" && y.title === "Oren Halevi")).toBe(true);
    const mine = hila.yours.find((y) => y.kind === "milestone" && y.title === "Temporary DC staff hired")!;
    await completeMilestone(ctx, await as("hila"), mine.milestoneId!);
    const after = await view("dana", "I-NORTH-DC");
    expect(after.selected!.flags.some((f) => f.rule === "M2" && f.subject.title === "Temporary DC staff hired")).toBe(
      false,
    );
    const events = await appDb
      .select()
      .from(s.auditEvent)
      .where(and(eq(s.auditEvent.orgId, orgId), eq(s.auditEvent.operation, "milestone.completed")));
    expect(events).toHaveLength(1);
  });

  it("refuses changes outside your units (audited) and a date move without a reason", async () => {
    const ctx = await createContext(appDb);
    const v = await view("dana", "I-NORTH-DC");
    const supply = v.selected!.milestones.find((m) => m.title === "Second shift live at the North DC")!;
    await expect(completeMilestone(ctx, await as("hila"), supply.id)).rejects.toBeInstanceOf(DomainError);
    const denied = await appDb
      .select()
      .from(s.auditEvent)
      .where(and(eq(s.auditEvent.orgId, orgId), eq(s.auditEvent.operation, "milestone.complete.denied")));
    expect(denied.length).toBeGreaterThan(0);
    await expect(moveMilestone(ctx, await as("noa"), supply.id, "2026-10-28", "")).rejects.toThrow(/say why/);
    await moveMilestone(ctx, await as("noa"), supply.id, "2026-10-28", "Second crew starts Monday");
    expect((await view("dana", "I-NORTH-DC")).selected!.milestones.find((m) => m.id === supply.id)!.moves).toBe(1);
  });

  it("resolving the overtime barrier unblocks North DC recovery (M1 and M4 clear)", async () => {
    const ctx = await createContext(appDb);
    const v = await view("dana", "I-NORTH-DC");
    const b = v.selected!.barriers.find((x) => x.kind === "decision")!;
    await resolveBarrier(ctx, await as("dana"), b.id, "Exception approved: ₪180k overtime for two weeks");
    const after = (await view("dana", "I-NORTH-DC")).selected!;
    expect(after.flags.map((f) => f.rule)).not.toContain("M4");
    expect(after.flags.filter((f) => f.rule === "M1" && f.subject.id === b.id)).toEqual([]);
  });
});
