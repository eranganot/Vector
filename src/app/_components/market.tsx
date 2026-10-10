/**
 * Market & competitors (plan v2, E6; layout v3, G-E0f: competitors in charts, not only a table). Public data — CBS
 * indices, the chains' price files, reported results — next to our synthetic prices. Every figure says where it comes
 * from and when; estimates are labelled.
 */
import Link from "next/link";
import type { MarketView } from "@/application/facade";
import type { T } from "@/i18n/t";
import { day } from "./format";
import { ils, MoneyHeader } from "./money-header";
import { GrowthSection } from "./market-growth";
import { C, HBars, list, money, month, pct, Source, Takeaway } from "./market-kit";
import { Card, SectionTitle } from "./ui";

const CAT_WORD: Record<string, string> = {
  dairy: "Dairy",
  bakery: "Bread & cereals",
  meat_fish: "Meat & fish",
  drinks: "Drinks",
  pantry: "Pantry",
  snacks: "Snacks & sweets",
  household: "Household",
};
/** CBS group names for the categories we map to them (the bars show CBS's groups, not our basket's). */
const CBS_WORD: Record<string, string> = {
  dairy: "Milk & dairy",
  bakery: "Bread & cereals",
  meat_fish: "Meat & fish",
  drinks: "Drinks",
  pantry: "Oils & margarine",
  snacks: "Sugar, jam & sweets",
};
function FoodVsOurs({ v, t }: { v: MarketView; t: T }) {
  const W = 560;
  const H = 210;
  const L = 40;
  const all = [...v.foodVsOurs.food, ...v.foodVsOurs.ours].map((p) => p.value);
  const lo = Math.min(...all) - 0.5;
  const hi = Math.max(...all) + 0.5;
  const n = v.foodVsOurs.food.length;
  const x = (i: number) => L + ((W - L - 10) * i) / Math.max(1, n - 1);
  const y = (val: number) => 10 + (H - 40) * (1 - (val - lo) / (hi - lo));
  const line = (xs: { value: number }[]) => xs.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Food prices vs ours")}>
      {[lo, (lo + hi) / 2, hi].map((g, k) => (
        <g key={k}>
          <line x1={L} x2={W - 10} y1={y(g)} y2={y(g)} stroke={C.line} />
          <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill={C.muted}>
            {g.toFixed(1)}
          </text>
        </g>
      ))}
      <polyline points={line(v.foodVsOurs.food)} fill="none" stroke={C.muted} strokeWidth="2" strokeDasharray="5 4" />
      <polyline points={line(v.foodVsOurs.ours)} fill="none" stroke={C.accent} strokeWidth="2.5" />
      {v.foodVsOurs.food.map((p, i) =>
        i % 3 === 0 || i === n - 1 ? (
          <text key={p.period} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill={C.muted}>
            {month(t, p.period)}
          </text>
        ) : null,
      )}
      <text x={W - 10} y={14} textAnchor="end" fontSize="11" fill={C.muted}>
        {`- - ${t("CBS food prices (real)")}   — ${t("VECTOR average price (synthetic)")}`}
      </text>
    </svg>
  );
}

function heat(v: number | null) {
  if (v === null) return { bg: "transparent", fg: C.muted };
  const d = v - 100;
  const a = Math.min(0.85, Math.abs(d) / 20 + 0.12);
  // Faint cells keep light text; strong green cells take dark text (contrast both ways).
  return d > 0
    ? { bg: `rgba(248,113,113,${a})`, fg: C.ink }
    : { bg: `rgba(52,211,153,${a})`, fg: a < 0.45 ? C.ink : "#06210f" };
}

