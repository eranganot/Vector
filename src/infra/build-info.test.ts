import { describe, expect, it } from "vitest";
import { buildInfo } from "./build-info";

describe("buildInfo", () => {
  it("prefers the Railway commit SHA", () => {
    expect(buildInfo({ RAILWAY_GIT_COMMIT_SHA: "abcdef1234567", GIT_SHA: "zzz" })).toEqual({
      sha: "abcdef1234567",
      shortSha: "abcdef1",
    });
  });
  it("reports unknown when no SHA is available", () => {
    expect(buildInfo({}).sha).toBe("unknown");
  });
});
