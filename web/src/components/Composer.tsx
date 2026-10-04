import { useState } from "react";

interface Props {
  disabled: boolean;
  onSend: (body: string) => Promise<void>;
}

export function Composer({ disabled, onSend }: Props) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (texto.trim() === "") return;
    setEnviando(true);
    try {
      await onSend(texto);
      setTexto("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="border-top p-3 d-flex gap-2" onSubmit={enviar}>
      <label className="visually-hidden" htmlFor="resposta">Resposta</label>
      <input
        id="resposta"
        className="form-control"
        placeholder={disabled ? "Conversa resolvida" : "Escreva a resposta..."}
        maxLength={4096}
        disabled={disabled || enviando}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button className="btn btn-primary" type="submit" disabled={disabled || enviando}>
        <i className="bi bi-send" aria-hidden="true" />
        <span className="visually-hidden">Enviar</span>
      </button>
    </form>
  );
}
