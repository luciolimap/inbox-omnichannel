export type Channel = "TELEGRAM" | "WHATSAPP" | "EMAIL";

export interface InboundMessage {
  channel: Channel;
  externalContactId: string;
  contactName: string | null;
  externalMessageId: string;
  body: string;
}

export interface ChannelAdapter {
  channel: Channel;

  /** Devolve null quando o payload nao carrega mensagem de texto utilizavel. */
  parseWebhook(payload: unknown): InboundMessage | null;

  send(externalContactId: string, body: string): Promise<void>;

  /** So os canais simulados preenchem: e onde o avaliador ve a resposta "entregue". */
  outbox?: Array<{ to: string; body: string }>;
}
