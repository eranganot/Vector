/**
 * The channel seam (plan v2, E4; action-center.md §4). A message leaves VECTOR only through an adapter registered
 * here. In the demo (FB-8) the only adapter is in-app: the message is delivered to the recipients' Waiting on you
 * inside VECTOR and nothing goes over the network. Email, Slack and messaging adapters arrive after the MVP with their
 * own security review, an allowlist and a kill switch (CHANNELS_LIVE, off by default).
 */
export type Channel = "in_app" | "email" | "slack" | "sms" | "whatsapp";

export type OutgoingMessage = { channel: Channel; toUserIds: string[]; subject: string; body: string };
export type Receipt = { adapter: string; simulated: boolean; deliveredAt: Date };

export interface ChannelAdapter {
  readonly name: string;
  /** True when sending reaches something outside VECTOR. */
  readonly external: boolean;
  send(message: OutgoingMessage, now: Date): Promise<Receipt>;
}

/** In-app delivery: the stored message row is the delivery; recipients read it in VECTOR. */
export const inAppAdapter: ChannelAdapter = {
  name: "in_app",
  external: false,
  async send(_message, now) {
    return { adapter: "in_app", simulated: true, deliveredAt: now };
  },
};

const REGISTRY: Partial<Record<Channel, ChannelAdapter>> = { in_app: inAppAdapter };

export class ChannelUnavailable extends Error {}

/** The adapter for a channel. Anything but in-app is refused until a live adapter is registered and enabled. */
export function channelAdapter(
  channel: Channel,
  env: Record<string, string | undefined> = process.env,
): ChannelAdapter {
  const a = REGISTRY[channel];
  if (!a) throw new ChannelUnavailable(`channel ${channel} is not available in this environment`);
  if (a.external && env.CHANNELS_LIVE !== "on") throw new ChannelUnavailable(`channel ${channel} is switched off`);
  return a;
}

/** Every registered adapter (for the "nothing external in Dev or Prod" check). */
export const registeredAdapters = () => Object.values(REGISTRY);
