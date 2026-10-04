import { env } from "../env.js";
import type { ChannelAdapter } from "./types.js";

interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: unknown;
    chat?: { id?: unknown };
    from?: { first_name?: unknown; last_name?: unknown };
  };
}

export const telegramAdapter: ChannelAdapter = {
  channel: "TELEGRAM",

  parseWebhook(payload) {
    const update = payload as TelegramUpdate | null;
    const mensagem = update?.message;
    const chatId = mensagem?.chat?.id;
    const texto = mensagem?.text;

    // Telegram manda update de muitos tipos pelo mesmo webhook: sticker, foto,
    // entrada em grupo, edicao. So texto com chat vira mensagem no inbox.
    if (typeof chatId !== "number" && typeof chatId !== "string") return null;
    if (typeof texto !== "string" || texto.trim() === "") return null;

    const nome = [mensagem?.from?.first_name, mensagem?.from?.last_name]
      .filter((parte): parte is string => typeof parte === "string" && parte !== "")
      .join(" ");

    return {
      channel: "TELEGRAM",
      externalContactId: String(chatId),
      contactName: nome === "" ? null : nome,
      externalMessageId: `telegram:${update?.update_id ?? mensagem?.message_id}`,
      body: texto,
    };
  },

  async send(externalContactId, body) {
    if (!env.telegramBotToken) {
      throw new Error("TELEGRAM_BOT_TOKEN ausente: canal Telegram desligado");
    }

    const resposta = await fetch(
      `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: externalContactId, text: body }),
      },
    );

    if (!resposta.ok) {
      throw new Error(`Telegram respondeu ${resposta.status}: ${await resposta.text()}`);
    }
  },
};
