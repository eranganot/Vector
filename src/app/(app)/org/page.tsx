import Link from "next/link";
import { api } from "@/application/facade";
import { Band, Card, SectionTitle } from "../../_components/ui";
import { requireActor } from "../../_lib/session";

type Node = Awaited<ReturnType<typeof api.orgTree>>["trees"][number];

function Row({ n, depth, kids }: { n: Node; depth: number; kids?: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm" style={{ paddingLeft: depth * 20 }}>
      {kids !== undefined && (
        <span
          aria-hidden
          className="-ml-4 w-3 text-xs text-muted transition-transform [details[open]>summary_&]:rotate-90"
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
          ? `owns ${n.owned} · involved in ${n.risks + n.opportunities - n.owned}`
          : `${n.risks} risk${n.risks === 1 ? "" : "s"}${n.opportunities ? ` · ${n.opportunities} opp.` : ""}${
              n.type !== "group" && n.type !== "branch" ? " specific to it" : ""
            }`}
        {kids ? ` · ${kids} ${n.type === "group" ? "regions" : "branches"}` : ""}
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
  const t = await api.orgTree(actor);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight">Organization</h1>
        <p className="text-sm text-muted">
          Regions, branches and departments in your scope. Counts are items specific to the unit (company-wide items
          count at the group); departments show what they own and what they are involved in.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <SectionTitle>Regions and branches</SectionTitle>
          <div className="mt-2 pl-4">
            {t.trees.map((n) => (
              <Tree key={n.id} n={n} />
            ))}
          </div>
        </Card>
        {t.departments.length > 0 && (
          <Card>
            <SectionTitle>Departments</SectionTitle>
            <div className="mt-2">
              {t.departments.map((d) => (
                <Row key={d.id} n={{ ...d, children: [] }} depth={0} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
