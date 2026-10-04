import { describe, expect, it } from "vitest";
import { addDays } from "@/domain/calendar";
import { generateDay } from "@/infra/seed/generator";
import { UNITS } from "@/infra/seed/org";
import { detectDeviation, KPI_CONFIG } from "@/domain/detection/kpi-deviation";

const branches = UNITS.filter((u) => u.type === "branch");
const series = (code: string, kpi: keyof ReturnType<typeof generateDay>, asOf: string) => {
  const b = UNITS.find((u) => u.code === code)!;
  return Array.from({ length: 84 }, (_, i) => {
    const day = addDays(asOf, -84 + i);
    return { day, value: generateDay(b, day)[kpi] };
  });
};

describe("kpi-deviation detector v1 on the synthetic data", () => {
  it("finds planted story P2-S1: Haifa Grand Canyon sales and OSA down", () => {
    const sales = detectDeviation(series("HFA-GC", "net_sales", "2026-10-22"), "2026-10-22", KPI_CONFIG.net_sales);
    const osa = detectDeviation(series("HFA-GC", "osa", "2026-10-22"), "2026-10-22", KPI_CONFIG.osa);
    expect(sales).not.toBeNull();
    expect(sales!.change).toBeLessThan(-0.12);
    expect(osa).not.toBeNull();
    expect(osa!.change).toBeLessThan(-5);
  });

  it("raises nothing on unplanted noise (no other branch, no other KPI)", () => {
    for (const b of branches) {
      for (const k of Object.keys(KPI_CONFIG) as (keyof ReturnType<typeof generateDay>)[]) {
        if (b.code === "HFA-GC" && (k === "net_sales" || k === "osa" || k === "transactions" || k === "labor_pct"))
          continue;
        expect(
          detectDeviation(series(b.code, k, "2026-10-22"), "2026-10-22", KPI_CONFIG[k]),
          `${b.code}/${k}`,
        ).toBeNull();
      }
    }
  });

  it("stays quiet on Haifa Grand Canyon before the story starts", () => {
    expect(detectDeviation(series("HFA-GC", "net_sales", "2026-10-08"), "2026-10-08", KPI_CONFIG.net_sales)).toBeNull();
  });
});
