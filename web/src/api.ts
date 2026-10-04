const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

let token: string | null = null;

export function setToken(novo: string | null): void {
  token = novo;
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
  const resposta = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...authHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (resposta.status === 204) {
    return undefined as T;
  }

  const texto = await resposta.text();
  const dados = texto === "" ? null : JSON.parse(texto);

  // 502 e resposta de negocio aqui: a mensagem foi salva mas nao entregue, e o
  // corpo traz a mensagem com deliveryStatus FAILED para a tela mostrar.
  if (!resposta.ok && resposta.status !== 502) {
    throw new ApiError(resposta.status, dados?.message ?? `erro ${resposta.status}`);
  }
  return dados as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
};
