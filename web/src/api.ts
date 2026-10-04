import { lerSessao } from "./session";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// Semeado da sessao guardada, nao esperando o efeito do provider: no F5 os
// efeitos do Inbox correm antes dos do pai, e as chamadas sairiam sem
// Authorization.
let token: string | null = lerSessao()?.token ?? null;

// Cada chamada guarda o token com que saiu. Um 401 atrasado do token velho
// chegando depois de um login novo nao pode derrubar a sessao nova.
let geracao = 0;

export function setToken(novo: string | null): void {
  token = novo;
  geracao += 1;
}

export const ROTA_DE_LOGIN = "/api/auth/login";

let avisarExpirada: (() => void) | null = null;

// Toda chamada ao core passa por request(), entao o 401 e detectado aqui em vez
// de em cada catch de tela. Quem sabe apagar a sessao e o AuthProvider.
export function aoExpirarSessao(callback: (() => void) | null): void {
  avisarExpirada = callback;
}

// O /ws fecha com 4401 quando o core recusa o token, e isso acontece sem
// nenhuma chamada HTTP: sem este caminho o inbox congelava calado.
export function expirarSessao(): void {
  avisarExpirada?.();
}

// O webhook simulado do gateway exige o mesmo Bearer das chamadas ao core, e o
// token mora aqui. Exportar o header evita uma segunda leitura do localStorage.
export function authHeader(): Record<string, string> {
  return token === null ? {} : { Authorization: `Bearer ${token}` };
}

// O chamador do WebSocket precisa do valor cru, e precisa distinguir deslogado
// de logado: sem token nao vale abrir conexao.
export function tokenAtual(): string | null {
  return token;
}

export class ApiError extends Error {
  // Campo declarado e atribuido no corpo, nao parameter property: o tsconfig do
  // template liga erasableSyntaxOnly, que recusa a forma curta.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const geracaoDaChamada = geracao;
  const resposta = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...authHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Antes de ler o corpo: 401 de proxy vem em HTML, e o JSON.parse estourando
  // aqui deixaria a sessao de pe com um token que o core ja recusa.
  //
  // O 401 de /api/auth/login e a senha errada, nao sessao vencida: avisar
  // expiracao ali trocaria "credenciais invalidas" por "sua sessao expirou".
  if (resposta.status === 401 && path !== ROTA_DE_LOGIN && token !== null
      && geracaoDaChamada === geracao) {
    avisarExpirada?.();
  }

  if (resposta.status === 204) {
    return undefined as T;
  }

  const texto = await resposta.text();
  // Corpo pode nao ser JSON: pagina de erro de proxy, 500 cru do Spring. Antes
  // isso virava SyntaxError e o status real se perdia.
  const dados = corpoJson(texto);

  // 502 e resposta de negocio aqui: a mensagem foi salva mas nao entregue, e o
  // corpo traz a mensagem com deliveryStatus FAILED para a tela mostrar.
  if (!resposta.ok && resposta.status !== 502) {
    throw new ApiError(resposta.status, dados?.message ?? `erro ${resposta.status}`);
  }
  return dados as T;
}

function corpoJson(texto: string): { message?: string } | null {
  if (texto === "") {
    return null;
  }
  try {
    return JSON.parse(texto) as { message?: string };
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
};
