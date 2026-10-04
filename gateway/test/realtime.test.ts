import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.INTERNAL_TOKEN = "token-de-teste";
process.env.CORE_URL = "http://core.invalido";

const { autenticar, broadcast, clientCount, CODIGO_CREDENCIAL_RECUSADA, PRAZO_DO_TOKEN_MS } =
  await import("../src/realtime.js");

const logSilencioso = { error: () => {} } as never;

// Dubla so o que o broadcast usa: readyState, send e os handlers de evento.
function socketFalso() {
  const enviados: string[] = [];
  const handlers = new Map<string, (dado?: unknown) => void>();
  return {
    readyState: 1,
    enviados,
    fechado: false,
    send(payload: string) {
      enviados.push(payload);
    },
    codigo: 0,
    close(codigo = 1000) {
      this.fechado = true;
      this.codigo = codigo;
      handlers.get("close")?.();
    },
    on(evento: string, handler: (dado?: unknown) => void) {
      handlers.set(evento, handler);
    },
    dispara(evento: string, dado?: unknown) {
      handlers.get(evento)?.(dado);
    },
  };
}

describe("difusao autenticada", () => {
  // O Set de clientes vive no modulo: socket que fica aberto vaza para o teste
  // seguinte e falseia o clientCount.
  let abertos: ReturnType<typeof socketFalso>[];

  beforeEach(() => {
    abertos = [];
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => new Response("[]", { status: 200 }));
  });

  afterEach(() => {
    for (const socket of abertos) {
      if (!socket.fechado) socket.close();
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function novoSocket() {
    const socket = socketFalso();
    abertos.push(socket);
    autenticar(socket as never, logSilencioso);
    return socket;
  }

  it("socket sem token nao recebe difusao", () => {
    const socket = novoSocket();

    broadcast({ tipo: "inbound" });

    expect(socket.enviados).toEqual([]);
    expect(clientCount()).toBe(0);
  });

  it("socket com token aceito entra na difusao", async () => {
    const socket = novoSocket();

    socket.dispara("message", JSON.stringify({ token: "jwt-de-agente" }));
    await vi.waitFor(() => expect(clientCount()).toBe(1));

    broadcast({ tipo: "inbound" });
    expect(socket.enviados).toEqual([JSON.stringify({ tipo: "inbound" })]);
  });

  it("token que o core recusa fecha a conexao", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 401 }));
    const socket = novoSocket();

    socket.dispara("message", JSON.stringify({ token: "jwt-vencido" }));
    await vi.waitFor(() => expect(socket.fechado).toBe(true));

    expect(clientCount()).toBe(0);
  });

  it("silencio ate o prazo fecha a conexao", () => {
    const socket = novoSocket();

    vi.advanceTimersByTime(PRAZO_DO_TOKEN_MS + 1);

    expect(socket.fechado).toBe(true);
    expect(clientCount()).toBe(0);
  });
  it("validacao que volta depois do prazo nao entra na difusao", async () => {
    let liberar: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", () => new Promise<Response>((r) => { liberar = r; }));
    const socket = novoSocket();

    socket.dispara("message", JSON.stringify({ token: "jwt-lento" }));
    vi.advanceTimersByTime(PRAZO_DO_TOKEN_MS + 1);
    expect(socket.fechado).toBe(true);

    // O core responde depois que o prazo ja fechou o socket. Sem a checagem de
    // estado, o add entra em cima de um socket morto e o Set nunca o solta.
    liberar(new Response("[]", { status: 200 }));
    // advanceTimersByTimeAsync drena as microtasks: sem isso a assercao roda
    // antes do .then do fetch e passa por acidente.
    await vi.advanceTimersByTimeAsync(1);
    expect(clientCount()).toBe(0);
  });

  it("mensagem repetida nao abre uma validacao por mensagem", async () => {
    let chamadas = 0;
    vi.stubGlobal("fetch", async () => {
      chamadas += 1;
      return new Response("[]", { status: 200 });
    });
    const socket = novoSocket();

    const payload = JSON.stringify({ token: "jwt-de-agente" });
    socket.dispara("message", payload);
    socket.dispara("message", payload);
    socket.dispara("message", payload);
    await vi.waitFor(() => expect(clientCount()).toBe(1));

    expect(chamadas).toBe(1);
  });
  it("core fora do ar fecha o socket e registra o erro", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    const erros: unknown[] = [];
    const socket = socketFalso();
    abertos.push(socket);
    autenticar(socket as never, { error: (dado: unknown) => erros.push(dado) } as never);

    socket.dispara("message", JSON.stringify({ token: "jwt-de-agente" }));
    await vi.waitFor(() => expect(socket.fechado).toBe(true));

    expect(clientCount()).toBe(0);
    expect(erros).toHaveLength(1);
  });
  it("credencial recusada fecha com 4401 para o cliente nao reconectar", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 401 }));
    const socket = novoSocket();

    socket.dispara("message", JSON.stringify({ token: "jwt-vencido" }));
    await vi.waitFor(() => expect(socket.fechado).toBe(true));

    expect(socket.codigo).toBe(CODIGO_CREDENCIAL_RECUSADA);
  });

  it("core fora do ar fecha com codigo diferente, que permite reconectar", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    const socket = socketFalso();
    abertos.push(socket);
    autenticar(socket as never, { error: () => {} } as never);

    socket.dispara("message", JSON.stringify({ token: "jwt-de-agente" }));
    await vi.waitFor(() => expect(socket.fechado).toBe(true));

    expect(socket.codigo).not.toBe(CODIGO_CREDENCIAL_RECUSADA);
  });
});
