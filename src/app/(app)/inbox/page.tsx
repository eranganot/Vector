import { api } from "@/app/_lib/api";
import { InboxScreen } from "../../_components/inbox";
import { Notice } from "../../_components/ui";
import { getLocale, getT } from "../../_lib/locale";
import { requireActor } from "../../_lib/session";

/** Inbox (plan v2, E7; mail-agent.md): threads that need you, with impact, recommendation and a suggested reply. */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; q?: string; done?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const { actor } = await requireActor();
  const t = await getT();
  const locale = await getLocale();
  const threadId = sp.t && /^[0-9a-f-]{36}$/i.test(sp.t) ? sp.t : undefined;
  const v = await api.inboxView(actor, threadId);
  if (!v || v.threads.length === 0)
    return (
      <>
        <h1 className="text-[26px] font-semibold tracking-tight">{t("Inbox")}</h1>
        <p className="text-sm text-muted">{t("No inbox is connected for you in the demo.")}</p>
      </>
    );
  return (
    <>
      <Notice error={sp.error} done={sp.done} />
      <InboxScreen v={v} t={t} q={sp.q} locale={locale} />
    </>
  );
}
