/**
 * Report layouts travel in the URL (`?l=…`) while the person edits them, so the builder needs no client state: every
 * add, remove, move and edit is a link to the next layout. Encoded as base64url JSON and always re-validated.
 */
import { parseLayout, templateLayout, type Layout, type TemplateId } from "@/domain/report";

export function encodeLayout(l: Layout): string {
  const compact = {
    template: l.template,
    blocks: l.blocks.map((b) => ({
      id: b.id,
      metric: b.metric,
      kind: b.kind,
      period: b.period,
      scopeUnitId: b.scopeUnitId,
    })),
  };
  return Buffer.from(JSON.stringify(compact)).toString("base64url");
}

export function decodeLayout(
  raw: string | undefined,
  template: TemplateId,
  scopeAllowed: (id: string) => boolean,
): Layout {
  if (raw && raw.length < 6000) {
    try {
      const l = parseLayout(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")), scopeAllowed);
      if (l) return l;
    } catch {
      // fall through to the template
    }
  }
  return templateLayout(template);
}
