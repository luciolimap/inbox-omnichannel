import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { aoExpirarSessao, api, ROTA_DE_LOGIN, setToken } from "./api";
import {
  guardarSessao, lerSessao, limparSessao, type Agent, type Session,
} from "./session";

interface AuthValue {
  agent: Agent | null;
  loading: boolean;
  expirada: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(lerSessao);
  const [loading, setLoading] = useState(false);
  const [expirada, setExpirada] = useState(false);

  // O api.ts guarda o token em modulo, nao em estado do React. Este efeito e o
  // que mantem os dois em sincronia inclusive no recarregamento da pagina.
  useEffect(() => {
    setToken(session?.token ?? null);
  }, [session]);

  // O api.ts detecta o 401 mas nao sabe apagar sessao; quem sabe e este
  // provider. Sem isto, token vencido deixava o inbox vazio e sem saida.
  useEffect(() => {
    aoExpirarSessao(() => {
      limparSessao();
      setSession(null);
      setExpirada(true);
    });
    return () => aoExpirarSessao(null);
  }, []);

  const value = useMemo<AuthValue>(() => ({
    agent: session?.agent ?? null,
    loading,
    expirada,
    async login(email, password) {
      setLoading(true);
      setExpirada(false);
      try {
        const nova = await api.post<Session>(ROTA_DE_LOGIN, { email, password });
        guardarSessao(nova);
        setSession(nova);
      } finally {
        setLoading(false);
      }
    },
    logout() {
      limparSessao();
      setSession(null);
      setExpirada(false);
    },
  }), [session, loading, expirada]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const valor = useContext(AuthContext);
  if (valor === null) {
    throw new Error("useAuth fora do AuthProvider");
  }
  return valor;
}
