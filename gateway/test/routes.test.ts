import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

process.env.INTERNAL_TOKEN = "token-de-teste";
process.env.CORE_URL = "http://core.invalido";
process.env.TELEGRAM_BOT_TOKEN = "bot-de-teste";
process.env.TELEGRAM_WEBHOOK_SECRET = "segredo-de-teste";

const { buildServer } = await import("../src/server.js");

describe("rotas do gateway", () => {
  const BEARER = { authorization: "Bearer jwt-de-agente" };

  let server: FastifyInstance;
  let chamadasDeIngestao: number;

  beforeEach(async () => {
    chamadasDeIngestao = 0;
    // O stub separa por URL: /api/agents e a validacao do Bearer e /internal/inbound
    // e a ingestao. Contar as duas juntas esconderia qual delas rodou.
    vi.stubGlobal("fetch", async (url: string | URL) => {
      const alvo = String(url);
      if (alvo.endsWith("/api/agents")) {
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      chamadasDeIngestao += 1;
      return new Response(
        JSON.stringify({ id: 1, direction: "INBOUND", body: "oi", deliveryStatus: "SENT" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    server = buildServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    vi.unstubAllGlobals();
  });

  it("webhook valido repassa ao core", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      headers: BEARER,
      payload: { from: "+5511999999999", text: "oi" },
    });

    expect(resposta.statusCode).toBe(200);
    expect(chamadasDeIngestao).toBe(1);
  });

  it("webhook sem texto responde 200 e nao chama o core", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      headers: BEARER,
      payload: { from: "+5511999999999" },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ignored: true });
    expect(chamadasDeIngestao).toBe(0);
  });

  it("webhook de canal desconhecido responde 404", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/fax",
      headers: BEARER,
      payload: { from: "x", text: "y" },
    });

    expect(resposta.statusCode).toBe(404);
  });

  it("dispatch sem token interno responde 401", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/internal/dispatch",
      payload: { channel: "WHATSAPP", externalContactId: "+5511999999999", body: "oi" },
    });

    expect(resposta.statusCode).toBe(401);
  });

  it("dispatch com token entrega pelo adapter do canal", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/internal/dispatch",
      headers: { "x-internal-token": "token-de-teste" },
      payload: { channel: "WHATSAPP", externalContactId: "+5511999999999", body: "ja estou vendo" },
    });

    expect(resposta.statusCode).toBe(200);

    const outbox = await server.inject({ method: "GET", url: "/simulated/outbox" });
    expect(outbox.json()).toContainEqual({
      channel: "WHATSAPP",
      to: "+5511999999999",
      body: "ja estou vendo",
    });
  });
  it("canal simulado sem Bearer responde 401", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      payload: { from: "+5511999999999", text: "oi" },
    });

    expect(resposta.statusCode).toBe(401);
    expect(chamadasDeIngestao).toBe(0);
  });

  it("canal simulado com Bearer que o core recusa responde 401", async () => {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).endsWith("/api/agents")) return new Response("", { status: 401 });
      throw new Error("nao deveria ingerir");
    });

    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      headers: { authorization: "Bearer jwt-vencido" },
      payload: { from: "+5511999999999", text: "oi" },
    });

    expect(resposta.statusCode).toBe(401);
  });

  it("telegram sem o header secreto responde 401", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/telegram",
      payload: { update_id: 1, message: { chat: { id: 7 }, text: "oi" } },
    });

    expect(resposta.statusCode).toBe(401);
    expect(chamadasDeIngestao).toBe(0);
  });

  it("telegram com o header secreto repassa ao core", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/telegram",
      headers: { "x-telegram-bot-api-secret-token": "segredo-de-teste" },
      payload: { update_id: 1, message: { chat: { id: 7 }, text: "oi" } },
    });

    expect(resposta.statusCode).toBe(200);
    expect(chamadasDeIngestao).toBe(1);
  });
  it("core fora do ar responde 503, nao 401", async () => {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).endsWith("/api/agents")) throw new Error("ECONNREFUSED");
      throw new Error("nao deveria ingerir");
    });

    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      headers: BEARER,
      payload: { from: "+5511999999999", text: "oi" },
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({ error: "core_indisponivel" });
  });
});
