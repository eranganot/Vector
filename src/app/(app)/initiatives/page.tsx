import { notFound } from "next/navigation";
import { api, localized } from "@/app/_lib/api";
import { InitiativesPage } from "../../_components/initiatives";
import { ils, MoneyHeader } from "../../_components/money-header";
import { Notice } from "../../_components/ui";
import { getT } from "../../_lib/locale";
import { can, requireActor } from "../../_lib/session";

const KEY = /^[A-Z0-9-]{2,40}$/;

/** Cross-department (plan v2, E3; cross-department.md §3): shared projects and processes that need management. */
export default async function CrossDepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ i?: string; f?: string; item?: string; done?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const { actor, me } = await requireActor();
  const t = await getT();
  if (sp.i && !KEY.test(sp.i)) notFound();
  const v = await api.initiatives(actor, sp.i);
  if (!v || "notFound" in v) notFound(); // an initiative outside your scope looks missing
  const DONE: Record<string, string> = {
    milestone_done: t("Milestone marked done."),
    milestone_moved: t("Date moved. Everyone in the initiative sees the change and your reason."),
    barrier_resolved: t("Barrier resolved."),
    barrier_raised: t("Barrier raised. The sponsor sees it."),
    reminder_sent: t("Reminder sent inside VECTOR."),
  };
  const name = (await localized(me)).name;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight">{t("Cross-department")}</h1>
        <p className="text-sm text-muted">
          {v.items.length === 0
            ? t("No cross-department initiative includes your units.")
            : t("{n} initiatives · {k} need management · {y} need you", {
                n: v.items.length,
                k: v.money.flagged,
                y: v.money.needYou,
              })}
        </p>
      </div>
      <Notice error={sp.error} done={sp.done ? DONE[sp.done] : undefined} />
      {v.items.length > 0 && (
        <MoneyHeader
          label={t("Money")}
          figures={[
            {
              icon: "₪",
              label: t("budget"),
              value: ils(v.money.budget),
              hint: t("Budget of the initiatives shown"),
              tone: "muted",
            },
            {
              icon: "↘",
              label: t("spent"),
              value: ils(v.money.spent),
              hint: t("Spent so far"),
              tone: v.money.spent > v.money.budget ? "bad" : "accent",
            },
            {
              icon: "!",
              label: t("value at risk"),
              value: ils(v.money.valueAtRisk),
              hint: t("Value of the initiatives that are blocked or at risk"),
              tone: "bad",
            },
            {
              icon: "⚑",
              label: t("need management"),
              value: `${v.money.flagged}`,
              hint: t("Initiatives with a rule M1–M5 flag"),
              tone: "warn",
            },
          ]}
        />
      )}
      <InitiativesPage
        v={v}
        t={t}
        name={name}
        canRaise={can(actor, "executive") || can(actor, "department_manager")}
        f={sp.f && ["attention", "waiting", "progress", "done", "you"].includes(sp.f) ? sp.f : undefined}
        item={sp.item && /^(ms|br|ac|cf):[0-9a-f-]{36}$|^budget$/.test(sp.item) ? sp.item : undefined}
      />
    </>
  );
}
