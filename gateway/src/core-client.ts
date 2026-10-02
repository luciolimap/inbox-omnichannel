import { env } from "./env.js";
import type { InboundMessage } from "./channels/types.js";

export interface CoreMessage {
  id: number;
  direction: string;
  body: string;
  deliveryStatus: string;
  createdAt?: string;
}

export async function ingest(message: InboundMessage): Promise<CoreMessage> {
  const resposta = await fetch(`${env.coreUrl}/internal/inbound`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": env.internalToken,
    },
    body: JSON.stringify(message),
  });

  if (!resposta.ok) {
    throw new Error(`core respondeu ${resposta.status}: ${await resposta.text()}`);
  }
  return (await resposta.json()) as CoreMessage;
}
