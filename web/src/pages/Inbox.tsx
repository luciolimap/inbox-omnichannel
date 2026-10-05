import { useCallback, useEffect, useState } from "react";
import { api, authHeader } from "../api";
import { useAuth } from "../auth-context";
import type { Agent } from "../session";
import { useRealtime } from "../realtime";
import { ConversationList, type ConversationSummary } from "../components/ConversationList";
import { MessageThread, type MessageDto } from "../components/MessageThread";
import { Composer } from "../components/Composer";
import { ChannelBadge } from "../components/ChannelBadge";

interface ConversationDetail {
  id: number;
  channel: string;
  status: string;
  contactName: string | null;
  contactExternalId: string;
  assignedAgent: Agent | null;
  messages: MessageDto[];
}

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:3000";

export function Inbox() {
  const { agent, logout } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [filtro, setFiltro] = useState("");

  const carregarLista = useCallback(async () => {
    const query = filtro === "" ? "" : `?status=${filtro}`;
    setConversations(await api.get<ConversationSummary[]>(`/api/conversations${query}`));
  }, [filtro]);

  const carregarDetalhe = useCallback(async (id: number) => {
    setDetail(await api.get<ConversationDetail>(`/api/conversations/${id}`));
  }, []);

  // Busca inicial contra o core e sincronizacao com sistema externo, que e o uso
  // que o texto da propria regra autoriza. Nao ha valor para derivar no render:
  // ele vem da rede.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    // O catch nao e decorativo: com 401 o provider ja derruba a sessao, e sem
    // ele a promise rejeitada vira unhandled rejection no console.
    void api.get<Agent[]>("/api/agents").then(setAgents).catch(() => setAgents([]));
  }, []);

  // Mesma razao da lista: a conversa aberta vem do core, nao do render.
  useEffect(() => {
    if (selectedId !== null) {
      // oxlint-disable-next-line react/set-state-in-effect
      void carregarDetalhe(selectedId);
    }
  }, [selectedId, carregarDetalhe]);

  // Qualquer evento do gateway recarrega lista e conversa aberta. Aplicar o
  // delta no estado seria mais rapido e daria divergencia silenciosa; neste
  // volume o refetch e exato de graca.
  useRealtime(() => {
    void carregarLista();
    if (selectedId !== null) {
      void carregarDetalhe(selectedId);
    }
  });

  async function responder(body: string) {
    if (selectedId === null) return;
    await api.post(`/api/conversations/${selectedId}/messages`, { body });
    await carregarDetalhe(selectedId);
    await carregarLista();
  }

  async function atribuir(agentId: number) {
    if (selectedId === null) return;
    setDetail(await api.patch<ConversationDetail>(
      `/api/conversations/${selectedId}/assign`, { agentId }));
    await carregarLista();
  }

  async function mudarStatus(status: string) {
    if (selectedId === null) return;
    setDetail(await api.patch<ConversationDetail>(
      `/api/conversations/${selectedId}/status`, { status }));
    await carregarLista();
  }

  async function simularMensagem() {
    const texto = window.prompt("Texto da mensagem simulada:", "oi, preciso de ajuda");
    if (texto === null || texto.trim() === "") return;
    const resposta = await fetch(`${GATEWAY_URL}/webhooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ from: "+5511999999999", name: "Cliente Simulado", text: texto }),
    });
    // O webhook passou a exigir credencial, entao ele tem como recusar. Sem isso
    // o botao falharia calado e a mensagem simplesmente nao apareceria.
    if (!resposta.ok) {
      window.alert(resposta.status === 401
        ? "Sessão expirada: entre de novo para simular."
        : `O gateway recusou a simulação (${resposta.status}).`);
      return;
    }
    await carregarLista();
  }

  return (
    <div className="inbox-layout" data-thread-open={selectedId !== null}>
      <aside className="inbox-list bg-body">
        <header className="p-3 border-bottom sticky-top bg-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Inbox</strong>
            <div className="d-flex gap-2 align-items-center">
              <span className="small text-body-secondary d-none d-sm-inline">{agent?.name}</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={logout}>Sair</button>
            </div>
          </div>
          <div className="d-flex gap-2">
            <label className="visually-hidden" htmlFor="status">Filtrar por status</label>
            <select id="status" className="form-select form-select-sm"
                    value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todas</option>
              <option value="OPEN">Abertas</option>
              <option value="PENDING">Pendentes</option>
              <option value="RESOLVED">Resolvidas</option>
            </select>
            <button className="btn btn-sm btn-outline-primary text-nowrap" onClick={simularMensagem}>
              <i className="bi bi-plus-lg" aria-hidden="true" /> Simular
            </button>
          </div>
        </header>
        <ConversationList conversations={conversations} selectedId={selectedId}
                          onSelect={setSelectedId} />
      </aside>

      <section className="inbox-thread bg-body-tertiary">
        {detail === null ? (
          <div className="d-flex align-items-center justify-content-center h-100 text-body-secondary p-4 text-center">
            Escolha uma conversa à esquerda.
          </div>
        ) : (
          <>
            <header className="p-3 border-bottom bg-body d-flex flex-wrap gap-2 align-items-center">
              <button className="btn btn-sm btn-outline-secondary d-md-none"
                      onClick={() => setSelectedId(null)} aria-label="Voltar para a lista">
                <i className="bi bi-arrow-left" aria-hidden="true" />
              </button>
              <div className="me-auto">
                <strong className="d-block">{detail.contactName ?? detail.contactExternalId}</strong>
                <ChannelBadge channel={detail.channel} />
              </div>
              <label className="visually-hidden" htmlFor="agente">Agente responsável</label>
              <select id="agente" className="form-select form-select-sm w-auto"
                      value={detail.assignedAgent?.id ?? ""}
                      onChange={(e) => void atribuir(Number(e.target.value))}>
                <option value="" disabled>Atribuir a...</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {detail.status === "RESOLVED" ? (
                <button className="btn btn-sm btn-outline-primary"
                        onClick={() => void mudarStatus("OPEN")}>Reabrir</button>
              ) : (
                <button className="btn btn-sm btn-success"
                        onClick={() => void mudarStatus("RESOLVED")}>Resolver</button>
              )}
            </header>

            <MessageThread messages={detail.messages} />
            <Composer disabled={detail.status === "RESOLVED"} onSend={responder} />
          </>
        )}
      </section>
    </div>
  );
}
