import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Phase 0 holds only system metadata. Domain tables (org units, signals,
 * insights, decisions, actions, approvals, outcomes, audit) arrive in Phase 2.
 */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
