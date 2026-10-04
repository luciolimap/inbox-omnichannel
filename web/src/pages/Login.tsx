import { useState } from "react";
import { useAuth } from "../auth";
import { ApiError } from "../api";

export function Login() {
  const { login, loading, expirada } = useAuth();
  const [email, setEmail] = useState("agente@smartspace.test");
  const [password, setPassword] = useState("senha123");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    try {
      await login(email, password);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "nao foi possivel entrar");
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-body-tertiary">
      <form className="card shadow-sm p-4" style={{ width: "min(26rem, 92vw)" }} onSubmit={enviar}>
        <h1 className="h4 mb-1">Inbox Omnichannel</h1>
        <p className="text-body-secondary small mb-4">Entre para atender as conversas.</p>

        <div className="mb-3">
          <label className="form-label" htmlFor="email">E-mail</label>
          <input id="email" type="email" className="form-control" required
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="senha">Senha</label>
          <input id="senha" type="password" className="form-control" required
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {expirada && (
          <div className="alert alert-warning py-2 small">Sua sessão expirou. Entre de novo.</div>
        )}
        {erro !== null && <div className="alert alert-danger py-2 small">{erro}</div>}

        <button className="btn btn-primary w-100" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-body-secondary small mt-3 mb-0">
          Demonstração: <code>agente@smartspace.test</code> / <code>senha123</code>
        </p>
      </form>
    </div>
  );
}
