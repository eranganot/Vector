/**
 * Growth & expansion (G-E6a, Eran 2026-10-10): not only revenue and prices. Revenue growth over 8 quarters, market
 * share (estimate), margins, stores, online share and baskets, for the chains and for us. A figure a chain does not
 * publish reads "not reported"; estimates and our synthetic figures are labelled.
 */
import type { MarketView } from "@/application/facade";
import type { T } from "@/i18n/t";
import { C, HBars, list, money, pct, Source, Takeaway } from "./market-kit";
import { Card, SectionTitle } from "./ui";

type G = MarketView["growth"];
/** Categorical colours for the chains' lines (not good/bad colours). */
const LINE: Record<string, string> = { shufersal: "#60a5fa", rami_levy: "#f59e0b", yohananof: "#a78bfa" };
const qLabel = (q: string) => `Q${q.slice(-1)} ${q.slice(2, 4)}`;

function GrowthLines({ g, t }: { g: G; t: T }) {
  const W = 560;
  const H = 220;
  const L = 44;
  const R = 12;
  const chains = g.chains.filter((c) => c.growthByQuarter.some((x) => x !== null));
  const vals = chains.flatMap((c) => c.growthByQuarter.filter((x): x is number => x !== null));
  const lo = Math.min(-2, ...vals) - 1;
  const hi = Math.max(2, ...vals) + 1;
  const n = g.quarters.length;
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, n - 1);
  const y = (v: number) => 12 + (H - 46) * (1 - (v - lo) / (hi - lo));
  const ticks = [lo, 0, hi].map((v) => Math.round(v));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Revenue growth by quarter")}>
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={L}
            x2={W - R}
            y1={y(v)}
            y2={y(v)}
            stroke={v === 0 ? C.muted : C.line}
            strokeDasharray={v === 0 ? "4 3" : undefined}
          />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill={C.muted}>
            {`${v > 0 ? "+" : ""}${v}%`}
          </text>
        </g>
      ))}
      {chains.map((c) => {
        const pts = c.growthByQuarter
          .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
          .filter(Boolean)
          .join(" ");
        const lastI = c.growthByQuarter.map((v, i) => (v === null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
        return (
          <g key={c.key}>
            <polyline points={pts} fill="none" stroke={LINE[c.key] ?? C.muted} strokeWidth="2.5" />
            {c.growthByQuarter.map((v, i) =>
              v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={LINE[c.key] ?? C.muted} />,
            )}
            {lastI >= 0 && (
              <text
                x={x(lastI) - 4}
                y={y(c.growthByQuarter[lastI]!) - 8}
                textAnchor="end"
                fontSize="11"
                fontWeight="600"
                fill={LINE[c.key] ?? C.muted}
              >
                {pct(c.growthByQuarter[lastI])}
              </text>
            )}
          </g>
        );
      })}
      {g.quarters.map((q, i) => (
        <text key={q} x={x(i)} y={H - 18} textAnchor="middle" fontSize="10" fill={C.muted}>
          {qLabel(q)}
        </text>
      ))}
      <g>
        {chains.map((c, k) => (
          <g key={c.key} transform={`translate(${L + k * 130}, ${H - 4})`}>
            <rect width="10" height="3" y="-4" fill={LINE[c.key] ?? C.muted} />
            <text x="14" fontSize="11" fill={C.ink}>
              {c.name}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

const nr = (t: T) => <span className="text-muted">{t("not reported")}</span>;

export function GrowthSection({ v, t }: { v: MarketView; t: T }) {
  const g = v.growth;
  const us = g.ours;
  const all = [...(us ? [us] : []), ...g.chains];
  const listed = g.chains.filter((c) => c.quartersReported > 0);
  const cell = "num whitespace-nowrap px-2 py-1.5 text-center";
  const head = "whitespace-nowrap px-2 py-1 text-center font-normal";
  const label = (c: (typeof all)[number]) => (c.synthetic ? `${c.name} *` : c.name);
  const shares = all.filter((c) => c.marketShare !== null);
  const gm = all.filter((c) => c.grossMargin);
  const om = all.filter((c) => c.operatingMargin);
  const topGm = [...g.chains].filter((c) => c.grossMargin).sort((a, b) => b.grossMargin!.value - a.grossMargin!.value);
  return (
    <section className="flex flex-col gap-4" data-testid="market-growth" aria-label={t("Growth & expansion")}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0" data-testid="growth-quarters">
          <SectionTitle aside={<span className="text-xs text-muted">{t("year on year, reported")}</span>}>
            {t("Revenue growth by quarter")}
          </SectionTitle>
          <GrowthLines g={g} t={t} />
          <Takeaway t={t}>
            {t("Quarters with growth out of the last {n}: {list}.", {
              n: g.quarters.length,
              list: list(listed.map((c) => `${c.name} ${c.quartersUp}/${c.quartersReported}`)),
            })}{" "}
            {(() => {
              const shrinking = listed.filter((c) => c.quartersUp * 2 < c.quartersReported).map((c) => c.name);
              const growing = listed.filter((c) => c.quartersUp === c.quartersReported).map((c) => c.name);
              return shrinking.length && growing.length
                ? t(
                    "Shoppers are moving from {from} to {to}; our growth (+{g}, 13 weeks) has no year-on-year history yet.",
                    {
                      from: list(shrinking),
                      to: list(growing),
                      g: (us?.growthLatest?.value ?? 0).toFixed(1) + "%",
                    },
                  )
                : "";
            })()}
          </Takeaway>
          <Source t={t} href={g.chains.find((c) => c.growthLatest)?.growthLatest?.url ?? undefined}>
            {t(
              "Quarterly results from company filings (StockAnalysis, S&P Global data); Osher Ad and Tiv Taam are private",
            )}
          </Source>
        </Card>
        <Card className="min-w-0" data-testid="market-share">
          <SectionTitle aside={<span className="text-xs text-muted">{t("Estimate")}</span>}>
            {t("Market share (estimate)")}
          </SectionTitle>
          <HBars
            unit="pct"
            plain
            rows={shares
              .sort((a, b) => b.marketShare! - a.marketShare!)
              .map((c) => ({
                label: c.synthetic ? "VECTOR *" : c.name,
                value: c.marketShare!,
                highlight: c.synthetic,
                tone: c.synthetic ? undefined : C.muted,
              }))}
          />
          <Takeaway t={t}>
            {t("Shufersal leads with about {lead}; we hold about {ours}. {n} chains do not publish revenue.", {
              lead: pct(g.chains.find((c) => c.key === "shufersal")?.marketShare ?? null, false),
              ours: pct(us?.marketShare ?? null, false),
              n: g.chains.filter((c) => c.marketShare === null).length,
            })}{" "}
            {t("The share is overstated: chain revenue also includes fresh food and non-food.")}
          </Takeaway>
          <Source t={t} href={g.market?.url}>
            {t(
              "Revenue in 2025 (ours: last 12 months) ÷ the barcoded food & beverage market, {m} in {year} (StoreNext, via Strauss Group's 2025 report)",
              {
                m: g.market ? money(g.market.value) : "—",
                year: g.market?.period ?? "—",
              },
            )}
          </Source>
        </Card>
        <Card className="min-w-0" data-testid="margins">
          <SectionTitle aside={<span className="text-xs text-muted">{t("last reported quarter")}</span>}>
            {t("Margins")}
          </SectionTitle>
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-xs text-muted">{t("Gross margin")}</p>
              <HBars
                unit="pct"
                plain
                rows={gm.map((c) => ({
                  label: c.synthetic ? "VECTOR *" : c.name,
                  value: c.grossMargin!.value,
                  highlight: c.synthetic,
                  tone: c.synthetic ? undefined : C.muted,
                }))}
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">{t("Operating margin")}</p>
              <HBars
                unit="pct"
                plain
                rows={om.map((c) => ({ label: label(c), value: c.operatingMargin!.value, tone: C.muted }))}
              />
            </div>
          </div>
          <Takeaway t={t}>
            {topGm.length
              ? t(
                  "{top} earns the highest gross margin ({topGm}) and is the dearest major chain; {lean} run leaner. Our gross margin is {ours} (synthetic).",
                  {
                    top: topGm[0].name,
                    topGm: pct(topGm[0].grossMargin!.value, false),
                    lean: list(topGm.slice(1).map((c) => `${c.name} ${pct(c.grossMargin!.value, false)}`)),
                    ours: pct(us?.grossMargin?.value ?? null, false),
                  },
                )
              : "—"}
          </Takeaway>
        </Card>
        <Card className="min-w-0" data-testid="baskets">
          <SectionTitle aside={<span className="text-xs text-muted">{t("ours: last 12 months")}</span>}>
            {t("Baskets")}
          </SectionTitle>
          <dl className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-line p-3">
              <dt className="text-xs text-muted">{t("Average basket")}</dt>
              <dd className="num text-2xl font-semibold text-accent">
                {us?.avgBasket ? `₪${us.avgBasket.toFixed(0)}` : "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-line p-3">
              <dt className="text-xs text-muted">{t("Items per basket")}</dt>
              <dd className="num text-2xl font-semibold text-accent">{us?.itemsPerBasket?.toFixed(1) ?? "—"}</dd>
            </div>
          </dl>
          <Takeaway t={t}>
            {t(
              "Our average basket is ₪{b}, about {n} items at an average shelf price of ₪{p}. The chains do not publish basket figures, so there is no comparison yet.",
              {
                b: us?.avgBasket?.toFixed(0) ?? "—",
                n: us?.itemsPerBasket?.toFixed(1) ?? "—",
                p: g.avgItemPrice?.toFixed(2) ?? "—",
              },
            )}
          </Takeaway>
          <Source t={t}>
            {t(
              "Ours: net sales ÷ transactions (synthetic); items = basket ÷ the basket items' market-median shelf price × our basket index",
            )}
          </Source>
        </Card>
      </div>
      <Card className="min-w-0 overflow-x-auto" data-testid="growth-table">
        <SectionTitle aside={<span className="text-xs text-muted">{t("latest figure each chain publishes")}</span>}>
          {t("Growth & expansion")}
        </SectionTitle>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pe-3 text-start font-normal">{t("Chain")}</th>
              <th className={head}>{t("Revenue (year)")}</th>
              <th className={head}>{t("Growth")}</th>
              <th className={head}>{t("Same-store")}</th>
              <th className={head}>{t("Stores")}</th>
              <th className={head}>{t("Market share")}</th>
              <th className={head}>{t("Online share")}</th>
              <th className={head}>{t("Average basket")}</th>
              <th className={head}>{t("Items per basket")}</th>
            </tr>
          </thead>
          <tbody>
            {all.map((c) => (
              <tr key={c.key} className={`border-t border-line ${c.synthetic ? "bg-accent/5" : ""}`}>
                <td className="py-1.5 pe-3">
                  <b className={c.synthetic ? "text-accent" : ""}>{label(c)}</b>
                </td>
                <td className={cell}>
                  {c.annualRevenue !== null ? money(c.annualRevenue) : nr(t)}
                  {c.annualRevenue !== null && (
                    <span className="block text-[10px] text-muted">{t(c.annualPeriod)}</span>
                  )}
                </td>
                <td className={cell}>{c.growthLatest ? pct(c.growthLatest.value) : nr(t)}</td>
                <td className={cell}>
                  {c.sameStore ? pct(c.sameStore.value) : nr(t)}
                  {c.sameStore && (
                    <span className="block text-[10px] text-muted">
                      {c.sameStore.period === "13w" ? t("13 weeks") : c.sameStore.period}
                    </span>
                  )}
                </td>
                <td className={cell}>
                  {c.stores ? c.stores.value : nr(t)}
                  {c.stores?.kind === "estimate" && (
                    <span className="block text-[10px] text-muted">{t("Estimate")}</span>
                  )}
                </td>
                <td className={cell}>{c.marketShare !== null ? `${c.marketShare.toFixed(1)}%` : nr(t)}</td>
                <td className={cell}>
                  {c.online ? (
                    `${c.online.value.toFixed(1)}%`
                  ) : c.synthetic ? (
                    <span className="text-muted">{t("not modelled")}</span>
                  ) : (
                    nr(t)
                  )}
                  {c.online && <span className="block text-[10px] text-muted">{c.online.period}</span>}
                </td>
                <td className={cell}>{c.avgBasket !== null ? `₪${c.avgBasket.toFixed(0)}` : nr(t)}</td>
                <td className={cell}>{c.itemsPerBasket !== null ? c.itemsPerBasket.toFixed(1) : nr(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Takeaway t={t}>
          {t(
            "Of the chains that publish revenue we are the smallest, and growing. The store count trend appears as daily store files are collected (one day so far). * synthetic",
          )}
        </Takeaway>
      </Card>
    </section>
  );
}
