import { randomUUID } from "node:crypto";
import type { Channel, ChannelAdapter } from "./types.js";

interface SimulatedPayload {
  from?: unknown;
  text?: unknown;
  name?: unknown;
}

// WhatsApp Business API e e-mail reais exigem credencial e aprovacao que nao
// cabem no prazo. Entram pelo mesmo contrato do Telegram de proposito: trocar
// este adapter por um real nao toca uma linha do core.
export function simulatedAdapter(channel: Channel): ChannelAdapter {
  const outbox: Array<{ to: string; body: string }> = [];

  return {
    channel,

    parseWebhook(payload) {
      const corpo = payload as SimulatedPayload | null;
      const from = corpo?.from;
      const text = corpo?.text;
      if (typeof from !== "string" || from.trim() === "") return null;
      if (typeof text !== "string" || text.trim() === "") return null;

      return {
        channel,
        externalContactId: from,
        contactName: typeof corpo?.name === "string" ? corpo.name : null,
        externalMessageId: `${channel.toLowerCase()}:${randomUUID()}`,
        body: text,
      };
    },

    async send(externalContactId, body) {
      outbox.push({ to: externalContactId, body });
    },

    outbox,
  };
}
