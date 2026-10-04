import { env } from "./env.js";
import type { InboundMessage } from "./channels/types.js";

export interface CoreMessage {
  id: number;
  direction: string;
  body: string;
  deliveryStatus: string;
  createdAt?: string;
}

export async function ingest(message: InboundMessage): Promise<CoreMessage> {
  const resposta = await fetch(`${env.coreUrl}/internal/inbound`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": env.internalToken,
    },
    body: JSON.stringify(message),
  });

  if (!resposta.ok) {
    throw new Error(`core respondeu ${resposta.status}: ${await resposta.text()}`);
  }
  return (await resposta.json()) as CoreMessage;
}

export class CoreIndisponivel extends Error {}

// O gateway nao sabe conferir assinatura de JWT, e nem deve: quem assina e o
// core. Uma rota autenticada qualquer serve de veredito, e /api/agents e a mais
// barata que existe.
//
// Core fora do ar nao e credencial ruim. Devolver false nos dois casos faria o
// webhook responder 401, e 4xx ensina o canal a desistir em vez de reentregar a
// mensagem quando o core voltar.
export async function agenteAutenticado(authorization: string): Promise<boolean> {
  let resposta: Response;
  try {
    resposta = await fetch(`${env.coreUrl}/api/agents`, {
      headers: { Authorization: authorization },
    });
  } catch (erro) {
    throw new CoreIndisponivel(`core inacessivel: ${String(erro)}`);
  }
  if (resposta.status === 401 || resposta.status === 403) {
    return false;
  }
  if (!resposta.ok) {
    throw new CoreIndisponivel(`core respondeu ${resposta.status} ao validar a sessao`);
  }
  return true;
}
