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
import { orgUnit, report, reportLayout } from "@/infra/db/schema";

const ZERO = "00000000-0000-0000-0000-000000000000";
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

/** Records a download of a report file (reports.md §3: report.downloaded); the caller has already checked visibility. */
export async function recordReportDownload(ctx: AppContext, actor: Actor, reportId: string, format: "pptx" | "pdf") {
  await runCommand(ctx, actor, "report.download", { entityType: "report", entityId: reportId }, async ({ audit }) => {
    await audit({ operation: "report.downloaded", entityType: "report", entityId: reportId, changes: { format } });
  });
}

/**
 * Save the person's edited layout as their own version of a template (G-E5a). Saving under an existing name replaces
 * that version. Private to its owner; audited.
 */
export async function saveReportLayout(ctx: AppContext, actor: Actor, input: { name: string; layout: Layout }) {
  return runCommand(
    ctx,
    actor,
    "report.layout_save",
    { entityType: "report_layout", entityId: ZERO },
    async ({ tx, now, audit }) => {
      if (actor.kind !== "user" || !actor.assignments.some((a) => hasPermission(a.role, "report.generate")))
        throw new DomainError("PermissionDenied", "you cannot save report layouts");
      const name = input.name.trim();
      if (name.length < 2 || name.length > 60) throw new DomainError("Invalid", "name it (2 to 60 characters)");
      if (input.layout.blocks.length === 0) throw new DomainError("Invalid", "add at least one chart");
      const [existing] = await tx
        .select()
        .from(reportLayout)
        .where(
          and(
            eq(reportLayout.orgId, ctx.orgId),
            eq(reportLayout.ownerUserId, actor.userId),
            eq(reportLayout.name, name),
          ),
        );
      const [row] = existing
        ? await tx
            .update(reportLayout)
            .set({ template: input.layout.template, layout: input.layout, updatedAt: now })
            .where(eq(reportLayout.id, existing.id))
            .returning()
        : await tx
            .insert(reportLayout)
            .values({
              orgId: ctx.orgId,
              ownerUserId: actor.userId,
              name,
              template: input.layout.template,
              layout: input.layout,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
      await audit({
        operation: existing ? "report.layout_updated" : "report.layout_saved",
        entityType: "report_layout",
        entityId: row.id,
        changes: { name, template: row.template, blocks: input.layout.blocks.length },
      });
      return row.id;
    },
  );
}

export async function deleteReportLayout(ctx: AppContext, actor: Actor, id: string) {
  await runCommand(
    ctx,
    actor,
    "report.layout_delete",
    { entityType: "report_layout", entityId: id },
    async ({ tx, audit }) => {
      if (actor.kind !== "user") throw new DomainError("PermissionDenied", "people own layouts");
      const [row] = await tx
        .select()
        .from(reportLayout)
        .where(
          and(eq(reportLayout.orgId, ctx.orgId), eq(reportLayout.id, id), eq(reportLayout.ownerUserId, actor.userId)),
        );
      if (!row) throw new DomainError("NotFound", "layout not found");
      await tx.delete(reportLayout).where(eq(reportLayout.id, id));
      await audit({
        operation: "report.layout_deleted",
        entityType: "report_layout",
        entityId: id,
        changes: { name: row.name },
      });
    },
  );
}
