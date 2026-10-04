# auth-no-webhook

## Intenção

Hoje `POST /webhooks/:channel` no gateway não tem autenticação nenhuma: quem
alcança a porta 3000 injeta mensagem de cliente e cria contato e conversa no
inbox. A borda passa a exigir credencial, e a credencial é diferente por canal
porque quem chama é diferente:

- **Telegram** é chamado pelo próprio Telegram, que reenvia o header
  `X-Telegram-Bot-Api-Secret-Token` quando o `setWebhook` foi registrado com
  `secret_token`. O gateway compara com `TELEGRAM_WEBHOOK_SECRET`.
- **WHATSAPP e EMAIL** são simulados e quem chama é o botão **Simular**, que roda
  no navegador do agente. Segredo em código de front não é segredo, então a
  credencial é o JWT que o agente já tem da sessão. O gateway valida esse Bearer
  contra o core, que é quem sabe assinar e conferir token.

## Critério de aceite

### 1. Telegram sem o header secreto é recusado

```
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/webhooks/telegram \
  -H 'Content-Type: application/json' -d '{"update_id":1}'
```

Esperado: `401`.

### 2. Telegram com o header secreto passa

```
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/webhooks/telegram \
  -H 'Content-Type: application/json' \
  -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"update_id":1}'
```

Esperado: `200`.

### 3. Canal simulado sem Bearer é recusado

```
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/webhooks/whatsapp \
  -H 'Content-Type: application/json' -d '{"from":"chat-1","text":"oi"}'
```

Esperado: `401`.

### 4. Canal simulado com Bearer de agente passa

```
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"agente@smartspace.test","password":"senha123"}' | jq -r .token)
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/webhooks/whatsapp \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"from":"chat-1","text":"oi"}'
```

Esperado: `200`.

### 5. A suíte do gateway cobre as duas recusas

```
cd gateway && npm test
```

Esperado: `Tests 16 passed (16)` — os 12 atuais mais um por critério de 1 a 4.

## Fora de escopo

- Autenticação no `GET /ws`. A difusão continua aberta a quem alcança a porta;
  fechá-la exige passar o JWT na handshake do WebSocket e é trabalho separado.
- `GET /simulated/outbox` e `GET /channels`, que continuam abertos.
- Rodar o `setWebhook` com `secret_token` no Telegram real: depende do bot do
  `@BotFather`, que é pendência manual.
- Rate limit e replay protection. O header secreto prova origem, não frequência.
