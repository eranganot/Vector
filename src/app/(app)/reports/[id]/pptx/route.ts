/**
 * Editable PowerPoint of a generated report (plan v2, E5b): the snapshot, in its language, as native charts and
 * tables. Only people who may open the report get the file; every download is audited.
 */
import { api } from "@/application/facade";
import { localize } from "@/i18n/content";
import { makeT } from "@/i18n/t";
import { buildDeck } from "@/infra/export/pptx";
import { deckOf } from "../../../../_lib/report-deck";
import { requireActor } from "../../../../_lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const { actor } = await requireActor();
  const r = await api.getReport(actor, id);
  if (!r) return new Response("Not found", { status: 404 });
  const lang = r.language === "he" ? "he" : "en";
  const t = makeT(lang);
  const deck = deckOf(t, { ...r, by: localize(r.by, lang), content: localize(r.content, lang) });
  const file = await buildDeck(deck);
  await api.recordReportDownload(actor, id, "pptx");
  const name = `vector-${r.template.replace(/_/g, "-")}-v${r.version}-${lang}.pptx`;
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
