import { beforeEach, describe, expect, it, vi } from "vitest";

import { guardarSessao, lerSessao } from "../src/session";
import { ApiError, api, setToken, aoExpirarSessao } from "../src/api";

function localStorageFalso(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
    removeItem: (chave: string) => void dados.delete(chave),
    dados,
  };
}

describe("sessao guardada", () => {
  it("sessao corrompida no localStorage devolve null em vez de estourar", () => {
    vi.stubGlobal("localStorage", localStorageFalso({ "inbox.session": "{nao e json" }));

    expect(lerSessao()).toBeNull();
  });

  it("sessao sem token e descartada", () => {
    vi.stubGlobal("localStorage", localStorageFalso({ "inbox.session": '{"agent":{"id":1}}' }));

    expect(lerSessao()).toBeNull();
  });
});

describe("401 do core", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageFalso());
    setToken(null);
    aoExpirarSessao(null);
  });

  it("401 com sessao ativa avisa que expirou", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 401 }));
    setToken("jwt-vencido");
    let avisos = 0;
    aoExpirarSessao(() => { avisos += 1; });

    await expect(api.get("/api/conversations")).rejects.toBeInstanceOf(ApiError);
    expect(avisos).toBe(1);
  });

  it("401 no login nao avisa expiracao", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ message: "credenciais invalidas" }), { status: 401 }));
    let avisos = 0;
    aoExpirarSessao(() => { avisos += 1; });

    await expect(api.post("/api/auth/login", { email: "x", password: "y" }))
      .rejects.toThrow(/credenciais invalidas/);
    expect(avisos).toBe(0);
  });
  it("401 com corpo que nao e JSON ainda derruba a sessao", async () => {
    // nginx e proxy respondem HTML. Se o parse vier antes da checagem do 401, o
    // SyntaxError sobe e a sessao fica de pe com um token que o core recusa.
    vi.stubGlobal("fetch", async () =>
      new Response("<html>504 Gateway Time-out</html>", { status: 401 }));
    setToken("jwt-vencido");
    let avisos = 0;
    aoExpirarSessao(() => { avisos += 1; });

    await expect(api.get("/api/conversations")).rejects.toBeInstanceOf(ApiError);
    expect(avisos).toBe(1);
  });
  it("401 atrasado do token velho nao derruba a sessao nova", async () => {
    // Cenario: token vence, tres chamadas saem juntas, o primeiro 401 derruba a
    // sessao, o usuario reloga, e a resposta atrasada da terceira chega depois.
    let liberar: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", () => new Promise<Response>((r) => { liberar = r; }));
    setToken("jwt-vencido");
    let avisos = 0;
    aoExpirarSessao(() => { avisos += 1; });

    const pendente = api.get("/api/conversations").catch(() => null);
    setToken("jwt-novo-do-relogin");
    liberar(new Response("", { status: 401 }));
    await pendente;

    expect(avisos).toBe(0);
  });
});

describe("sessao de ida e volta", () => {
  it("o que guardarSessao escreve, lerSessao devolve", () => {
    vi.stubGlobal("localStorage", localStorageFalso());
    const sessao = {
      token: "jwt-bom",
      agent: { id: 7, name: "Agente Demo", email: "a@b.c", role: "AGENT" as const },
    };

    guardarSessao(sessao);

    expect(lerSessao()).toEqual(sessao);
  });
});