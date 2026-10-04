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
};
