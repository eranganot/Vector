import { describe, expect, it } from "vitest";
import { ChannelUnavailable, channelAdapter, registeredAdapters } from "./index";

describe("channel seam (FB-8)", () => {
  it("registers only the in-app adapter, which never leaves VECTOR", () => {
    expect(registeredAdapters().map((a) => a.name)).toEqual(["in_app"]);
    expect(registeredAdapters().every((a) => !a.external)).toBe(true);
  });

  it("refuses email, Slack and messaging even with CHANNELS_LIVE on", () => {
    for (const c of ["email", "slack", "sms", "whatsapp"] as const)
      expect(() => channelAdapter(c, { CHANNELS_LIVE: "on" })).toThrow(ChannelUnavailable);
  });

  it("delivers in-app, marked simulated", async () => {
    const now = new Date("2026-10-22T05:00:00Z");
    const r = await channelAdapter("in_app").send(
      { channel: "in_app", toUserIds: ["u"], subject: "s", body: "b" },
      now,
    );
    expect(r).toEqual({ adapter: "in_app", simulated: true, deliveredAt: now });
  });
});
