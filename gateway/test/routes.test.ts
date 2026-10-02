import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

process.env.INTERNAL_TOKEN = "token-de-teste";
process.env.CORE_URL = "http://core.invalido";

const { buildServer } = await import("../src/server.js");

describe("rotas do gateway", () => {
  let server: FastifyInstance;
  let chamadasAoCore: number;

  beforeEach(async () => {
    chamadasAoCore = 0;
    vi.stubGlobal("fetch", async () => {
      chamadasAoCore += 1;
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
      payload: { from: "+5511999999999", text: "oi" },
    });

    expect(resposta.statusCode).toBe(200);
    expect(chamadasAoCore).toBe(1);
  });

  it("webhook sem texto responde 200 e nao chama o core", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      payload: { from: "+5511999999999" },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ignored: true });
    expect(chamadasAoCore).toBe(0);
  });

  it("webhook de canal desconhecido responde 404", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/fax",
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
});
