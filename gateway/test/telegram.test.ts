import { describe, expect, it, vi } from "vitest";

process.env.INTERNAL_TOKEN = "token-de-teste";
process.env.TELEGRAM_BOT_TOKEN = "123:fake";
// env.ts recusa bot sem segredo de webhook, porque o canal subiria recusando
// todo update inbound.
process.env.TELEGRAM_WEBHOOK_SECRET = "segredo-de-teste";

const { telegramAdapter } = await import("../src/channels/telegram.js");

describe("adapter do Telegram", () => {
  it("traduz update de texto", () => {
    const resultado = telegramAdapter.parseWebhook({
      update_id: 4812,
      message: {
        message_id: 7,
        text: "oi, preciso de ajuda",
        chat: { id: 55512345 },
        from: { first_name: "Maria", last_name: "Silva" },
      },
    });

    expect(resultado).toEqual({
      channel: "TELEGRAM",
      externalContactId: "55512345",
      contactName: "Maria Silva",
      externalMessageId: "telegram:4812",
      body: "oi, preciso de ajuda",
    });
  });

  it("ignora update que nao e mensagem de texto", () => {
    expect(telegramAdapter.parseWebhook({ update_id: 1 })).toBeNull();
    expect(telegramAdapter.parseWebhook({
      update_id: 2,
      message: { chat: { id: 1 }, sticker: { emoji: "🙂" } },
    })).toBeNull();
    expect(telegramAdapter.parseWebhook({
      update_id: 3,
      my_chat_member: { chat: { id: 1 } },
    })).toBeNull();
    expect(telegramAdapter.parseWebhook({
      update_id: 4,
      message: { chat: { id: 1 }, text: "   " },
    })).toBeNull();
  });

  it("send chama a API do Telegram com chat_id e texto", async () => {
    const chamadas: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      chamadas.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("{\"ok\":true}", { status: 200 });
    });

    await telegramAdapter.send("55512345", "ja estou vendo");

    expect(chamadas[0]?.url).toContain("/bot123:fake/sendMessage");
    expect(chamadas[0]?.body).toEqual({ chat_id: "55512345", text: "ja estou vendo" });
    vi.unstubAllGlobals();
  });

  it("send propaga erro quando o Telegram recusa", async () => {
    vi.stubGlobal("fetch", async () => new Response("chat not found", { status: 400 }));

    await expect(telegramAdapter.send("000", "oi")).rejects.toThrow("Telegram respondeu 400");
    vi.unstubAllGlobals();
  });
});
