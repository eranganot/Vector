import { describe, expect, it } from "vitest";
import { addDays } from "@/domain/calendar";
import { CATALOG_PLANTS, generateDay, generateDepartmentDay, P2S1 } from "./generator";
import { UNITS, USERS } from "./org";

const branch = (code: string) => UNITS.find((u) => u.code === code)!;

describe("synthetic generator", () => {
  it("is deterministic", () => {
    expect(generateDay(branch("NAZ"), "2026-10-14")).toEqual(generateDay(branch("NAZ"), "2026-10-14"));
  });

  it("plants story P2-S1: Haifa Grand Canyon sales fall ~18% week on week", () => {
    const b = branch(P2S1.branch);
    const sum = (from: string) =>
      Array.from({ length: 7 }, (_, i) => generateDay(b, addDays(from, i)).net_sales).reduce((a, x) => a + x, 0);
    const change = sum("2026-10-15") / sum("2026-10-08") - 1;
    expect(change).toBeLessThan(-0.12);
    expect(change).toBeGreaterThan(-0.24);
  });

  it("recovers OSA after the transfer intervention, and only then", () => {
    const b = branch(P2S1.branch);
    const without = generateDay(b, "2026-10-27").osa;
    const withTransfer = generateDay(b, "2026-10-27", { p2s1TransferDay: "2026-10-22" }).osa;
    expect(without).toBeLessThan(91);
    expect(withTransfer).toBeGreaterThan(95);
  });

  it("plants the catalog's background conditions", () => {
    const P = CATALOG_PLANTS;
    expect(generateDay(branch("TLV-DZ"), "2026-10-21").shrink_pct).toBeGreaterThan(4);
    expect(generateDay(branch("TLV-DZ"), "2026-10-10").shrink_pct).toBeLessThan(2);
    expect(generateDay(branch("KAT"), "2026-10-21").osa).toBeLessThan(92.5);
    expect(generateDay(branch("KAT"), "2026-10-18").osa).toBeGreaterThan(95);
    const labor = (code: string, from: string) =>
      Array.from({ length: 14 }, (_, i) => generateDay(branch(code), addDays(from, i)).labor_pct).reduce(
        (a, x) => a + x,
      ) / 14;
    // Over the same weeks, Center's labor % rises ~6% more than a North branch's (holidays move both).
    const ratio = (code: string) => labor(code, "2026-10-08") / labor(code, "2026-09-10");
    expect(ratio("RG-AY") / ratio("NAZ")).toBeGreaterThan(1.04);
    expect(P.northOsaDip.branches).not.toContain("HFA-DT");
    expect(generateDepartmentDay("dc_on_time", "2026-10-21")).toBeLessThan(85);
    expect(generateDepartmentDay("dc_on_time", "2026-10-10")).toBeGreaterThan(92);
    expect(generateDepartmentDay("opex_vs_budget", "2026-10-21")).toBeGreaterThan(104);
  });

  it("has 60 branches in 5 regions and all 8 departments", () => {
    expect(UNITS.filter((u) => u.type === "branch")).toHaveLength(60);
    expect(UNITS.filter((u) => u.type === "region")).toHaveLength(5);
    expect(UNITS.filter((u) => u.type === "department")).toHaveLength(8);
  });

  it("every unit with managers has exactly one head per role (work is assigned to the head)", () => {
    const byUnitRole = new Map<string, boolean[]>();
    for (const u of USERS)
      for (const r of u.roles) {
        const k = `${r.unit}/${r.role}`;
        byUnitRole.set(k, [...(byUnitRole.get(k) ?? []), r.isHead]);
      }
    for (const [k, flags] of byUnitRole) expect(flags.filter(Boolean).length, k).toBe(1);
  });
});
