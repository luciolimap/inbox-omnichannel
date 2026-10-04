import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

describe("env do gateway", () => {
  it("recusa bot do Telegram sem segredo de webhook", async () => {
    process.env.INTERNAL_TOKEN = "token-de-teste";
    process.env.TELEGRAM_BOT_TOKEN = "123:fake";
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    vi.resetModules();

    await expect(import("../src/env.js")).rejects.toThrow(/TELEGRAM_WEBHOOK_SECRET obrigatoria/);
  });

  it("aceita os dois juntos", async () => {
    process.env.INTERNAL_TOKEN = "token-de-teste";
    process.env.TELEGRAM_BOT_TOKEN = "123:fake";
    process.env.TELEGRAM_WEBHOOK_SECRET = "segredo";
    vi.resetModules();

    const { env } = await import("../src/env.js");
    expect(env.telegramWebhookSecret).toBe("segredo");
  });
});
