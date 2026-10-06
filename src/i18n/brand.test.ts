import { describe, expect, it } from "vitest";
import { pageTitle, productName } from "./brand";

describe("product name (FB-2)", () => {
  it("is the same full name in every place, per language", () => {
    expect(productName("en")).toBe("VECTOR | Organizational Intelligence");
    expect(productName("he")).toBe("VECTOR | אינטליגנציה ארגונית");
  });
  it("puts the page before the product in a tab title", () => {
    expect(pageTitle("en")).toBe("VECTOR | Organizational Intelligence");
    expect(pageTitle("en", "Risks")).toBe("Risks · VECTOR | Organizational Intelligence");
  });
});
