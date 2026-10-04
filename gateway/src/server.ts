import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { env } from "./env.js";
import { adapterFor, allAdapters } from "./channels/registry.js";
import { ingest } from "./core-client.js";
import { addClient, broadcast } from "./realtime.js";

interface DispatchBody {
  channel?: string;
  externalContactId?: string;
  body?: string;
}

export function buildServer(): FastifyInstance {
  const server = Fastify({ logger: true });

  server.register(cors, { origin: true });
  server.register(websocket);

  server.get("/health", async () => ({ status: "ok" }));

  server.register(async (instance) => {
    instance.get("/ws", { websocket: true }, (socket) => {
      addClient(socket);
    });
  });

  server.post<{ Params: { channel: string } }>("/webhooks/:channel", async (request, reply) => {
    const adapter = adapterFor(request.params.channel);
    if (!adapter) {
      return reply.status(404).send({ error: "canal_desconhecido" });
    }

    const mensagem = adapter.parseWebhook(request.body);
    // Canal manda muito mais que texto. Responder 200 e ignorar e o contrato:
    // 4xx faz o Telegram reentregar o mesmo update para sempre.
    if (!mensagem) {
      return reply.status(200).send({ ignored: true });
    }

    const salva = await ingest(mensagem);
    broadcast({ type: "inbound", channel: mensagem.channel, message: salva });
    return reply.status(200).send({ ok: true });
  });

  server.post<{ Body: DispatchBody }>("/internal/dispatch", async (request, reply) => {
    if (request.headers["x-internal-token"] !== env.internalToken) {
      return reply.status(401).send({ error: "token_interno_invalido" });
    }

    const { channel, externalContactId, body } = request.body ?? {};
    if (!channel || !externalContactId || !body) {
      return reply.status(400).send({ error: "campos_obrigatorios_ausentes" });
    }

    const adapter = adapterFor(channel);
    if (!adapter) {
      return reply.status(404).send({ error: "canal_desconhecido" });
    }

    await adapter.send(externalContactId, body);
    broadcast({ type: "outbound", channel: adapter.channel, body });
    return reply.status(200).send({ ok: true });
  });

  server.get("/channels", async () =>
    allAdapters().map((adapter) => ({
      channel: adapter.channel,
      simulated: adapter.outbox !== undefined,
    })),
  );

  server.get("/simulated/outbox", async () =>
    allAdapters().flatMap((adapter) =>
      (adapter.outbox ?? []).map((enviada) => ({ channel: adapter.channel, ...enviada })),
    ),
  );

  return server;
}
