import type { FastifyBaseLogger } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { agenteAutenticado, CoreIndisponivel } from "./core-client.js";

const clientes = new Set<WebSocket>();

// O navegador nao manda header no handshake de WebSocket, e ?token= na URL
// cairia no log de requisicao do gateway. Entao a prova e a primeira mensagem, e
// ate ela chegar o socket nao esta na lista de difusao.
export const PRAZO_DO_TOKEN_MS = 5_000;

// Faixa 4000-4999 e de aplicacao. O cliente reconecta a cada 3s, entao ele
// precisa distinguir "sua credencial nao serve" (nao insista) de queda de
// transporte ou core fora do ar (tente de novo).
export const CODIGO_CREDENCIAL_RECUSADA = 4401;
export const CODIGO_CORE_INDISPONIVEL = 4503;

export function autenticar(socket: WebSocket, log: FastifyBaseLogger): void {
  // Uma validacao por socket, e so enquanto ele estiver vivo. Sem esses dois
  // estados, cada mensagem abriria uma chamada ao core, e uma validacao que
  // voltasse depois do prazo entraria no Set em cima de um socket ja fechado,
  // que nunca mais sai de la.
  let validando = false;
  let encerrado = false;

  const prazo = setTimeout(() => socket.close(), PRAZO_DO_TOKEN_MS);

  socket.on("close", () => {
    encerrado = true;
    clearTimeout(prazo);
    clientes.delete(socket);
  });

  socket.on("message", async (dado: unknown) => {
    if (validando || encerrado || clientes.has(socket)) {
      return;
    }
    const token = tokenDe(dado);
    if (!token) {
      socket.close(CODIGO_CREDENCIAL_RECUSADA);
      return;
    }

    // Handler async: excecao que escape daqui vira unhandled rejection e leva o
    // processo inteiro, nao so a conexao.
    try {
      validando = true;
      const liberado = await agenteAutenticado(`Bearer ${token}`);
      validando = false;

      if (encerrado) {
        return;
      }
      if (!liberado) {
        socket.close(CODIGO_CREDENCIAL_RECUSADA);
        return;
      }
      clearTimeout(prazo);
      clientes.add(socket);
    } catch (erro) {
      validando = false;
      // Core fora do ar fecha o socket em vez de deixar entrar: a alternativa
      // seria difundir conversa para quem nao se provou.
      const indisponivel = erro instanceof CoreIndisponivel;
      log.error({ erro: String(erro) }, "nao deu para validar o socket");
      socket.close(indisponivel ? CODIGO_CORE_INDISPONIVEL : 1011);
    }
  });
}

function tokenDe(dado: unknown): string | null {
  try {
    const corpo = JSON.parse(String(dado)) as { token?: unknown };
    return typeof corpo.token === "string" && corpo.token !== "" ? corpo.token : null;
  } catch {
    return null;
  }
}

// Core fora do ar fecha o socket em vez de deixar entrar: a alternativa seria
// difundir conversa para quem nao se provou. Mas o cliente reconecta a cada 3s,

export function broadcast(evento: unknown): void {
  const payload = JSON.stringify(evento);
  for (const socket of clientes) {
    // readyState 1 e OPEN. Um socket meio fechado derruba o send e levaria o
    // webhook inteiro com ele se nao fosse filtrado aqui.
    if (socket.readyState === 1) {
      socket.send(payload);
    }
  }
}

export function clientCount(): number {
  return clientes.size;
}
