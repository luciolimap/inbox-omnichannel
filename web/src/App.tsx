import { useAuth } from "./auth";
import { Login } from "./pages/Login";

export function App() {
  const { agent } = useAuth();
  if (agent === null) {
    return <Login />;
  }
  return <pre className="p-4">sessao aberta como {agent.email}</pre>;
}