export function MarketScreen({ v, t }: { v: MarketView; t: T }) {
  const tl = v.tiles;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-tight">{t("Market & competitors")}</h1>
          <p className="text-sm text-muted">
            {t(
              "Real public data: CBS price indices, the chains' published price files and their reported results. Our prices are synthetic.",
            )}
          </p>
        </div>
        <nav aria-label={t("Region")} className="flex flex-wrap gap-1" data-testid="market-regions">
          {v.regions.map((r) => (
            <Link
              key={r.key}
              href={r.key === "ALL" ? "/market" : `/market?r=${r.key}`}
              aria-current={v.region === r.key ? "true" : undefined}
              className={`rounded-md border px-2.5 py-1 text-xs no-underline ${v.region === r.key ? "border-accent bg-accent/10 text-accent" : "border-line text-ink hover:border-accent/60"}`}
            >
              {t(r.name)}
            </Link>
          ))}
        </nav>
      </div>
      <MoneyHeader
        label={t("Market")}
        figures={[
          {
            icon: "%",
            label: t("food prices y/y, CBS ({month})", { month: tl.foodMonth ? month(t, tl.foodMonth) : "—" }),
            value: pct(tl.foodYoy),
            hint: t("CBS index 110050: food including vegetables and fruit"),
            tone: "muted",
          },
          {
            icon: "↗",
            label: t("our prices y/y (synthetic)"),
            value: pct(tl.ourYoy),
            hint: t("VECTOR Retail Group average price index"),
            tone: (tl.ourYoy ?? 0) > (tl.foodYoy ?? 0) ? "warn" : "good",
          },
          {
            icon: "₪",
            label: t("our basket vs market (100) · {region}", { region: t(v.regionName) }),
            value: tl.ourBasket === null ? "—" : tl.ourBasket.toFixed(1),
            hint: t("basket-index-v1: 100 is the market median of the chains compared"),
            tone: (tl.ourBasket ?? 100) > 100 ? "warn" : "good",
          },
          {
            icon: "◆",
            label: t("Shufersal same-store sales, {period} (reported)", { period: tl.leaderSss?.period ?? "" }),
            value: pct(tl.leaderSss?.value),
            hint: tl.leaderSss ? `${tl.leaderSss.source}` : "",
            tone: "bad",
          },
        ]}
      />
      {v.changed.length > 0 && (
        <Card data-testid="market-changed">
          <SectionTitle aside={<span className="text-xs text-muted">{t("rules market-v1 · how it hits us")}</span>}>
            {t("What changed outside")}
          </SectionTitle>
          <ul className="grid gap-3 md:grid-cols-2">
            {v.changed.map((c) => (
              <li
                key={c.id}
                className={`flex flex-col gap-1.5 rounded-lg border p-3 ${c.workstream === "opportunity" ? "border-good/40" : "border-warn/40"}`}
                data-testid="market-change"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono font-semibold ${c.workstream === "opportunity" ? "bg-good/15 text-good" : "bg-warn/15 text-warn"}`}
                  >
                    {c.priorityBand}
                  </span>
                  <span className="text-muted">
                    {c.workstream === "opportunity" ? t("Market opportunity") : t("Market risk")}
                  </span>
                  {c.impactIls !== null && (
                    <span className="num ms-auto font-semibold">
                      {c.workstream === "opportunity"
                        ? t("{money}/week upside", { money: ils(c.impactIls) })
                        : t("{money}/week at stake", { money: ils(c.impactIls) })}
                    </span>
                  )}
                </div>
                <Link href={`/insights/${c.id}`} className="text-sm font-semibold text-ink">
                  {c.title}
                </Link>
                <p className="text-[13px] text-muted">{c.whyItMatters}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0" data-testid="food-vs-ours">
          <SectionTitle aside={<span className="text-xs text-muted">{t("index, first month = 100")}</span>}>
            {t("Food prices vs ours")}
          </SectionTitle>
          <FoodVsOurs v={v} t={t} />
          <Takeaway t={t}>
            {(() => {
              const f = v.foodVsOurs.food;
              const o = v.foodVsOurs.ours;
              const fd = (f.at(-1)?.value ?? 100) - 100;
              const od = (o.at(-1)?.value ?? 100) - 100;
              const first = f[0] ? month(t, f[0].period) : "—";
              return od > fd
                ? t(
                    "Since {month} our prices rose {ours} and food prices {food}: we are {gap} points above the market trend, and still rising while the market falls.",
                    { month: first, ours: pct(od), food: pct(fd), gap: (od - fd).toFixed(1) },
                  )
                : t(
                    "Since {month} our prices rose {ours} and food prices {food}: we are at or below the market trend.",
                    {
                      month: first,
                      ours: pct(od),
                      food: pct(fd),
                    },
                  );
            })()}
          </Takeaway>
          <Source t={t} href={v.foodVsOurs.foodUrl}>
            {t("CBS price index 110050, monthly; ours is synthetic")}
          </Source>
        </Card>
        <Card className="min-w-0" data-testid="cbs-categories">
          <SectionTitle
            aside={
              <span className="text-xs text-muted">
                {tl.foodMonth
                  ? t("{month} vs {prev}", {
                      month: month(t, tl.foodMonth),
                      prev: month(t, `${Number(tl.foodMonth.slice(0, 4)) - 1}${tl.foodMonth.slice(4)}`),
                    })
                  : ""}
              </span>
            }
          >
            {t("Food prices by category: change in 12 months (CBS)")}
          </SectionTitle>
          <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" data-testid="cbs-legend">
            <span>
              <span className="me-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.bad }} />
              {t("dearer than a year ago: cost pressure from suppliers")}
            </span>
            <span>
              <span className="me-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.good }} />
              {t("cheaper than a year ago: room to cut our prices")}
            </span>
          </p>
          <HBars
            unit="pct"
            rows={v.cbsByCategory.map((c) => ({
              label: t(CBS_WORD[c.category]),
              value: c.yoy!,
              tone: c.yoy! > 0 ? C.bad : C.good,
            }))}
          />
          <Takeaway t={t}>
            {(() => {
              const up = v.cbsByCategory.filter((c) => c.yoy! > 0).sort((a, b) => b.yoy! - a.yoy!);
              const down = v.cbsByCategory.filter((c) => c.yoy! <= 0).sort((a, b) => a.yoy! - b.yoy!);
              const name = (c: (typeof up)[number]) => `${t(CBS_WORD[c.category])} ${pct(c.yoy)}`;
              return t(
                "Getting dearer: {up}. Getting cheaper: {down}. Expect suppliers to push prices up in {top}; {low} is where we can lead on price.",
                {
                  up: up.length ? list(up.map(name)) : "—",
                  down: down.length ? list(down.map(name)) : "—",
                  top: up[0] ? t(CBS_WORD[up[0].category]) : "—",
                  low: down[0] ? t(CBS_WORD[down[0].category]) : "—",
                },
              );
            })()}
          </Takeaway>
          <Source t={t} href="https://api.cbs.gov.il/index/">
            {t(
              "CBS consumer price index by sub-group (dairy 120230, bread & cereals 120060, meat & fish 120130, drinks 120340, oils 120200, sweets 120370)",
            )}
          </Source>
        </Card>
        <Card className="min-w-0" data-testid="basket-by-chain">
          <SectionTitle
            aside={
              <span className="text-xs text-muted">
                {t("100 = market median · {region}", { region: t(v.regionName) })}
              </span>
            }
          >
            {t("Basket price vs competitors")}
          </SectionTitle>
          <HBars
            unit="index"
            ref100
            rows={v.basket.map((b) => ({
              label: b.synthetic ? "VECTOR *" : b.name,
              value: b.index,
              highlight: b.synthetic,
            }))}
          />
          <Takeaway t={t}>
            {(() => {
              const us = v.basket.find((b) => b.synthetic);
              if (!us) return "—";
              const cheaper = v.basket.filter((b) => !b.synthetic && b.index > us.index).map((b) => b.name);
              const dearer = v.basket.filter((b) => !b.synthetic && b.index < us.index).map((b) => b.name);
              return t("Our basket is {idx} (market = 100). We are cheaper than {cheaper} and dearer than {dearer}.", {
                idx: us.index.toFixed(1),
                cheaper: cheaper.length ? list(cheaper) : t("no chain"),
                dearer: dearer.length ? list(dearer) : t("no chain"),
              });
            })()}
          </Takeaway>
          <p className="mt-1 text-xs text-muted">
            {v.days.length > 1
              ? t("{n} days collected", { n: v.days.length })
              : t("One day so far ({day}); a line per chain appears as daily files are collected.", {
                  day: v.day ? day(t, v.day) : "—",
                })}
          </p>
          <Source t={t}>
            {t("{files} price files from {chains}, {day}; 154 barcodes sold by every chain. * synthetic", {
              files: v.sources.priceFiles.files,
              chains: v.sources.priceFiles.chains.join(", "),
              day: v.day ? day(t, v.day) : "—",
            })}
          </Source>
        </Card>
        <Card className="min-w-0 overflow-x-auto" data-testid="basket-heatmap">
          <SectionTitle aside={<span className="text-xs text-muted">{t(v.regionName)}</span>}>
            {t("Basket price index by category")}
          </SectionTitle>
          <p className="mb-2 text-xs text-muted" data-testid="heatmap-legend">
            {t(
              "Each cell compares the chain's shelf price for the same products with the market median (100): 110 = 10% dearer, 95 = 5% cheaper.",
            )}{" "}
            <span
              className="me-1 ms-1 inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: "rgba(52,211,153,.7)" }}
            />
            {t("cheaper")}
            <span
              className="me-1 ms-3 inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: "rgba(248,113,113,.7)" }}
            />
            {t("dearer")}
          </p>
          <table className="w-full text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pe-2 text-start font-normal" />
                {Object.keys(CAT_WORD).map((c) => (
                  <th key={c} className="px-1 py-1 text-center font-normal">
                    {t(CAT_WORD[c])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.heatmap.map((r) => (
                <tr key={r.chain}>
                  <td className={`whitespace-nowrap py-1 pe-2 ${r.synthetic ? "font-semibold text-accent" : ""}`}>
                    {r.name}
                    {r.synthetic ? " *" : ""}
                  </td>
                  {r.cells.map((c) => {
                    const h = heat(c.index);
                    return (
                      <td key={c.category} className="p-0.5">
                        <span
                          className="num block rounded px-1 py-1.5 text-center font-semibold"
                          style={{ background: h.bg, color: h.fg }}
                          data-testid="heat-cell"
                        >
                          {c.index === null ? "—" : c.index.toFixed(0)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <Takeaway t={t}>
            {(() => {
              const us = v.heatmap.find((r) => r.synthetic);
              const cells = (us?.cells ?? []).filter((c) => c.index !== null) as { category: string; index: number }[];
              if (!cells.length) return "—";
              const hi = [...cells].sort((a, b) => b.index - a.index)[0];
              const lo = [...cells].sort((a, b) => a.index - b.index)[0];
              const gaps = cells.filter((c) => c.index >= 103);
              const others = v.basket.filter((b) => !b.synthetic);
              return [
                t("Our dearest category is {hi} ({hiIdx}); our cheapest is {lo} ({loIdx}).", {
                  hi: t(CAT_WORD[hi.category]),
                  hiIdx: hi.index.toFixed(0),
                  lo: t(CAT_WORD[lo.category]),
                  loIdx: lo.index.toFixed(0),
                }),
                others.length
                  ? t("Cheapest chain: {cheap}; dearest: {dear}.", {
                      cheap: others[0].name,
                      dear: others[others.length - 1].name,
                    })
                  : "",
                gaps.length
                  ? t("Price gap: {cats} are 3% or more above the market (a risk in What changed outside).", {
                      cats: list(gaps.map((c) => t(CAT_WORD[c.category]))),
                    })
                  : "",
              ]
                .filter(Boolean)
                .join(" ");
            })()}
          </Takeaway>
        </Card>
      </div>
      <Card className="min-w-0" data-testid="competitors">
        <SectionTitle aside={<span className="text-xs text-muted">{t("as published; never adjusted")}</span>}>
          {t("Competitors")}
        </SectionTitle>
        {(() => {
          const g = v.growth;
          const us = g.ours;
          const rows = [
            ...(us ? [{ key: "vector", name: `${us.name} *`, synthetic: true }] : []),
            ...v.competitors.map((c) => ({ key: c.key, name: c.name, synthetic: false })),
          ];
          const comp = (k: string) => v.competitors.find((c) => c.key === k);
          const revenue = (k: string) => (k === "vector" ? (us?.revenueLatest ?? null) : (comp(k)?.revenue ?? null));
          const growthOf = (k: string) => (k === "vector" ? (us?.growthLatest ?? null) : (comp(k)?.growth ?? null));
          const sss = (k: string) => (k === "vector" ? (us?.sameStore ?? null) : (comp(k)?.sameStore ?? null));
          const stores = (k: string) => (k === "vector" ? (us?.stores ?? null) : (comp(k)?.stores ?? null));
          const basketOf = (k: string) => (k === "vector" ? (v.tiles.ourBasket ?? null) : (comp(k)?.basket ?? null));
          const cell = "num whitespace-nowrap px-2 py-1.5 text-center";
          const head = "whitespace-nowrap px-2 py-1 text-center font-normal";
          const ourG = us?.growthLatest?.value ?? null;
          const faster = v.competitors
            .filter((c) => c.growth && ourG !== null && c.growth.value < ourG)
            .map((c) => c.name);
          const slower = v.competitors
            .filter((c) => c.growth && ourG !== null && c.growth.value > ourG)
            .map((c) => c.name);
          return (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-muted">{t("Revenue, last reported quarter")}</p>
                  <HBars
                    unit="ils"
                    rows={rows
                      .filter((r) => revenue(r.key))
                      .map((r) => ({
                        label: r.synthetic ? "VECTOR *" : r.name,
                        value: revenue(r.key)!.value,
                        highlight: r.synthetic,
                      }))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted">{t("Revenue growth, last reported quarter")}</p>
                  <HBars
                    unit="pct"
                    rows={rows
                      .filter((r) => growthOf(r.key))
                      .map((r) => ({
                        label: r.synthetic ? "VECTOR *" : r.name,
                        value: growthOf(r.key)!.value,
                        highlight: r.synthetic,
                        tone: r.synthetic ? undefined : growthOf(r.key)!.value < 0 ? C.bad : C.good,
                      }))}
                  />
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm" data-testid="competitor-table">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-1 pe-3 text-start font-normal">{t("Chain")}</th>
                      <th className={head}>{t("Revenue (quarter)")}</th>
                      <th className={head}>{t("Growth")}</th>
                      <th className={head}>{t("Same-store")}</th>
                      <th className={head}>{t("Net profit")}</th>
                      <th className={head}>{t("Stores")}</th>
                      <th className={head}>{t("Basket index")}</th>
                      <th className="py-1 ps-2 text-start font-normal">{t("Source")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const c = comp(r.key);
                      const rev = revenue(r.key);
                      const gr = growthOf(r.key);
                      const ss = sss(r.key);
                      const st = stores(r.key);
                      const src = c ? (c.revenue ?? c.stores) : null;
                      return (
                        <tr
                          key={r.key}
                          className={`border-t border-line align-top ${r.synthetic ? "bg-accent/5" : ""}`}
                          data-testid={r.synthetic ? "competitor-us" : undefined}
                        >
                          <td className="py-1.5 pe-3">
                            <b className={r.synthetic ? "text-accent" : ""}>{r.name}</b>
                            <span className="block text-xs text-muted">
                              {r.synthetic ? t("us · synthetic") : c?.listed ? (c.ticker ?? t("listed")) : t("private")}
                            </span>
                          </td>
                          <td className={cell}>
                            {rev ? money(rev.value) : "—"}
                            {rev && <span className="block text-[10px] text-muted">{rev.period}</span>}
                          </td>
                          <td
                            className={`${cell} ${gr && !r.synthetic ? (gr.value < 0 ? "text-p1" : "text-good") : ""}`}
                          >
                            {pct(gr?.value)}
                            {gr?.period === "13w" && (
                              <span className="block text-[10px] text-muted">{t("13 weeks")}</span>
                            )}
                          </td>
                          <td className={`${cell} ${(ss?.value ?? 0) < 0 ? "text-p1" : ""}`}>{pct(ss?.value)}</td>
                          <td className={cell}>{c?.netProfit ? money(c.netProfit.value) : "—"}</td>
                          <td className={cell}>
                            {st ? st.value : "—"}
                            {st && st.kind === "estimate" && (
                              <span
                                className="ms-1 rounded border border-dashed border-muted px-1 text-[10px] uppercase text-muted"
                                title={st.method ?? ""}
                              >
                                {t("Estimate")}
                              </span>
                            )}
                          </td>
                          <td className={cell}>{basketOf(r.key) === null ? "—" : basketOf(r.key)!.toFixed(1)}</td>
                          <td className="py-1.5 ps-2 text-xs text-muted">
                            {r.synthetic ? (
                              t("our data (synthetic)")
                            ) : src ? (
                              <>
                                <a href={src.url} target="_blank" rel="noreferrer" className="text-muted underline">
                                  {t(src.source)}
                                </a>
                                <span className="block">{day(t, src.asOf)}</span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Takeaway t={t}>
                {[
                  t("The discounters are growing while the market leader shrinks: {list}.", {
                    list: list(v.competitors.filter((c) => c.growth).map((c) => `${c.name} ${pct(c.growth!.value)}`)),
                  }),
                  ourG !== null
                    ? t("We grow {g} (synthetic, 13 weeks): faster than {faster}, slower than {slower}.", {
                        g: pct(ourG),
                        faster: faster.length ? list(faster) : t("no chain"),
                        slower: slower.length ? list(slower) : t("no chain"),
                      })
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              </Takeaway>
            </>
          );
        })()}
      </Card>
      <GrowthSection v={v} t={t} />
      <Card className="min-w-0" data-testid="market-sources">
        <SectionTitle>{t("Sources")}</SectionTitle>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
          <li>
            <a href={v.sources.cbs.url} target="_blank" rel="noreferrer" className="text-muted underline">
              {t("Central Bureau of Statistics, price indices API")}
            </a>{" "}
            · {t("latest month {month}", { month: v.sources.cbs.month ? month(t, v.sources.cbs.month) : "—" })}
          </li>
          <li>
            {t(
              "Price-transparency files published by the chains (Shufersal; Rami Levy, Osher Ad, Yohananof and Tiv Taam via the shared portal), {day}: {n} files in this view, each kept by SHA-256.",
              {
                day: v.day ? day(t, v.day) : "—",
                n: v.sources.priceFiles.files,
              },
            )}
          </li>
          {v.sources.filings.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noreferrer" className="text-muted underline">
                {f.source}
              </a>{" "}
              · {day(t, f.asOf)}
            </li>
          ))}
          <li>
            {t("VECTOR Retail Group's prices and price index are synthetic, anchored on the real market median.")}
          </li>
        </ul>
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer">
            {t("Price files in this view · {n}", { n: v.sources.priceFiles.files })}
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[11px]">
            {v.sources.priceFiles.stores.map((s) => (
              <li key={s.url}>
                {s.chain} · {s.store} · {s.items} {t("items")} · sha256 {s.sha256.slice(0, 12)}
              </li>
            ))}
          </ul>
        </details>
      </Card>
    </>
  );
}
