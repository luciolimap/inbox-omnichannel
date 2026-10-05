import { createContext, useContext } from "react";
import type { Agent } from "./session";

export interface AuthValue {
  agent: Agent | null;
  loading: boolean;
  expirada: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthValue | null>(null);

// Fora do auth.tsx porque exportar hook e componente no mesmo modulo desliga o
// fast refresh do arquivo inteiro.
export function useAuth(): AuthValue {
  const valor = useContext(AuthContext);
  if (valor === null) {
    throw new Error("useAuth fora do AuthProvider");
  }
  return valor;
}
