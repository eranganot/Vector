/** A workstream tab (Risks or Opportunities): every item in scope, ranked, filterable by band (Eran, 2026-10-04). */
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/application/facade";
import type { Actor } from "@/domain/types";
import { laneHref } from "./dashboard";
import { Breadcrumb, InsightCard } from "./unit";
import { Band, Pill, SectionTitle } from "./ui";
import { getT } from "../_lib/locale";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function WorkstreamPage({
  actor,
  ws,
  params,
}: {
  actor: Actor;
  ws: "risk" | "opportunity";
  params: { unit?: string; band?: string };
}) {
  const t = await getT();
  const unit = params.unit && UUID.test(params.unit) ? params.unit : undefined;
  if (params.unit && !unit) notFound();
  const v = unit ? await api.unit(actor, unit) : await api.performance(actor);
  if (!v) notFound(); // a unit outside your scope looks missing
  const bands = ws === "risk" ? ["P1", "P2", "P3", "P4"] : ["O1", "O2", "O3"];
  const band = params.band && bands.includes(params.band) ? params.band : undefined;
  const all = v.items.filter((i) => i.workstream === ws);
  const shown = band ? all.filter((i) => i.band === band) : all;
  const resolved = v.resolved.filter((r) => r.workstream === ws);
  const label = ws === "risk" ? t("Risks") : t("Opportunities");
  const local = v.position === "region" || v.position === "branch";
  return (
    <>
      <div className="flex flex-col gap-2">
        {v.breadcrumb.length > 1 && <Breadcrumb items={v.breadcrumb} />}
        <h1 className="text-[28px] font-semibold tracking-tight">
          {label} · {v.scope.name}
        </h1>
        <p className="text-sm text-muted">
          {ws === "risk"
            ? local
              ? t(
                  "{n} open, ranked by priority (P1–P4), as they matter to {scope} (local priority; group band shown where it differs).",
                  { n: all.length, scope: v.scope.name },
                )
              : t("{n} open, ranked by priority (P1–P4).", { n: all.length })
            : t("{n} open, ranked by value (O1 pursue · O2 plan · O3 watch).", { n: all.length })}
          {unit && (
            <>
              {" "}
              <Link href={laneHref(ws)} className="text-accent">
                {t("Back to your scope")}
              </Link>
            </>
          )}
        </p>
      </div>
      <nav aria-label={t("Filter by band")} className="flex flex-wrap items-center gap-2">
        <Link
          href={laneHref(ws, unit)}
          className={`rounded-lg border px-3 py-1 text-sm no-underline ${!band ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}
        >
          {t("All · {n}", { n: all.length })}
        </Link>
        {bands.map((b) => {
          const n = all.filter((i) => i.band === b).length;
          return (
            <Link
              key={b}
              href={laneHref(ws, unit, b)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1 text-sm no-underline ${band === b ? "border-accent text-ink" : "border-line text-muted hover:text-ink"}`}
            >
              <Band band={b} /> {n}
            </Link>
          );
        })}
      </nav>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{band ? t("Nothing in {band} here.", { band }) : t("Nothing here.")}</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shown.map((i) => (
            <InsightCard key={i.id} i={i} />
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle
            aside={<span className="text-xs text-muted">{t("closed with a measured outcome or a reason")}</span>}
          >
            {t("Recently resolved · {n}", { n: resolved.length })}
          </SectionTitle>
          <ul className="flex flex-col gap-2">
            {resolved.map((r) => (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <Band band={r.band} />
                <Link href={`/insights/${r.id}`} className="no-underline hover:underline">
                  {r.title}
                </Link>
                <Pill tone={r.status === "resolved" ? "good" : "neutral"}>{t(r.status)}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
