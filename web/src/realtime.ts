import { useEffect, useRef } from "react";
import { expirarSessao, tokenAtual } from "./api";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000/ws";

// Espelha CODIGO_CREDENCIAL_RECUSADA do gateway.
const CODIGO_CREDENCIAL_RECUSADA = 4401;

// Uma acao do agente gera mais de um evento: a mensagem persistida e a
// confirmacao de entrega chegam separadas. Sem agrupar, cada uma recarrega a
// lista e a conversa aberta, por aba. 100ms ainda parece instantaneo.
export const JANELA_DE_AGRUPAMENTO_MS = 100;

// Teto de espera: evento a cada 50ms reinicia a janela para sempre, e sem teto a
// lista congelaria pela rajada inteira. Dois agentes trabalhando juntos ou
// reentrega de webhook do Telegram sustentam essa taxa.
export const TETO_DE_ESPERA_MS = 500;

export function agrupar(acao: () => void, janelaMs = JANELA_DE_AGRUPAMENTO_MS,
                        tetoMs = TETO_DE_ESPERA_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let primeiroSuprimido: number | undefined;

  const rodar = () => {
    clearTimeout(timer);
    timer = undefined;
    primeiroSuprimido = undefined;
    acao();
  };

  const disparar = () => {
    primeiroSuprimido ??= Date.now();
    if (Date.now() - primeiroSuprimido >= tetoMs) {
      rodar();
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(rodar, janelaMs);
  };

  disparar.cancelar = () => {
    clearTimeout(timer);
    timer = undefined;
    primeiroSuprimido = undefined;
  };

  return disparar;
}

export function useRealtime(onEvent: () => void): void {
  const callback = useRef(onEvent);
  callback.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let ativo = true;
    const recarregar = agrupar(() => callback.current());

    function conectar() {
      const token = tokenAtual();
      // Sem token o gateway fecharia o socket e o onclose reconectaria a cada
      // 3s para sempre.
      if (token === null) {
        return;
      }
      socket = new WebSocket(WS_URL);
      socket.onopen = () => socket?.send(JSON.stringify({ token }));
      socket.onmessage = () => recarregar();
      // Reconexao fixa em 3s de proposito: backoff exponencial so paga quando o
      // servidor cai por minutos, e aqui os dois sobem no mesmo compose.
      //
      // 4401 e credencial recusada e nao melhora com tentativa: insistir seria
      // uma validacao de JWT no core a cada 3s, por aba, para sempre.
      socket.onclose = (evento) => {
        if (evento.code === CODIGO_CREDENCIAL_RECUSADA) {
          expirarSessao();
          return;
        }
        if (ativo) {
          timer = window.setTimeout(conectar, 3000);
        }
      };
    }

    conectar();

    return () => {
      ativo = false;
      window.clearTimeout(timer);
      recarregar.cancelar();
      socket?.close();
    };
  }, []);
}
