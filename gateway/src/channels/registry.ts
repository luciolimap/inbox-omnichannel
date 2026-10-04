import { env } from "../env.js";
import { simulatedAdapter } from "./simulated.js";
import { telegramAdapter } from "./telegram.js";
import type { Channel, ChannelAdapter } from "./types.js";

const adapters = new Map<Channel, ChannelAdapter>([
  ["WHATSAPP", simulatedAdapter("WHATSAPP")],
  ["EMAIL", simulatedAdapter("EMAIL")],
]);

// Sem token o canal nao entra no registry: webhook do Telegram passa a
// responder 404 em vez de estourar na hora de enviar.
if (env.telegramBotToken) {
  adapters.set("TELEGRAM", telegramAdapter);
}

export function registerAdapter(adapter: ChannelAdapter): void {
  adapters.set(adapter.channel, adapter);
}

export function adapterFor(slug: string): ChannelAdapter | undefined {
  return adapters.get(slug.toUpperCase() as Channel);
}

export function allAdapters(): ChannelAdapter[] {
  return [...adapters.values()];
}
