/**
 * Every UI string passed to t("…") has a Hebrew translation (Eran, 2026-10-05: "translate everything to Hebrew").
 * Scans the UI source for string literals given to t(); dynamic keys are listed in DYNAMIC below.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HE } from "./messages/he";
import { makeT } from "./t";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|ts)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

const keysIn = (src: string) =>
  [...src.matchAll(/\bt[k]?\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));

/** Keys built at run time (t(STATUS[x].label) and the like): every value such a call can receive. */
const DYNAMIC = [
  // header persona groups
  "Leadership & admin",
  "Regions & branches",
  "Departments",
  // org unit types, KPI status words, what-changed verbs
  "Group",
  "Region",
  "Branch",
  "Department",
  "on target",
  "watch",
  "off target",
  // chart reference lines
  "target",
  "usual",
  // action statuses (unit, insight, actions pages; home cards)
  "Proposed",
  "Awaiting approval",
  "Pending approval",
  "Ready",
  "Executing",
  "Executed",
  "Done",
  "Failed",
  "Rejected",
  "Cancelled",
  "Waiting for the decision",
  "Waiting for approval",
  "proposed",
  "ready",
  "executing",
  "executed",
  "failed",
  "rejected",
  "cancelled",
  // health and dependency states
  "On track",
  "Watch",
  "At risk",
  "Healthy",
  "Met",
  "Waiting",
  "Blocked",
  // waiting rows, resolved pills
  "Decide",
  "Approve",
  "Do",
  "resolved",
  "dismissed",
  // commitment effects
  "promote",
  "delist",
  "spend",
  "freeze spend",
  "cutover",
  "peak trading",
  // insight and approval statuses, verdicts
  "open",
  "acknowledged",
  "superseded",
  "requested",
  "granted",
  "denied",
  "expired",
  "withdrawn",
  "lapsed",
  "worked",
  "partially worked",
  "did not work",
  "inconclusive",
  "Worked",
  "Partly worked",
  "Did not work",
  "Inconclusive",
  // roles
  "Executive",
  "Department Manager",
  "Regional Manager",
  "Admin",
  "Viewer",
  // signal kinds
  "KPI deviation",
  "external event",
  "dependency delay",
  "overdue commitment",
  "decision conflict",
  "incident",
  "facility review",
  // what-changed verbs
  "New",
  "Re-prioritized",
  "Decided",
  "Declined",
  "Approved",
  "Denied",
  "Needs approval again",
  "Outcome measured",
  "Resolved",
  // priority factors (insight page)
  "impact",
  "breadth",
  "urgency",
  "magnitude",
  "strategic",
  "compliance",
  "value",
  "window",
  "reach",
  "ease",
  // actions filters
  "In flight",
  "Overdue",
  "Mine",
  "All",
];

describe("Hebrew coverage", () => {
  const used = [
    ...new Set([
      ...[...files("src/app"), "src/application/queries/performance.ts"].flatMap((p) =>
        keysIn(readFileSync(p, "utf8")),
      ),
      ...DYNAMIC,
    ]),
  ];
  it("finds the UI strings", () => expect(used.length).toBeGreaterThan(20));
  it("has a Hebrew translation for every one", () => {
    const missing = used.filter((k) => !(k in HE));
    if (missing.length && process.env.I18N_DUMP) writeFileSync(process.env.I18N_DUMP, JSON.stringify(missing, null, 1));
    expect(missing).toEqual([]);
  });
  it("keeps every placeholder in the translation", () => {
    for (const [en, he] of Object.entries(HE)) {
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(ph(he), en).toEqual(ph(en));
    }
  });
  it("fills placeholders and falls back to English", () => {
    expect(makeT("en")("All {n} risks →", { n: 3 })).toBe("All 3 risks →");
    expect(makeT("he")("Home")).toBe("בית");
    expect(makeT("he")("not translated yet")).toBe("not translated yet");
  });
});
