import { ChannelBadge } from "./ChannelBadge";
import { StatusBadge } from "./StatusBadge";

export interface ConversationSummary {
  id: number;
  channel: string;
  status: string;
  contactName: string | null;
  contactExternalId: string;
  assignedAgent: { id: number; name: string } | null;
  lastMessagePreview: string;
  lastMessageAt: string;
}

interface Props {
  conversations: ConversationSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-body-secondary">
        <i className="bi bi-inbox fs-1 d-block mb-2" aria-hidden="true" />
        <p className="mb-1">Nenhuma conversa ainda.</p>
        <p className="small mb-0">
          Mande mensagem ao bot do Telegram, ou simule um canal com o botão acima.
        </p>
      </div>
    );
  }

  return (
    <ul className="list-group list-group-flush">
      {conversations.map((conversa) => (
        <li key={conversa.id}>
          <button
            type="button"
            onClick={() => onSelect(conversa.id)}
            aria-current={conversa.id === selectedId}
            className={`list-group-item list-group-item-action text-start w-100 py-3 ${
              conversa.id === selectedId ? "active" : ""
            }`}
          >
            <div className="d-flex justify-content-between align-items-start gap-2">
              <strong className="text-truncate">
                {conversa.contactName ?? conversa.contactExternalId}
              </strong>
              <small className="text-nowrap opacity-75">
                {new Date(conversa.lastMessageAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <div className="text-truncate small opacity-75">{conversa.lastMessagePreview}</div>
            <div className="d-flex gap-1 mt-2 flex-wrap">
              <ChannelBadge channel={conversa.channel} />
              <StatusBadge status={conversa.status} />
              {conversa.assignedAgent !== null && (
                <span className="badge text-bg-light">{conversa.assignedAgent.name}</span>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
