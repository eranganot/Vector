import Link from "next/link";
import { api } from "@/app/_lib/api";
import { Band, Card, SectionTitle } from "../../_components/ui";
import { getT } from "../../_lib/locale";
import { requireActor } from "../../_lib/session";

type Node = Awaited<ReturnType<typeof api.orgTree>>["trees"][number];

async function Row({ n, depth, kids }: { n: Node; depth: number; kids?: number }) {
  const t = await getT();
  const counts = `${n.risks === 1 ? t("{n} risk", { n: n.risks }) : t("{n} risks", { n: n.risks })}${
    n.opportunities ? ` · ${t("{n} opp.", { n: n.opportunities })}` : ""
  }`;
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm" style={{ paddingInlineStart: depth * 20 }}>
      {kids !== undefined && (
        <span
          aria-hidden
          className="-ms-4 w-3 rtl:-scale-x-100 text-xs text-muted transition-transform [details[open]>summary_&]:rotate-90"
        >
          ▸
        </span>
      )}
      <Link
        href={`/units/${n.id}`}
        className={`no-underline hover:text-accent hover:underline ${depth < 2 ? "font-semibold" : ""}`}
      >
        {n.name}
      </Link>
      {n.worstBand && <Band band={n.worstBand} />}
      <span className="text-xs text-muted">
        {n.type === "department"
          ? t("owns {owned} · involved in {involved}", {
              owned: n.owned,
              involved: n.risks + n.opportunities - n.owned,
            })
          : n.type !== "group" && n.type !== "branch"
            ? t("{counts} specific to it", { counts })
            : counts}
        {kids ? ` · ${n.type === "group" ? t("{n} regions", { n: kids }) : t("{n} branches", { n: kids })}` : ""}
      </span>
    </div>
  );
}

function Tree({ n, depth = 0 }: { n: Node; depth?: number }) {
  const kids = n.children as Node[];
  if (kids.length === 0) return <Row n={n} depth={depth} />;
  return (
    <details open={depth < 1}>
      <summary className="cursor-pointer list-none">
        <Row n={n} depth={depth} kids={kids.length} />
      </summary>
      {kids.map((c) => (
        <Tree key={c.id} n={c} depth={depth + 1} />
      ))}
    </details>
  );
}

/** The organization you can see, as a hierarchy: every unit links to its view. */
export default async function OrgPage() {
  const { actor } = await requireActor();
  const t = await getT();
  const tree = await api.orgTree(actor);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight">{t("Organization")}</h1>
        <p className="text-sm text-muted">
          {t(
            "Regions, branches and departments in your scope. Counts are items specific to the unit (company-wide items count at the group); departments show what they own and what they are involved in.",
          )}
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <SectionTitle>{t("Regions and branches")}</SectionTitle>
          <div className="mt-2 ps-4">
            {tree.trees.map((n) => (
              <Tree key={n.id} n={n} />
            ))}
          </div>
        </Card>
        {tree.departments.length > 0 && (
          <Card>
            <SectionTitle>{t("Departments")}</SectionTitle>
            <div className="mt-2">
              {tree.departments.map((d) => (
                <Row key={d.id} n={{ ...d, children: [] }} depth={0} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
