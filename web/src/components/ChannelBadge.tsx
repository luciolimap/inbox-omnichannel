const ESTILO: Record<string, { rotulo: string; classe: string; icone: string }> = {
  TELEGRAM: { rotulo: "Telegram", classe: "text-bg-info", icone: "bi-telegram" },
  WHATSAPP: { rotulo: "WhatsApp", classe: "text-bg-success", icone: "bi-whatsapp" },
  EMAIL: { rotulo: "E-mail", classe: "text-bg-secondary", icone: "bi-envelope" },
};

export function ChannelBadge({ channel }: { channel: string }) {
  const estilo = ESTILO[channel] ?? { rotulo: channel, classe: "text-bg-light", icone: "bi-chat" };
  return (
    <span className={`badge ${estilo.classe}`}>
      <i className={`bi ${estilo.icone} me-1`} aria-hidden="true" />
      {estilo.rotulo}
    </span>
  );
}
