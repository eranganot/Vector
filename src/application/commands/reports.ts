/**
 * Generate a report (plan v2, E5; reports.md §3): resolves the layout as of the demo clock and stores it as an immutable
 * snapshot, versioned per template, scope and language, with a content hash. Authorized (report.generate, and the scope
 * must be one the person may read) and audited in the same transaction.
 */
import { createHash } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { DomainError } from "@/domain/errors";
import { hasPermission } from "@/domain/policy/permissions";
import { REPORT_MODEL, type Layout } from "@/domain/report";
import type { Actor } from "@/domain/types";
import { orgUnit, report } from "@/infra/db/schema";
import { type AppContext, runCommand } from "../context";
import { resolveReport } from "../queries/report-data";

export type GenerateReportInput = { scopeUnitId: string; layout: Layout; language: "en" | "he" };

export async function generateReport(ctx: AppContext, actor: Actor, input: GenerateReportInput) {
  return runCommand(
    ctx,
    actor,
    "report.generate",
    { entityType: "org_unit", entityId: input.scopeUnitId },
    async ({ tx, now, audit }) => {
      if (actor.kind !== "user" || !actor.assignments.some((a) => hasPermission(a.role, "report.generate")))
        throw new DomainError("PermissionDenied", "you cannot generate reports");
      if (input.layout.blocks.length === 0) throw new DomainError("Invalid", "add at least one chart");
      const resolved = await resolveReport(tx, ctx.orgId, actor, {
        scopeUnitId: input.scopeUnitId,
        layout: input.layout,
      });
      // A scope you may not read looks like one that does not exist (ADR-008).
      if (!resolved) throw new DomainError("NotAuthorized", "you may only report on your own scope or a unit below it");
      const content = { model: REPORT_MODEL, asOf: resolved.asOf, scope: resolved.scope, blocks: resolved.blocks };
      const contentHash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
      const [{ n }] = await tx
        .select({ n: count() })
        .from(report)
        .where(
          and(
            eq(report.orgId, ctx.orgId),
            eq(report.template, input.layout.template),
            eq(report.scopeUnitId, input.scopeUnitId),
            eq(report.language, input.language),
          ),
        );
      const [u] = await tx.select().from(orgUnit).where(eq(orgUnit.id, input.scopeUnitId));
      const [row] = await tx
        .insert(report)
        .values({
          orgId: ctx.orgId,
          template: input.layout.template,
          version: Number(n) + 1,
          scopeUnitId: input.scopeUnitId,
          asOf: now,
          generatedBy: actor.userId,
          language: input.language,
          layout: input.layout,
          content,
          contentHash,
          visibleUnitIds: [u.id],
          createdAt: now,
        })
        .returning();
      await audit({
        operation: "report.generated",
        entityType: "report",
        entityId: row.id,
        changes: {
          template: row.template,
          version: row.version,
          scope: resolved.scope.name,
          language: row.language,
          blocks: input.layout.blocks.map((b) => `${b.metric}:${b.kind}${b.period ? `:${b.period}` : ""}`),
          contentHash,
        },
      });
      return row.id;
    },
  );
}
