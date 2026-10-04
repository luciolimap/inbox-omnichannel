import { useEffect, useRef } from "react";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000/ws";

export function useRealtime(onEvent: () => void): void {
  const callback = useRef(onEvent);
  callback.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let ativo = true;

    function conectar() {
      socket = new WebSocket(WS_URL);
      socket.onmessage = () => callback.current();
      // Reconexao fixa em 3s de proposito: backoff exponencial so paga quando o
      // servidor cai por minutos, e aqui os dois sobem no mesmo compose.
      socket.onclose = () => {
        if (ativo) {
          timer = window.setTimeout(conectar, 3000);
        }
      };
    }

    conectar();

    return () => {
      ativo = false;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, []);
}
