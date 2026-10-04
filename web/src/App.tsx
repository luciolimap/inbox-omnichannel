import { useAuth } from "./auth";
import { Login } from "./pages/Login";
import { Inbox } from "./pages/Inbox";

export function App() {
  const { agent } = useAuth();
  return agent === null ? <Login /> : <Inbox />;
}
