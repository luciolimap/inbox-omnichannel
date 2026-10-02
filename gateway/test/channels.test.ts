import { describe, expect, it } from "vitest";
import { simulatedAdapter } from "../src/channels/simulated.js";

describe("adapter simulado", () => {
  const adapter = simulatedAdapter("WHATSAPP");

  it("traduz payload valido para o contrato interno", () => {
    const resultado = adapter.parseWebhook({
      from: "+5511999999999",
      name: "Cliente",
      text: "oi, preciso de ajuda",
    });

    expect(resultado).toMatchObject({
      channel: "WHATSAPP",
      externalContactId: "+5511999999999",
      contactName: "Cliente",
      body: "oi, preciso de ajuda",
    });
    expect(resultado?.externalMessageId.startsWith("whatsapp:")).toBe(true);
  });

  it("devolve null quando falta remetente ou texto", () => {
    expect(adapter.parseWebhook({ text: "sem remetente" })).toBeNull();
    expect(adapter.parseWebhook({ from: "+551199" })).toBeNull();
    expect(adapter.parseWebhook({ from: "+551199", text: "   " })).toBeNull();
    expect(adapter.parseWebhook(null)).toBeNull();
    expect(adapter.parseWebhook("nao e objeto")).toBeNull();
  });

  it("guarda o que foi enviado para o avaliador conferir", async () => {
    await adapter.send("+5511999999999", "ja estou vendo");
    expect(adapter.outbox).toContainEqual({ to: "+5511999999999", body: "ja estou vendo" });
  });
});
