import { useEffect, useRef } from "react";

export interface MessageDto {
  id: number;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  deliveryStatus: "PENDING" | "SENT" | "FAILED";
  sentByAgent: { id: number; name: string } | null;
  createdAt: string;
}

export function MessageThread({ messages }: { messages: MessageDto[] }) {
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="inbox-messages p-3 d-flex flex-column gap-2">
      {messages.map((mensagem) => {
        const minha = mensagem.direction === "OUTBOUND";
        return (
          <div key={mensagem.id} className={`d-flex ${minha ? "justify-content-end" : ""}`}>
            <div
              className={`message-bubble rounded-3 px-3 py-2 ${
                minha ? "bg-primary text-white" : "bg-body-secondary"
              }`}
            >
              <div>{mensagem.body}</div>
              <div className="small mt-1 d-flex gap-2 align-items-center opacity-75">
                <span>
                  {new Date(mensagem.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {mensagem.sentByAgent !== null && <span>{mensagem.sentByAgent.name}</span>}
                {/* FAILED precisa aparecer: a mensagem esta salva no banco mas o
                    canal nao a recebeu, e so a tela pode contar isso ao agente. */}
                {mensagem.deliveryStatus === "FAILED" && (
                  <span className="badge text-bg-danger">não entregue</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={fim} />
    </div>
  );
}
