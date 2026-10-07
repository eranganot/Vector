import { api } from "@/app/_lib/api";
import { ActionCenterScreen } from "../../_components/action-center";
import { getLocale, getT } from "../../_lib/locale";
import { requireActor } from "../../_lib/session";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Action Center (plan v2, E4; action-center.md): what can become an action now, ranked by ₪ × urgency, one button
 * each; the selected item with whom it involves, the steps, what VECTOR will do on approval and the message to send.
 * Nothing leaves VECTOR without the person's approval, and in the demo nothing leaves VECTOR at all (FB-8).
 */
export default async function ActionCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; done?: string; error?: string }>;
}) {
  const { actor } = await requireActor();
  const t = await getT();
  const locale = await getLocale();
  const { item, done, error } = await searchParams;
  const v = await api.actionCenter(actor, item && UUID.test(item) ? item : undefined, locale === "he" ? "he" : "en");
  if (!v) return <p className="text-sm text-muted">{t("Nothing in your scope yet.")}</p>;
  return <ActionCenterScreen v={v} locale={locale} done={done} error={error} />;
}
