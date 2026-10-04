import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { env } from "./env.js";
import { adapterFor, allAdapters } from "./channels/registry.js";
import { agenteAutenticado, CoreIndisponivel, ingest } from "./core-client.js";
import { addClient, broadcast } from "./realtime.js";

interface DispatchBody {
  channel?: string;
  externalContactId?: string;
  body?: string;
}

// timingSafeEqual em vez de ===: o curto-circuito do === vaza o prefixo do
// segredo pelo tempo de resposta. Header repetido chega como array e e recusado:
// entrega legitima do Telegram manda o header uma vez.
function segredoCasa(recebido: string | string[] | undefined): boolean {
  if (!env.telegramWebhookSecret || typeof recebido !== "string") {
    return false;
  }
  const a = Buffer.from(recebido);
  const b = Buffer.from(env.telegramWebhookSecret);
  return a.length === b.length && timingSafeEqual(a, b);
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

  // A credencial muda com o canal porque quem chama muda. O Telegram devolve o
  // secret_token do setWebhook; o canal simulado e chamado pelo navegador do
  // agente, onde segredo nao se guarda, entao vale o JWT que ele ja tem.
  async function credencialAceita(canal: string, request: FastifyRequest): Promise<boolean> {
    if (canal.toUpperCase() === "TELEGRAM") {
      return segredoCasa(request.headers["x-telegram-bot-api-secret-token"]);
    }
    const authorization = request.headers.authorization;
    if (!authorization) {
      return false;
    }
    return agenteAutenticado(authorization);
  }

  server.post<{ Params: { channel: string } }>("/webhooks/:channel", async (request, reply) => {
    // Credencial antes do 404: sem ela o gateway nao conta quais canais existem.
    try {
      if (!(await credencialAceita(request.params.channel, request))) {
        return reply.status(401).send({ error: "credencial_do_webhook_invalida" });
      }
    } catch (erro) {
      if (erro instanceof CoreIndisponivel) {
        request.log.error({ erro: String(erro) }, "nao deu para validar a sessao");
        return reply.status(503).send({ error: "core_indisponivel" });
      }
      throw erro;
    }

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
