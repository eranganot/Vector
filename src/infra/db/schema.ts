/**
 * Database schema. Mirrors docs/specs/domain-model.md (Phase 2 entities) and
 * docs/specs/authorization.md §6 (audit_event). State columns hold the values of
 * the domain state machines in src/domain; only application commands change them.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const ts = (name: string) => timestamp(name, { withTimezone: true });
const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const orgId = () =>
  uuid("org_id")
    .notNull()
    .references(() => organization.id);

// ── Enums ────────────────────────────────────────────────────────────────────
export const orgUnitType = pgEnum("org_unit_type", ["group", "region", "branch", "department"]);
export const roleName = pgEnum("role_name", ["admin", "executive", "department_manager", "regional_manager", "viewer"]);
export const insightStatus = pgEnum("insight_status", ["open", "acknowledged", "dismissed", "resolved", "superseded"]);
export const decisionStatus = pgEnum("decision_status", ["recommended", "decided", "declined", "superseded"]);
export const decisionOrigin = pgEnum("decision_origin", ["vector_recommended", "human_authored"]);
export const actionStatus = pgEnum("action_status", [
  "proposed",
  "pending_approval",
  "rejected",
  "ready",
  "executing",
  "executed",
  "failed",
  "cancelled",
]);
export const approvalStatus = pgEnum("approval_status", [
  "requested",
  "granted",
  "denied",
  "expired",
  "withdrawn",
  "lapsed",
]);
export const outcomeStatus = pgEnum("outcome_status", ["observing", "evaluated", "reviewed"]);
export const outcomeVerdict = pgEnum("outcome_verdict", ["worked", "partially_worked", "did_not_work", "inconclusive"]);

// ── Organization ─────────────────────────────────────────────────────────────
/** A tenant. Demo resets create a new organization ("epoch") instead of deleting audit history. */
export const organization = pgTable("organization", {
  id: id(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  seedVersion: text("seed_version"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const orgUnit = pgTable(
  "org_unit",
  {
    id: id(),
    orgId: orgId(),
    type: orgUnitType("type").notNull(),
    parentId: uuid("parent_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    city: text("city"),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    sizeClass: text("size_class"),
    /** Ids of this unit and all its ancestors, root first. Used for scope checks in SQL. */
    pathIds: uuid("path_ids").array().notNull(),
  },
  (t) => [uniqueIndex("org_unit_code_uq").on(t.orgId, t.code), index("org_unit_parent_idx").on(t.parentId)],
);

// ── Auth (Better Auth tables; extra fields: orgId, title, isSeeded) ──────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  orgId: uuid("org_id").references(() => organization.id),
  title: text("title"),
  isSeeded: boolean("is_seeded").notNull().default(false),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const roleAssignment = pgTable(
  "role_assignment",
  {
    id: id(),
    orgId: orgId(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: roleName("role").notNull(),
    orgUnitId: uuid("org_unit_id")
      .notNull()
      .references(() => orgUnit.id),
    /** The head of the unit for this role (e.g. the VP of a department with several managers). One per unit and role. */
    isHead: boolean("is_head").notNull().default(false),
  },
  (t) => [uniqueIndex("role_assignment_uq").on(t.userId, t.role, t.orgUnitId)],
);

// ── KPIs ─────────────────────────────────────────────────────────────────────
export const kpi = pgTable(
  "kpi",
  {
    id: id(),
    orgId: orgId(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    higherIsBetter: boolean("higher_is_better").notNull(),
    strategicWeight: doublePrecision("strategic_weight").notNull(),
    ownerDepartmentId: uuid("owner_department_id").references(() => orgUnit.id),
    /** "branch" (observed per branch) or "department" (observed on the department unit). */
    level: text("level").notNull().default("branch"),
    /** Plan / target level for dashboards; null = compared with the usual level only. */
    target: doublePrecision("target"),
  },
  (t) => [uniqueIndex("kpi_code_uq").on(t.orgId, t.code)],
);

export const kpiObservation = pgTable(
  "kpi_observation",
  {
    orgId: orgId(),
    kpiId: uuid("kpi_id")
      .notNull()
      .references(() => kpi.id),
    orgUnitId: uuid("org_unit_id")
      .notNull()
      .references(() => orgUnit.id),
    day: date("day").notNull(),
    value: doublePrecision("value").notNull(),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.kpiId, t.orgUnitId, t.day] })],
);

// ── Lifecycle ────────────────────────────────────────────────────────────────
export const signal = pgTable(
  "signal",
  {
    id: id(),
    orgId: orgId(),
    type: text("type").notNull(),
    source: text("source").notNull(),
    detector: text("detector").notNull(),
    detectorVersion: text("detector_version").notNull(),
    observedAt: ts("observed_at").notNull(),
    primaryUnitId: uuid("primary_unit_id")
      .notNull()
      .references(() => orgUnit.id),
    measurements: jsonb("measurements").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("signal_dedupe_idx").on(t.orgId, t.dedupeKey)],
);

export const evidence = pgTable("evidence", {
  id: id(),
  orgId: orgId(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  sourceRef: text("source_ref").notNull(),
  capturedAt: ts("captured_at").notNull(),
  payload: jsonb("payload").notNull(),
  payloadHash: text("payload_hash").notNull(),
});

export const insight = pgTable(
  "insight",
  {
    id: id(),
    orgId: orgId(),
    /** "risk" or "opportunity": separate workstreams, scored and ranked separately (ADR-006). */
    workstream: text("workstream").notNull().default("risk"),
    title: text("title").notNull(),
    whatHappened: text("what_happened").notNull(),
    whyItMatters: text("why_it_matters").notNull(),
    primaryUnitId: uuid("primary_unit_id")
      .notNull()
      .references(() => orgUnit.id),
    affectedUnitIds: uuid("affected_unit_ids").array().notNull(),
    /** The department that owns the response (scenarios.md ●); others in affected_unit_ids must act. */
    ownerDepartmentId: uuid("owner_department_id").references(() => orgUnit.id),
    /** Affected units and all their ancestors: a user sees the insight if any of their scope units is here. */
    visibleUnitIds: uuid("visible_unit_ids").array().notNull(),
    signalIds: uuid("signal_ids").array().notNull(),
    evidenceIds: uuid("evidence_ids").array().notNull(),
    confidence: doublePrecision("confidence").notNull(),
    priorityScore: doublePrecision("priority_score").notNull(),
    priorityBand: text("priority_band").notNull(),
    priorityBreakdown: jsonb("priority_breakdown").notNull(),
    priorityModelVersion: text("priority_model_version").notNull(),
    generatedBy: text("generated_by").notNull(),
    status: insightStatus("status").notNull(),
    rationale: text("rationale"),
    version: integer("version").notNull().default(1),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("insight_visible_idx").using("gin", t.visibleUnitIds)],
);

export const decision = pgTable("decision", {
  id: id(),
  orgId: orgId(),
  insightId: uuid("insight_id")
    .notNull()
    .references(() => insight.id),
  statement: text("statement").notNull(),
  rationale: text("rationale"),
  origin: decisionOrigin("origin").notNull(),
  status: decisionStatus("status").notNull(),
  decidedBy: text("decided_by"),
  decidedAt: ts("decided_at"),
  autoRule: text("auto_rule"),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const action = pgTable("action", {
  id: id(),
  orgId: orgId(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decision.id),
  insightId: uuid("insight_id")
    .notNull()
    .references(() => insight.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => user.id),
  proposedBy: text("proposed_by").notNull(),
  targetUnitIds: uuid("target_unit_ids").array().notNull(),
  visibleUnitIds: uuid("visible_unit_ids").array().notNull(),
  dueAt: ts("due_at"),
  estimatedCost: numeric("estimated_cost", { mode: "number" }).notNull().default(0),
  executor: text("executor").notNull(),
  params: jsonb("params").notNull(),
  approvalRequirement: jsonb("approval_requirement"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: actionStatus("status").notNull(),
  attempt: integer("attempt").notNull().default(0),
  /** Action version: bumped when params, targets or cost change; approvals bind to it. */
  revision: integer("revision").notNull().default(1),
  result: jsonb("result"),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const approval = pgTable("approval", {
  id: id(),
  orgId: orgId(),
  actionId: uuid("action_id")
    .notNull()
    .references(() => action.id),
  actionRevision: integer("action_revision").notNull(),
  requirement: jsonb("requirement").notNull(),
  requestedAt: ts("requested_at").notNull(),
  approverUserId: text("approver_user_id").references(() => user.id),
  rationale: text("rationale"),
  decidedAt: ts("decided_at"),
  validUntil: ts("valid_until"),
  status: approvalStatus("status").notNull(),
  version: integer("version").notNull().default(1),
});

export const outcome = pgTable("outcome", {
  id: id(),
  orgId: orgId(),
  actionId: uuid("action_id")
    .notNull()
    .references(() => action.id),
  insightId: uuid("insight_id")
    .notNull()
    .references(() => insight.id),
  kpiId: uuid("kpi_id")
    .notNull()
    .references(() => kpi.id),
  unitIds: uuid("unit_ids").array().notNull(),
  expectedDirection: text("expected_direction").notNull(),
  expectedThreshold: doublePrecision("expected_threshold").notNull(),
  baseline: jsonb("baseline").notNull(),
  windowStart: ts("window_start").notNull(),
  windowEnd: ts("window_end").notNull(),
  observed: jsonb("observed"),
  evidenceIds: uuid("evidence_ids")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  verdict: outcomeVerdict("verdict"),
  verdictBy: text("verdict_by"),
  lesson: text("lesson"),
  status: outcomeStatus("status").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

// ── Simulated executor outputs (D7) ──────────────────────────────────────────
export const task = pgTable("task", {
  id: id(),
  orgId: orgId(),
  actionId: uuid("action_id")
    .notNull()
    .references(() => action.id),
  assigneeUserId: text("assignee_user_id")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  simulated: boolean("simulated").notNull().default(true),
  createdAt: ts("created_at").notNull(),
});

export const outboxMessage = pgTable("outbox_message", {
  id: id(),
  orgId: orgId(),
  actionId: uuid("action_id")
    .notNull()
    .references(() => action.id),
  audience: text("audience").notNull(),
  recipients: text("recipients").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  simulated: boolean("simulated").notNull().default(true),
  createdAt: ts("created_at").notNull(),
});

// ── Demo clock ───────────────────────────────────────────────────────────────
export const demoClock = pgTable("demo_clock", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organization.id),
  now: ts("now").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ── Audit (insert-only; see migration 0002 for grants and triggers) ──────────
export const auditEvent = pgTable(
  "audit_event",
  {
    id: id(),
    seq: bigint("seq", { mode: "number" }).notNull(),
    orgId: orgId(),
    occurredAt: ts("occurred_at").notNull(),
    recordedAt: ts("recorded_at").notNull().defaultNow(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    sessionId: text("session_id"),
    viaDemoSwitcher: boolean("via_demo_switcher").notNull().default(false),
    operation: text("operation").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    reason: text("reason"),
    changes: jsonb("changes").notNull(),
    policy: jsonb("policy"),
    evidenceIds: uuid("evidence_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    aiGenerationId: uuid("ai_generation_id"),
    requestId: text("request_id").notNull(),
    prevHash: bytea("prev_hash").notNull(),
    hash: bytea("hash").notNull(),
  },
  (t) => [uniqueIndex("audit_event_seq_uq").on(t.orgId, t.seq), index("audit_event_entity_idx").on(t.entityId)],
);

// ── Phase 0 ──────────────────────────────────────────────────────────────────
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});
