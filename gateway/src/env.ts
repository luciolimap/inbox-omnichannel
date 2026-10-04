function required(name: string): string {
  const valor = process.env[name];
  if (!valor) {
    throw new Error(`env ${name} obrigatoria`);
  }
  return valor;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  coreUrl: process.env.CORE_URL ?? "http://localhost:8080",
  internalToken: required("INTERNAL_TOKEN"),
  // Vazio desliga so o canal Telegram. Quem avalia o projeto sem criar bot ainda
  // usa o inbox inteiro pelos canais simulados.
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  // Registrado no setWebhook como secret_token; o Telegram devolve o valor no
  // header X-Telegram-Bot-Api-Secret-Token a cada entrega.
  telegramWebhookSecret: telegramWebhookSecret(),
};

// Bot sem segredo seria o pior dos dois mundos: o canal sobe, o send funciona, e
// todo update inbound leva 401 do webhook. Como 4xx faz o Telegram reentregar, o
// canal ficaria em laco sem nada no boot dizendo por que. Ou os dois, ou nenhum.
function telegramWebhookSecret(): string {
  const segredo = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (process.env.TELEGRAM_BOT_TOKEN && !segredo) {
    throw new Error(
      "env TELEGRAM_WEBHOOK_SECRET obrigatoria quando TELEGRAM_BOT_TOKEN esta definida: "
        + "registre o mesmo valor no setWebhook como secret_token",
    );
  }
  return segredo;
}
