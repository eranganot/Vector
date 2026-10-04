import { describe, expect, it } from "vitest";
import { addDays, dayKind, weekday } from "./calendar";

describe("calendar", () => {
  it("knows weekdays (22 Oct 2026 is a Thursday)", () => expect(weekday("2026-10-22")).toBe(4));
  it("adds days across month ends", () => expect(addDays("2026-09-29", 3)).toBe("2026-10-02"));
  it("marks Yom Kippur as a holiday", () => expect(dayKind("2026-09-21")).toBe("holiday"));
});
