import { describe, expect, it } from "vitest";
import { flowDepth, knockOn, type FlowEdge, type FlowNode } from "./knock-on";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const node = (id: string, due: string, o: Partial<FlowNode> = {}): FlowNode => ({
  id,
  unitId: `u-${id}`,
  dueAt: d(due),
  completedAt: null,
  status: "open",
  weeklyIls: 0,
  ...o,
});
// Marketing signage → Store Ops launch → 2 regions; the holiday story in the seed.
const nodes = [node("signage", "2026-10-22"), node("launch", "2026-10-24")];
const edges: FlowEdge[] = [
  { id: "e1", from: "signage", to: "launch", toUnitId: "u-launch", needBy: d("2026-10-23"), weeklyIls: 300_000 },
  { id: "e2", from: "launch", to: null, toUnitId: "north", needBy: d("2026-10-24"), weeklyIls: 70_000 },
  { id: "e3", from: "launch", to: null, toUnitId: "south", needBy: d("2026-10-24"), weeklyIls: 70_000 },
];

describe("knock-on-v1", () => {
  it("on time: nothing late, nothing lost", () => {
    const k = knockOn(nodes, edges, d("2026-10-20"));
    expect(k.totalIls).toBe(0);
    expect(k.maxDaysLate).toBe(0);
    expect(k.nodes.get("launch")!.cause).toBe("on_time");
  });

  it("a 3-day delay at the source pushes the launch 2 days and both regions, and costs ₪ per day late", () => {
    const k = knockOn(nodes, edges, d("2026-10-20"), { nodeId: "signage", days: 3 });
    // signage ready 25 Oct; launch needed it 23 Oct → 2 days late → launch 26 Oct.
    expect(k.nodes.get("signage")!.daysLate).toBe(3);
    expect(k.nodes.get("launch")).toMatchObject({ daysLate: 2, cause: "upstream", pushedBy: "e1" });
    expect(k.edges.get("e1")).toMatchObject({ daysLate: 2, costIls: Math.round((300_000 * 2) / 7) });
    expect(k.edges.get("e2")!.daysLate).toBe(2);
    expect(k.lateUnitIds.sort()).toEqual(["north", "south", "u-launch"]);
    expect(k.totalIls).toBe(Math.round((300_000 * 2) / 7) + 2 * Math.round((70_000 * 2) / 7));
  });

  it("slack absorbs a small delay: one day late at the source, needed a day later, costs nothing", () => {
    const k = knockOn(nodes, edges, d("2026-10-20"), { nodeId: "signage", days: 1 });
    expect(k.nodes.get("signage")!.daysLate).toBe(1);
    expect(k.nodes.get("launch")!.daysLate).toBe(0);
    expect(k.totalIls).toBe(0);
  });

  it("an overdue node is ready today at the earliest; a done node is ready when it was done", () => {
    const late = knockOn([node("signage", "2026-10-22", { status: "overdue" }), nodes[1]], edges, d("2026-10-25"));
    expect(late.nodes.get("signage")!.daysLate).toBe(3);
    expect(late.nodes.get("launch")!.daysLate).toBe(2);
    const done = knockOn(
      [node("signage", "2026-10-22", { status: "done", completedAt: d("2026-10-21") }), nodes[1]],
      edges,
      d("2026-10-25"),
    );
    expect(done.nodes.get("signage")!.daysLate).toBe(0);
  });

  it("an end node with no edge counts its own ₪ a week", () => {
    const k = knockOn([node("solo", "2026-10-22", { weeklyIls: 70_000 })], [], d("2026-10-20"), {
      nodeId: "solo",
      days: 7,
    });
    expect(k.totalIls).toBe(70_000);
  });

  it("orders the flow left to right", () => {
    const depth = flowDepth(nodes, edges);
    expect(depth.get("signage")).toBe(0);
    expect(depth.get("launch")).toBe(1);
  });
});
