# auth-no-websocket

## Intenção

`GET /ws` aceita qualquer conexão e transmite todo evento de inbound e de
outbound para ela. Quem alcança a porta 3000 lê as conversas dos clientes em
tempo real sem nunca ter feito login.

A conexão passa a só receber evento depois de provar quem é. O navegador não
manda header customizado no handshake de WebSocket, e `?token=` na URL cairia no
log de requisição do gateway, que roda com `logger: true`. Então a prova é a
**primeira mensagem** do cliente: `{"token":"<jwt>"}`, validada no core como já
acontece no webhook simulado. Enquanto não chega token válido, o socket não entra
na lista de difusão; se não chegar em 5 segundos, o gateway fecha.

## Critério de aceite

### 1. Socket sem token não recebe difusão

```
cd gateway && npm test
```

Esperado: `Tests 28 passed (28)` — os 19 de antes mais nove: socket sem token
fica fora da difusão; socket com token válido entra; token recusado pelo core
fecha a conexão; silêncio por 5s fecha a conexão; validação que volta depois do
prazo não entra na difusão; mensagem repetida não abre uma validação por
mensagem; core fora do ar fecha e registra o erro; credencial recusada fecha com
4401; core indisponível fecha com código que permite reconectar.

### 2. Difusão continua chegando ao agente logado

Com os quatro serviços de pé, abrir <http://localhost:8081>, entrar como
`agente@smartspace.test` / `senha123` e clicar em **Simular**.

Esperado: a conversa nova aparece na lista sem recarregar a página, como antes.

### 3. Conexão anônima é fechada

```
npx --yes wscat -c ws://localhost:3000/ws
```

Esperado: a conexão fecha sozinha em 5 segundos, sem nenhum evento recebido.

## Fora de escopo

- Reautenticar o socket quando o JWT vence no meio da conexão. O token é
  conferido na entrada; sessão que vence durante a conexão continua recebendo até
  reconectar.
- Autorização por papel na difusão. Todo agente autenticado vê todas as
  conversas, que é o comportamento atual do inbox.
- `GET /simulated/outbox` e `GET /channels`, que seguem abertos.
- Limite de conexões não autenticadas por IP. Quem alcança a porta 3000 ainda
  abre N sockets, manda um frame em cada e provoca N validações de JWT no core,
  repetindo a cada 5 segundos. O `maxPayload` de 4 KiB limita o tamanho do frame
  lido antes da prova, não a quantidade de tentativas; rate limit é trabalho
  separado.
