import { describe, expect, it } from "vitest";
import { addBlock, editBlock, moveBlock, parseLayout, removeBlock, templateLayout, MAX_BLOCKS } from "./report";

describe("report-v1 layout", () => {
  it("starts from the weekly management template in the spec's order", () => {
    const l = templateLayout("weekly_management");
    expect(l.blocks[0]).toMatchObject({ id: "b1", metric: "headline", kind: "text", period: null });
    expect(l.blocks.map((b) => b.metric)).toContain("decisions_needed");
    expect(l.blocks.find((b) => b.metric === "sales_vs_budget")).toMatchObject({ kind: "line", period: "8w" });
  });

  it("adds, removes, reorders and edits blocks", () => {
    let l = templateLayout("weekly_management");
    const n = l.blocks.length;
    l = addBlock(l, "opex_vs_budget");
    expect(l.blocks.at(-1)).toMatchObject({ id: `b${n + 1}`, metric: "opex_vs_budget", kind: "bars" });
    l = moveBlock(l, `b${n + 1}`, -1);
    expect(l.blocks.at(-2)!.metric).toBe("opex_vs_budget");
    l = moveBlock(l, "b1", -1); // already first: unchanged
    expect(l.blocks[0].id).toBe("b1");
    l = editBlock(l, "b3", { kind: "bars", period: "13w" });
    expect(l.blocks.find((b) => b.id === "b3")).toMatchObject({
      metric: "sales_vs_budget",
      kind: "bars",
      period: "13w",
    });
    l = editBlock(l, "b3", { kind: "ring" }); // not offered for this metric: ignored
    expect(l.blocks.find((b) => b.id === "b3")!.kind).toBe("bars");
    l = removeBlock(l, "b1");
    expect(l.blocks.some((b) => b.id === "b1")).toBe(false);
  });

  it("never trusts input: unknown metrics, kinds, periods, duplicate ids and foreign scopes are dropped or reset", () => {
    const l = parseLayout(
      {
        template: "weekly_management",
        blocks: [
          { id: "b1", metric: "sales_vs_budget", kind: "pie", period: "99w", scopeUnitId: "x" },
          { id: "b1", metric: "headline" },
          { id: "b2", metric: "drop_table" },
          { id: "zz", metric: "headline" },
          { id: "b3", metric: "kpis_on_target", kind: "table", scopeUnitId: "ok" },
        ],
      },
      (u) => u === "ok",
    )!;
    expect(l.blocks).toEqual([
      { id: "b1", metric: "sales_vs_budget", kind: "line", period: "8w", scopeUnitId: null },
      { id: "b3", metric: "kpis_on_target", kind: "table", period: null, scopeUnitId: "ok" },
    ]);
    expect(parseLayout({ template: "nope", blocks: [] })).toBeNull();
    expect(parseLayout("x")).toBeNull();
  });

  it("caps the number of blocks", () => {
    let l = templateLayout("weekly_management");
    for (let k = 0; k < 30; k++) l = addBlock(l, "blockers");
    expect(l.blocks.length).toBe(MAX_BLOCKS);
  });
});
