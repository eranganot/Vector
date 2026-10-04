import { describe, expect, it } from "vitest";
import { DomainError } from "../errors";
import { MACHINES, type MachineName, transition } from "./machines";

describe.each(Object.keys(MACHINES) as MachineName[])("%s state machine", (name) => {
  const rows = MACHINES[name] as { id: string; from: string; command: string; to: string }[];
  const states = [...new Set(rows.flatMap((r) => [r.from, r.to]))];
  const commands = [...new Set(rows.map((r) => r.command))];

  it.each(rows.map((r) => [r.id, r.from, r.command, r.to]))("%s: %s --%s--> %s", (_id, from, command, to) => {
    expect(transition(name, from === "∅" ? null : from, command).to).toBe(to);
  });

  const illegalPairs = states.flatMap((s) =>
    commands.filter((c) => !rows.some((r) => r.from === s && r.command === c)).map((c) => [s, c] as const),
  );
  it.each(illegalPairs)("rejects %s --%s-->", (from, command) => {
    expect(() => transition(name, from === "∅" ? null : from, command)).toThrow(DomainError);
  });
});

describe("terminal states", () => {
  it.each([
    ["action", "executed"],
    ["action", "rejected"],
    ["action", "cancelled"],
    ["decision", "declined"],
    ["insight", "resolved"],
    ["approval", "denied"],
  ] as const)("%s %s has no way out", (m, s) => {
    const rows = MACHINES[m] as { from: string }[];
    expect(rows.some((r) => r.from === s)).toBe(false);
  });
});
