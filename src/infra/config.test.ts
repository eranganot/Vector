import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

describe("parseConfig", () => {
  it("applies defaults", () => {
    const c = parseConfig({ DATABASE_URL: "postgres://x" });
    expect(c.VECTOR_ENV).toBe("local");
    expect(c.LOG_LEVEL).toBe("info");
  });

  it("rejects a missing DATABASE_URL with a readable message", () => {
    expect(() => parseConfig({})).toThrow(/DATABASE_URL/);
  });

  it("rejects an unknown environment name", () => {
    expect(() => parseConfig({ DATABASE_URL: "postgres://x", VECTOR_ENV: "prod" })).toThrow(/VECTOR_ENV/);
  });
});
