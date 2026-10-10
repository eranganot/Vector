import { describe, expect, it } from "vitest";
import { dayLabel, suggestMessage } from "./suggest";

const base = {
  to: "Noa",
  from: "Dana",
  workstream: "risk" as const,
  insightTitle: "Stock-outs on top-50 SKUs in 9 North branches",
  steps: [
    { title: "Transfer top-50 SKU stock from the Center DC", costIls: 54_000 },
    { title: "Daily DC slot for 9 branches", costIls: 0 },
  ],
  weeklyIls: 600_000,
  due: "2026-10-23",
  approvals: [{ names: ["Shira Katz"], costIls: 54_000 }],
  informed: ["Yossi Cohen"],
};

describe("action-suggest-v1 message", () => {
  it("writes the facts, the steps, the due date, the approval and who is copied (English)", () => {
    const m = suggestMessage({ ...base, locale: "en" });
    expect(m.templateId).toBe("action-suggest-v1:risk:en");
    expect(m.body).toBe(
      [
        "Noa, Stock-outs on top-50 SKUs in 9 North branches.",
        "About ₪600k a week is at stake.",
        "Please:\n1. Transfer top-50 SKU stock from the Center DC\n2. Daily DC slot for 9 branches",
        "Due 23 Oct.",
        "VECTOR will ask for approval: Shira Katz (₪54k).",
        "Copying Yossi Cohen.",
        "Dana",
      ].join("\n"),
    );
  });

  it("writes Hebrew for a Hebrew reader, and the upside for an opportunity", () => {
    const m = suggestMessage({ ...base, locale: "he", workstream: "opportunity", approvals: [], informed: [] });
    expect(m.templateId).toBe("action-suggest-v1:opportunity:he");
    expect(m.body).toContain("הפוטנציאל הוא כ־₪600k בשבוע.");
    expect(m.body).toContain("יעד: 23 אוק׳.");
    expect(m.body).not.toContain("אישור");
  });

  it("labels days", () => expect(dayLabel("2026-11-05", "en")).toBe("5 Nov"));
});
