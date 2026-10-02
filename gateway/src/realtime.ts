import type { WebSocket } from "@fastify/websocket";

const clientes = new Set<WebSocket>();

export function addClient(socket: WebSocket): void {
  clientes.add(socket);
  socket.on("close", () => clientes.delete(socket));
}

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
