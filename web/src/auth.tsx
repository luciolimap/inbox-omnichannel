import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setToken } from "./api";

export interface Agent {
  id: number;
  name: string;
  email: string;
  role: "AGENT" | "ADMIN";
}

interface Session {
  token: string;
  agent: Agent;
}

interface AuthValue {
  agent: Agent | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const CHAVE = "inbox.session";
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const guardada = localStorage.getItem(CHAVE);
    return guardada === null ? null : (JSON.parse(guardada) as Session);
  });
  const [loading, setLoading] = useState(false);

  // O api.ts guarda o token em modulo, nao em estado do React. Este efeito e o
  // que mantem os dois em sincronia inclusive no recarregamento da pagina.
  useEffect(() => {
    setToken(session?.token ?? null);
  }, [session]);

  const value = useMemo<AuthValue>(() => ({
    agent: session?.agent ?? null,
    loading,
    async login(email, password) {
      setLoading(true);
      try {
        const nova = await api.post<Session>("/api/auth/login", { email, password });
        localStorage.setItem(CHAVE, JSON.stringify(nova));
        setSession(nova);
      } finally {
        setLoading(false);
      }
    },
    logout() {
      localStorage.removeItem(CHAVE);
      setSession(null);
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const valor = useContext(AuthContext);
  if (valor === null) {
    throw new Error("useAuth fora do AuthProvider");
  }
  return valor;
}
