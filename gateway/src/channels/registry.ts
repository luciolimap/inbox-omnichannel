import { simulatedAdapter } from "./simulated.js";
import type { Channel, ChannelAdapter } from "./types.js";

const adapters = new Map<Channel, ChannelAdapter>([
  ["WHATSAPP", simulatedAdapter("WHATSAPP")],
  ["EMAIL", simulatedAdapter("EMAIL")],
]);

export function registerAdapter(adapter: ChannelAdapter): void {
  adapters.set(adapter.channel, adapter);
}

export function adapterFor(slug: string): ChannelAdapter | undefined {
  return adapters.get(slug.toUpperCase() as Channel);
}

export function allAdapters(): ChannelAdapter[] {
  return [...adapters.values()];
}
