import { describe, expect, it } from "vitest";
import { heContent, localize } from "./content";
import { HE_CONTENT, HE_TEMPLATES } from "./messages/he-content";

describe("data in Hebrew", () => {
  it("translates names and seeded text exactly", () => {
    expect(heContent("Haifa Grand Canyon")).toBe("חיפה גרנד קניון");
    expect(heContent("Eitan Rosen")).toBe("איתן רוזן");
  });
  it("translates generated sentences, and the names inside them", () => {
    expect(heContent("Decision by the manager of Trade & Commercial")).toBe("החלטה בידי המנהל/ת של סחר ומסחר");
    expect(
      heContent(
        "Finance, Marketing are waiting on it (₪70k/week at stake), and 1 downstream commitment is now at risk.",
      ),
    ).toBe("כספים, שיווק ממתינות לזה (₪70k לשבוע בסיכון), והתחייבות אחת בהמשך השרשרת בסיכון כעת.");
    expect(heContent("₪600k/week at stake · 3.5σ from usual · impact within 48 h")).toBe(
      "₪600k לשבוע בסיכון · 3.5σ מהרגיל · השפעה בתוך 48 שעות",
    );
    expect(heContent("Weekly ops meeting · 15 Oct")).toBe("ישיבת תפעול שבועית · 15 באוק׳");
  });
  it("leaves typed text and codes alone, and never matches words where a number belongs", () => {
    expect(heContent("Move to Friday")).toBeUndefined();
    expect(heContent("AP-3")).toBeUndefined();
    expect(heContent("sku-set:south-dairy-6")).toBeUndefined();
  });
  it("localizes a view but keeps ids, codes and dates", () => {
    const at = new Date();
    const v = localize({ id: "North", name: "North", at, operation: "Executed", list: ["Coast"] }, "he");
    expect(v).toEqual({ id: "North", name: "צפון", at, operation: "Executed", list: ["שרון והחוף"] });
    expect(localize({ name: "North" }, "en")).toEqual({ name: "North" });
  });
  it("keeps every placeholder in the template translations", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [en, he] of Object.entries(HE_TEMPLATES)) expect(ph(he), en).toEqual(ph(en));
    for (const [en, he] of Object.entries(HE_CONTENT)) expect(ph(he), en).toEqual(ph(en));
  });
});
