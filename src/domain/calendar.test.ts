import { describe, expect, it } from "vitest";
import { addDays, dayKind, tradingWeight, weekday } from "./calendar";

describe("calendar", () => {
  it("knows weekdays (22 Oct 2026 is a Thursday)", () => expect(weekday("2026-10-22")).toBe(4));
  it("adds days across month ends", () => expect(addDays("2026-09-29", 3)).toBe("2026-10-02"));
  it("marks Yom Kippur as a holiday", () => expect(dayKind("2026-09-21")).toBe("holiday"));
  it("weighs trading days: Thursday peaks, Saturday is quiet, holiday eves spike, holy days close", () => {
    expect(tradingWeight("2026-10-22")).toBe(1.25);
    expect(tradingWeight("2026-10-24")).toBe(0.35);
    expect(tradingWeight("2026-09-20")).toBe(1.45); // Yom Kippur eve
    expect(tradingWeight("2026-09-21")).toBe(0.05);
  });
});
