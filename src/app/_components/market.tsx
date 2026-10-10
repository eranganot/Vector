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
import { Card, SectionTitle } from "./ui";

const C = {
  good: "#34d399",
  watch: "#fbbf24",
  bad: "#f87171",
  accent: "#22d3ee",
  muted: "#8fa1bc",
  line: "#22334f",
  ink: "#e6edf7",
};
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
/** ₪ with billions (the chains' revenues). */
const money = (v: number) => (Math.abs(v) >= 1e9 ? `₪${(v / 1e9).toFixed(2)}B` : ils(v));
const pct = (v: number | null | undefined, sign = true) =>
  v === null || v === undefined ? "—" : `${sign && v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const month = (t: T, p: string) => day(t, `${p}-01`).split(" ")[1] + ` ${p.slice(2, 4)}`;

function Source({ t, children, href }: { t: T; children: React.ReactNode; href?: string }) {
  return (
    <p className="mt-2 text-[11px] text-muted">
      {t("Source")}:{" "}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-muted underline">
          {children}
        </a>
      ) : (
        children
      )}
    </p>
  );
}

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

function HBars({
  rows,
  ref100,
  unit,
}: {
  rows: { label: string; value: number; highlight?: boolean; tone?: string }[];
  ref100?: boolean;
  unit: "index" | "pct" | "ils";
}) {
  const W = 520;
  const row = 26;
  const LABEL = 150;
  const VAL = 70;
  const H = rows.length * row + 10;
  const vals = rows.map((r) => r.value);
  const signed = unit === "pct" && vals.some((v) => v < 0);
  const span = W - LABEL - VAL;
  const lo = ref100 ? Math.min(90, ...vals) - 2 : signed ? Math.min(...vals) : 0;
  const hi = ref100 ? Math.max(110, ...vals) + 2 : Math.max(...vals, 0);
  const x = (v: number) => LABEL + (span * (v - lo)) / (hi - lo || 1);
  const base = ref100 ? x(100) : x(signed ? 0 : lo);
  const fmt = (v: number) => (unit === "pct" ? pct(v) : unit === "ils" ? money(v) : v.toFixed(1));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {(ref100 || signed) && <line x1={base} x2={base} y1={0} y2={H} stroke={C.muted} strokeDasharray="3 3" />}
      {ref100 && (
        <text x={base} y={H - 1} textAnchor="middle" fontSize="9" fill={C.muted}>
          100
        </text>
      )}
      {rows.map((r, i) => {
        const yy = 5 + i * row;
        const x0 = Math.min(base, x(r.value));
        const w = Math.max(2, Math.abs(x(r.value) - base));
        const color = r.tone ?? (r.highlight ? C.accent : ref100 ? (r.value > 100 ? C.bad : C.good) : C.muted);
        return (
          <g key={`${r.label}${i}`}>
            <text
              x={LABEL - 8}
              y={yy + 16}
              textAnchor="end"
              fontSize="12"
              fontWeight={r.highlight ? "700" : "400"}
              fill={C.ink}
            >
              {r.label}
            </text>
            <rect x={x0} y={yy + 5} width={w} height={row - 10} rx="3" fill={color} opacity={r.highlight ? 1 : 0.85} />
            <text
              x={W - 4}
              y={yy + 16}
              textAnchor="end"
              fontSize="12"
              fontWeight="600"
              fill={r.highlight ? C.accent : C.ink}
            >
              {fmt(r.value)}
            </text>
          </g>
        );
      })}
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
          <Source t={t} href={v.foodVsOurs.foodUrl}>
            {t("CBS price index 110050, monthly; ours is synthetic")}
          </Source>
        </Card>
        <Card className="min-w-0" data-testid="cbs-categories">
          <SectionTitle aside={<span className="text-xs text-muted">{t("y/y, last month published")}</span>}>
            {t("Food prices by category (CBS)")}
          </SectionTitle>
          <HBars
            unit="pct"
            rows={v.cbsByCategory.map((c) => ({
              label: t(CBS_WORD[c.category]),
              value: c.yoy!,
              tone: c.yoy! > 2 ? C.bad : c.yoy! < 0 ? C.good : C.muted,
            }))}
          />
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
              label: b.synthetic ? `${b.name} *` : b.name,
              value: b.index,
              highlight: b.synthetic,
            }))}
          />
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
          <SectionTitle
            aside={<span className="text-xs text-muted">{t("green cheaper · red dearer than the market")}</span>}
          >
            {t("Basket price index by category")}
          </SectionTitle>
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
        </Card>
      </div>
      <Card className="min-w-0" data-testid="competitors">
        <SectionTitle aside={<span className="text-xs text-muted">{t("as published; never adjusted")}</span>}>
          {t("Competitors")}
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-muted">{t("Revenue, Q2 2026 (reported)")}</p>
            <HBars
              unit="ils"
              rows={v.competitors.filter((c) => c.revenue).map((c) => ({ label: c.name, value: c.revenue!.value }))}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">{t("Revenue growth y/y, Q2 2026 (reported)")}</p>
            <HBars
              unit="pct"
              rows={v.competitors
                .filter((c) => c.growth)
                .map((c) => ({ label: c.name, value: c.growth!.value, tone: c.growth!.value < 0 ? C.bad : C.good }))}
            />
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm" data-testid="competitor-table">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pe-3 text-start font-normal">{t("Chain")}</th>
                <th className="whitespace-nowrap py-1 pe-3 text-end font-normal">{t("Revenue Q2")}</th>
                <th className="whitespace-nowrap py-1 pe-3 text-end font-normal">{t("Growth")}</th>
                <th className="whitespace-nowrap py-1 pe-3 text-end font-normal">{t("Same-store")}</th>
                <th className="whitespace-nowrap py-1 pe-3 text-end font-normal">{t("Net profit")}</th>
                <th className="whitespace-nowrap py-1 pe-3 text-end font-normal">{t("Stores")}</th>
                <th className="whitespace-nowrap py-1 pe-3 text-end font-normal">{t("Basket")}</th>
                <th className="py-1 text-start font-normal">{t("Source")}</th>
              </tr>
            </thead>
            <tbody>
              {v.competitors.map((c) => {
                const src = c.revenue ?? c.stores;
                return (
                  <tr key={c.key} className="border-t border-line align-top">
                    <td className="py-1.5 pe-3">
                      <b>{c.name}</b>
                      <span className="block text-xs text-muted">
                        {c.listed ? (c.ticker ?? t("listed")) : t("private")}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap py-1.5 pe-3 text-end">
                      {c.revenue ? money(c.revenue.value) : "—"}
                    </td>
                    <td
                      className={`num whitespace-nowrap py-1.5 pe-3 text-end ${(c.growth?.value ?? 0) < 0 ? "text-p1" : "text-good"}`}
                    >
                      {pct(c.growth?.value)}
                    </td>
                    <td
                      className={`num whitespace-nowrap py-1.5 pe-3 text-end ${(c.sameStore?.value ?? 0) < 0 ? "text-p1" : ""}`}
                    >
                      {pct(c.sameStore?.value)}
                    </td>
                    <td className="num whitespace-nowrap py-1.5 pe-3 text-end">
                      {c.netProfit ? money(c.netProfit.value) : "—"}
                    </td>
                    <td className="num whitespace-nowrap py-1.5 pe-3 text-end">
                      {c.stores ? c.stores.value : "—"}
                      {c.stores && (
                        <span
                          className="ms-1 rounded border border-dashed border-muted px-1 text-[10px] uppercase text-muted"
                          title={c.stores.method ?? ""}
                        >
                          {t("Estimate")}
                        </span>
                      )}
                    </td>
                    <td className="num whitespace-nowrap py-1.5 pe-3 text-end">
                      {c.basket === null ? "—" : c.basket.toFixed(1)}
                    </td>
                    <td className="py-1.5 text-xs text-muted">
                      {src ? (
                        <a href={src.url} target="_blank" rel="noreferrer" className="text-muted underline">
                          {src.source}
                        </a>
                      ) : (
                        "—"
                      )}
                      {src && <span className="block">{day(t, src.asOf)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
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
