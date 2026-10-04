import { describe, expect, it } from "vitest";
import { canonicalJson, chainHash, GENESIS_HASH, hashedFields } from "./audit";

const row = {
  seq: 1,
  orgId: "o",
  occurredAt: new Date("2026-10-22T05:00:00Z"),
  actorType: "user",
  actorId: "u",
  sessionId: "s",
  viaDemoSwitcher: false,
  operation: "x.y",
  entityType: "x",
  entityId: "e",
  fromState: null,
  toState: "open",
  reason: null,
  changes: { b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } },
  policy: null,
  evidenceIds: [],
  aiGenerationId: null,
  requestId: "r",
};

describe("audit hashing", () => {
  it("canonical JSON sorts keys recursively", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 1 } })).toBe('{"a":{"c":1,"d":2},"b":1}');
  });
  it("ignores non-hashed columns of a stored row (regression: verifier hashed id/hash/prevHash/recordedAt)", () => {
    const stored = { ...row, id: "id-1", hash: Buffer.from([1]), prevHash: Buffer.from([0]), recordedAt: new Date() };
    expect(hashedFields(stored)).toBe(hashedFields(row));
  });
  it("any change to a hashed field changes the hash", () => {
    const h = chainHash(GENESIS_HASH, hashedFields(row));
    expect(chainHash(GENESIS_HASH, hashedFields({ ...row, actorId: "mallory" })).equals(h)).toBe(false);
    expect(chainHash(GENESIS_HASH, hashedFields({ ...row, changes: { ...row.changes, b: 2 } })).equals(h)).toBe(false);
  });
});
