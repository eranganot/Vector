import { describe, expect, it } from "vitest";
import { addDays } from "@/domain/calendar";
import { generateDay, P2S1 } from "./generator";
import { UNITS } from "./org";

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
});
