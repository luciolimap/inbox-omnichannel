export interface Agent {
  id: number;
  name: string;
  email: string;
  role: "AGENT" | "ADMIN";
}

export interface Session {
  token: string;
  agent: Agent;
}

const CHAVE = "inbox.session";

// Sessao ruim no localStorage nao pode derrubar o provider: antes isto era um
// JSON.parse cru no inicializador do useState, e um valor invalido estourava
// antes do primeiro render, deixando a tela branca sem botao de sair.
export function lerSessao(): Session | null {
  // O try cobre o acesso ao localStorage, nao so o parse: em aba privativa com
  // storage negado o proprio getItem lanca, e isso rodava no inicializador do
  // useState, ou seja, antes do primeiro render.
  try {
    const guardada = localStorage.getItem(CHAVE);
    if (guardada === null) {
      return null;
    }
    const dados = JSON.parse(guardada) as Partial<Session>;
    if (typeof dados.token !== "string" || dados.token === "" || !dados.agent) {
      return null;
    }
    return dados as Session;
  } catch {
    return null;
  }
}

// Nao poder guardar a sessao nao impede de usar o inbox nesta aba: o login
// estourando aqui tirava o usuario de uma tela que ja tinha token valido.
export function guardarSessao(sessao: Session): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    // sessao fica so em memoria; o proximo F5 volta para o login
  }
}

export function limparSessao(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // nada a limpar se o storage nem responde
  }
}
