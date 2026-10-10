import { api } from "@/app/_lib/api";
import { MARKET_REGIONS, type MarketRegion } from "@/application/facade";
import { MarketScreen } from "../../_components/market";
import { getT } from "../../_lib/locale";
import { requireActor } from "../../_lib/session";

/** Market & competitors (plan v2, E6; market-intelligence.md §5). */
export default async function MarketPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const { actor } = await requireActor();
  const t = await getT();
  const region = MARKET_REGIONS.find((x) => x === r) as MarketRegion | undefined;
  const v = await api.marketView(actor, region);
  if (!v) return <p className="text-sm text-muted">{t("No market data yet.")}</p>;
  return <MarketScreen v={v} t={t} />;
}
