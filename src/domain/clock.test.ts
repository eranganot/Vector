import { describe, expect, it } from "vitest";
import { fixedClock } from "./clock";

describe("fixedClock", () => {
  it("always returns the pinned instant, as a fresh object", () => {
    const clock = fixedClock("2026-10-04T09:00:00Z");
    const a = clock.now();
    a.setFullYear(2000);
    expect(clock.now().toISOString()).toBe("2026-10-04T09:00:00.000Z");
  });
});
