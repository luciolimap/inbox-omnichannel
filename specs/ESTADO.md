# Estado em 04/10/2026 (fim da sessão)

Vaga fecha em 08/10/2026. Restam 4 dias, e o dia 08 é margem: a entrega é um link
que alguém abre, então o trabalho real cabe em 05, 06 e 07.

## Retomar aqui

**Decidido em 04/10: o filtro por status fica como está, não mexer agora.** Ele está
entregue e funciona; só não casa com o "Fora de escopo" da spec. Resolver isso não
move nenhum critério de aceite, e os três que faltam movem.

Ordem combinada para os próximos dias:

1. **05/10 — caminho crítico, depende do Lucio.** Gravar `docs/inbox.gif` (Telegram
   ponta a ponta, celular visível, critério 4) e `docs/mobile.png` (375px sem scroll
   horizontal, critério 7). O `README.md` já referencia os dois arquivos, então hoje a
   capa do projeto abre com dois links quebrados — é a primeira coisa que o avaliador vê.
   O `setWebhook` agora precisa de `secret_token`; o comando completo está no item 1 de
   "Pendente para retomar".
2. **06/10 — uma tarefa, um Pull Request.** É o único jeito de mexer no critério 9, que
   pede cinco PRs e tem um. Candidatos, nesta ordem: N+1 do `ConversationService.list`
   com a recarga por evento, depois os quatro warnings do `oxlint`.
3. **07/10 — polimento de entrega.** Reler o `README` inteiro como avaliador, tornar o
   repositório público (o badge do CI só renderiza para quem tem acesso), conferir o
   badge verde, e rodar `docker compose up -d` num clone limpo para provar que sobe do
   zero.

## Pronto

- `specs/2026-10-01-inbox-omnichannel.md` — spec com nove critérios de aceite rodáveis.
- `specs/2026-10-01-inbox-omnichannel.plano.md` — plano de 12 tarefas, código real em cada passo.
- Task 1 parcial: `.gitignore`, `.env.example`, `.env`, `docker-compose.yml` (só o serviço `postgres`), `git init -b main`.
- Task 2 Steps 1 e 2: `core/` do Spring Initializr, parent fixado em Spring Boot **3.5.16**,
  starters corrigidos, jjwt e Testcontainers acrescentados. `./mvnw -B -q compile` → exit 0.
- Commit `767ea71` como `Lucio Lima <luciolimap@gmail.com>`.
- **Task 1 fechada.** Docker Desktop 29.8.1 e Compose v5.5.1 instalados.
  `docker compose ps --format '{{.Service}} {{.State}} {{.Health}}'` → `postgres running healthy`.
- **Task 2 fechada.** `application.yml`, `V1__schema.sql`, cinco enums, `Agent`, `Contact`,
  `Conversation`, `Message`, quatro repositórios, `PostgresIT` e `ConversationRepositoryIT`.
  `./mvnw -B -q test -Dtest=ConversationRepositoryIT` → exit 0, dois testes.
  Commit `3348b95` na branch `feat/core-dominio`.

- **Task 3 fechada.** `JwtService`, `JwtAuthFilter`, `SecurityConfig`, `AuthController`,
  `AgentController`, `ApiExceptionHandler`, `DataInitializer` com os dois agentes semeados.
  `./mvnw -B test` → `Tests run: 9, Failures: 0`, `BUILD SUCCESS`.

- **Task 4 fechada.** `MessageDto`, `ConversationSummary`, `ConversationDetail`,
  `ConversationService` e `ConversationController` com `GET /api/conversations` e o detalhe.
  `./mvnw -B test` → `Tests run: 13, Failures: 0`, `BUILD SUCCESS`.

- **Task 5 fechada.** `InboundRequest`, `InternalTokenFilter`, `InboundController` e
  `ConversationService.ingest` idempotente por `externalMessageId`.
  `./mvnw -B test` → `Tests run: 19, Failures: 0`, `BUILD SUCCESS`.

- **Task 6 fechada.** `GatewayClient`, `ReplyRequest`, `AssignRequest`, `StatusRequest`,
  `ReplyPrepared`, as rotas `POST /{id}/messages`, `PATCH /{id}/assign`, `PATCH /{id}/status`,
  e `ConversationServiceTest` sem banco. `./mvnw -B test` → `Tests run: 27, Failures: 0`.
  O core está completo; falta o gateway Node e o front.

- **Task 7 fechada.** `gateway/` em Fastify: `env.ts`, `channels/{types,simulated,registry}.ts`,
  `core-client.ts`, `realtime.ts`, `server.ts` e `main.ts`.
  `npm test` → `Tests 8 passed (8)`; `npm run lint` (`tsc --noEmit`) → exit 0.

- **Task 8 fechada no código.** `channels/telegram.ts`, registro condicional ao
  `TELEGRAM_BOT_TOKEN` e `GET /channels`. `npm test` → `Tests 12 passed (12)`; lint exit 0.

- **Task 9 fechada.** `web/` em Vite + React + TypeScript com Bootstrap 5: `api.ts`, `auth.tsx`,
  `pages/Login.tsx`, `styles.css`, `App.tsx`, `main.tsx`. `npm run build` → `built in 807ms`.
  Login provado contra o core de pé, com `Origin: http://localhost:5173`:
  `HTTP/1.1 200`, `Access-Control-Allow-Origin: http://localhost:5173`, `"role":"AGENT"`.

- **Task 10 fechada.** `realtime.ts`, `pages/Inbox.tsx` e os cinco componentes
  (`ConversationList`, `MessageThread`, `Composer`, `ChannelBadge`, `StatusBadge`).
  `npm run lint` → exit 0; `npm run build` → `built in 929ms`. Commit `45b8aee`.
  No mesmo commit, o `GatewayClient` passou a fixar `HTTP/1.1`: no padrão `HTTP_2` o
  cliente tenta upgrade h2c, que o Fastify não fala, e o POST chegava com o corpo
  descasado do `Content-Length` (`FST_ERR_CTP_INVALID_CONTENT_LENGTH`).

- **Task 11 fechada.** `core/Dockerfile`, `gateway/Dockerfile`, `web/Dockerfile`,
  `web/nginx.conf`, `docker-compose.yml` com os quatro serviços e `.github/workflows/ci.yml`.
  `docker compose up -d --build` → `postgres core gateway web` todos `running`.
  Volta completa provada pelos containers: webhook simulado, conversa criada,
  resposta com `deliveryStatus: SENT`, mensagem no `/simulated/outbox` do gateway.
  Commit `3768b3d`.

- **CI migrado para GitHub Actions.** `.gitlab-ci.yml` apagado, `.github/workflows/ci.yml`
  com os mesmos cinco jobs. O runner `ubuntu-latest` já tem Docker, então o serviço
  `docker:dind` e as variáveis `DOCKER_HOST` e `TESTCONTAINERS_HOST_OVERRIDE` saíram.
  Repositório privado em <https://github.com/luciolimap/inbox-omnichannel>, PR #1
  mergeado em `main` com `--merge` (não squash: o critério 9 quer os Conventional
  Commits visíveis). `main` em `efe7268`, pipeline verde nos cinco jobs.
  **Critério de aceite 8 fechado:** badge do workflow no topo do `README.md`,
  apontando para a query de `main`. A URL de um run específico entrou e saiu no
  mesmo dia — ela congela e mente no commit seguinte; o badge acompanha `main`.
  O badge só renderiza para quem tem acesso: o repo é privado até a candidatura.

- **Revisão de fecho rodada sobre `0467085..759bc11`.** Três lentes: `revisao-dois-eixos`
  (Standards e Spec) e o `/code-review` nativo em `high`. A lente de precisão
  (`open-code-review-delegate`) foi pulada: `ocr` não está instalado nesta máquina.
  Três achados corrigidos no commit `b55ffbf`: o escape de JSON escrito à mão em
  `GatewayClient` (`.replace("
", "
")` é no-op em Java, então resposta com Enter
  virava `FAILED`) trocado por Jackson; `ConversationService.ingest` devolvendo
  `id: null` em conversa que já existe, pela mesma armadilha do `em.merge` que o
  `persistReply` já contornava; e o `oxlint`, que estava em devDependencies com
  `.oxlintrc.json` no repo e nunca executava — o job chamado `lint` só fazia typecheck.
  Dois achados recusados com motivo: a prévia fora de ordem (a associação tem
  `@OrderBy("createdAt asc")`) e o `randomUUID` do canal simulado (o Telegram usa
  `update_id` real, e cada POST simulado é mensagem nova, não reentrega).

- **Credencial no webhook de canal, commit `6cf97dc`.** Spec em
  `specs/2026-10-04-auth-no-webhook.md`. `POST /webhooks/:channel` exigia nada; agora a
  credencial muda com o canal, porque quem chama muda. Telegram: `secret_token` do
  `setWebhook` conferido com `timingSafeEqual`. Simulados: o JWT do agente, validado
  no core por `GET /api/agents`, porque o botão **Simular** roda no navegador e segredo
  em front não é segredo. Core fora do ar devolve `503`, não `401`: 4xx ensina o canal
  a desistir em vez de reentregar. Credencial antes do `404`, senão o gateway conta
  quais canais existem. `env.ts` recusa o boot com `TELEGRAM_BOT_TOKEN` sem
  `TELEGRAM_WEBHOOK_SECRET`. `npm test` do gateway → `Tests 19 passed (19)`.

- **Credencial no `/ws` antes da difusão, commit `43416f1`.** Spec em
  `specs/2026-10-04-auth-no-websocket.md`. A prova é a primeira mensagem,
  `{"token":"<jwt>"}`: o handshake de WebSocket do navegador não leva header
  customizado, e `?token=` cairia no log de requisição do gateway. Até o token válido
  chegar o socket fica fora da lista de difusão, e silêncio por 5s fecha a conexão.
  O fechamento carrega o motivo porque o cliente reconecta a cada 3s: `4401` é
  credencial recusada e ele não insiste, `4503` é core fora do ar e ele tenta de novo.
  Sem isso, sessão velha no `localStorage` virava uma validação de JWT no core a cada
  3s, por aba, para sempre. `maxPayload` do WebSocket caiu para 4 KiB: o default do
  `ws` é 100 MiB e o frame é lido antes de qualquer prova. `npm test` do gateway →
  `Tests 28 passed (28)`.

  Duas corridas vieram da revisão de fecho, as duas no handler `async` de `message`:
  validação que voltava depois do prazo chamava `clientes.add` em cima de socket já
  fechado, e cada frame abria uma validação no core. As guardas `validando` e
  `encerrado` fecham as duas. **O teste da primeira passou verde por acidente** até
  trocar `vi.waitFor` por `vi.advanceTimersByTimeAsync`: com timers falsos o `waitFor`
  checava antes de a microtask do `fetch` rodar. Teste com timer falso e `await`
  pendente precisa drenar microtask, senão assere o estado anterior.

- **Sessão expirada termina em login, commit `c054bab`.** Spec em
  `specs/2026-10-04-sessao-expirada-no-front.md`. O `401` é detectado em `request()`,
  o único ponto por onde toda chamada ao core passa, e avisa o `AuthProvider`, que
  apaga a sessão e mostra o aviso no login. O `401` de `/api/auth/login` continua sendo
  senha errada, e o `401` atrasado de um token velho não derruba a sessão nova: cada
  chamada guarda a geração do token com que saiu. A leitura do `localStorage` saiu para
  `web/src/session.ts` com o `try` em volta do acesso inteiro, não só do parse — em aba
  privativa o próprio `getItem` lança, e isso rodava no inicializador do `useState`.
  O `web` ganhou `vitest` (não tinha suíte) e o `npm test` entrou no job `lint-web`:
  job separado repetia o mesmo `npm ci` por um comando de diferença.

  Três achados vieram da revisão de fecho, e um era desta própria mudança: o
  `JSON.parse` corria **antes** da checagem do `401`, então corpo de proxy em HTML
  estourava `SyntaxError` e a sessão ficava de pé, que é o bug que a mudança existia
  para matar. Os outros dois: o token era semeado pelo efeito do provider, mas no F5 os
  efeitos do `Inbox` correm antes dos do pai e as chamadas saíam sem `Authorization`;
  e o `/ws` fechando com `4401` não avisava ninguém, então o inbox congelava calado.

- **Senha de demonstração só fora de produção, commit `121349a`.** Spec em
  `specs/2026-10-04-seed-sem-senha-conhecida.md`. Com o perfil `prod` ativo o seed exige
  `SEED_ADMIN_PASSWORD`; fora dele `senha123` segue valendo, porque é o critério 1 da
  spec principal e o caminho de quem avalia. A senha é resolvida **dentro** do runner,
  depois do `count()`: resolver antes faria instância de produção com banco já povoado
  parar de subir exigindo valor que nunca seria usado. Perfil que chega por grupo também
  é pego (`--spring.profiles.active=live --spring.profiles.group.live=prod`).
  `./mvnw -B test` → `Tests run: 37, Failures: 0`.

  **A revisão salvou a regra de nascer inerte:** o `docker-compose.yml` não repassava
  `SPRING_PROFILES_ACTIVE` ao serviço `core`, e o compose só substitui variável
  declarada em `environment`. O `README` prometia um interruptor que, pelo caminho que
  ele mesmo manda rodar, não ligava nada — a instância continuava nascendo com
  `senha123`. Lição que vale além deste caso: guarda que depende de configuração precisa
  ter o caminho de ativação testado, não só a regra.

- **Task 12 parcial.** `README.md` e `docs/defesa.md` escritos. Critérios de aceite
  1, 2, 3, 5, 6 rodados verdes: quatro serviços `running`; `401` sem token e token
  emitido com token; webhook cria conversa `WHATSAPP`; `Agente Demo` e `RESOLVED`
  persistem depois de `docker compose restart core`; `./mvnw -B test` →
  `Tests run: 27, Failures: 0`; `npm test` do gateway → `Tests 12 passed (12)`.

## Pendente para retomar

1. **Task 8 Step 7, prova ponta a ponta do Telegram: depende do Lucio.** Criar o bot no
   `@BotFather`, pôr o token em `.env` como `TELEGRAM_BOT_TOKEN` **e escolher um valor
   para `TELEGRAM_WEBHOOK_SECRET`** (sem ele o gateway não sobe), expor a porta 3000
   (`npx --yes localtunnel --port 3000`) e registrar o webhook **com o segredo**:
   `curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=<url-do-tunel>/webhooks/telegram&secret_token=$TELEGRAM_WEBHOOK_SECRET"`.
   Esperado: `{"ok":true,"result":true,"description":"Webhook was set"}`. Registrar sem
   `secret_token` faz todo update levar `401` e o Telegram reentregar em laço. Isso fecha
   o critério de aceite 4, que pede GIF com o celular visível no `README.md`.

2. **`docs/inbox.gif` e `docs/mobile.png` não existem: dependem do Lucio.** O
   `README.md` já referencia os dois, então as duas imagens aparecem quebradas até a
   gravação. O GIF fecha o critério 4 (Telegram ponta a ponta, celular visível) e
   depende do mesmo bot do item 1. O PNG fecha o critério 7: abrir
   <http://localhost:8081> no DevTools a 375px e conferir que não há scroll
   horizontal e que a lista sai de cena com conversa aberta.

3. **Critério de aceite 9 não fecha.** Ele pede pelo menos cinco Pull Requests fechados,
   e os treze commits entraram num PR só (#1). Não tem conserto retroativo: tarefa nova
   fecha por PR separado.

4. Decidir se `specs/` entra no repositório público da candidatura. O conteúdo mostra processo
   de engenharia, mas no formato de plano de agente.

5. **Achados da revisão que seguem abertos, cada um uma decisão sua.**
   O filtro por status (`Inbox.tsx`, `ConversationController`) está entregue mas a spec
   lista filtros em "Fora de escopo" — decidir se fica ou se a spec muda.
   `ConversationService.list` carrega todas as conversas e, por lazy, todas as mensagens
   de cada uma só para montar a prévia (N+1), e o front recarrega a lista inteira a cada
   evento WebSocket, por cliente aberto. Sem rate limit no gateway, N sockets ou N
   webhooks ainda provocam N validações de JWT no core; está no "Fora de escopo" da spec
   do `/ws`. Quatro warnings do `oxlint` em `Inbox.tsx`, `realtime.ts` e `auth.tsx`,
   nenhum quebra o build.

6. **Avisos do Actions, nenhum quebra o build.** `actions/setup-java` já está em `@v5`.
   Restam `actions/checkout@v4` e `actions/setup-node@v4`, que ainda miram Node 20 e o
   runner força Node 24, e a migração do `ubuntu-latest` para Ubuntu 26 em 19/10/2026.

## Onde cada critério de aceite está

| # | O que pede | Estado |
|---|---|---|
| 1 | Sobe em um comando | verde, quatro serviços `running` |
| 2 | Autenticação rejeita e aceita | verde |
| 3 | Webhook cria conversa | verde |
| 4 | Telegram ponta a ponta, GIF com celular | **falta**, itens 1 e 2 |
| 5 | Atribuição e resolução persistem | verde |
| 6 | Teste do core e do gateway | verde, `Tests run: 37`, `Tests 28 passed`, e `Tests 7 passed` no web |
| 7 | Responsivo a 375px, screenshot | **falta**, item 2 |
| 8 | Pipeline verde com link no `README.md` | verde, badge em `main` |
| 9 | Cinco Pull Requests fechados | **não fecha**, item 3 |

## Decisões tomadas que não se refazem

- Spring Boot 3.5.16, não 4.x: o Initializr só entrega 4.x e ele renomeou os starters.
- Front-end em Bootstrap 5 e CSS próprio. Nada de Tailwind ou biblioteca de componentes.
- Telegram é canal real; WhatsApp e e-mail entram pelo mesmo contrato de webhook, simulados.
- Execução das tarefas em subagente com `model: "sonnet"`; spec, plano, revisão e commit em Opus.
- Teste de integração é `@Transactional`. O container do PostgreSQL é único para a suíte, então
  sem rollback por teste o dado de um teste entra na asserção de ordem do outro. O plano original
  não previa isso e o `ConversationRepositoryIT` falhou com `[1L, 3L, 2L]` antes da correção.
- O `lint` do `web` é `tsc -b --noEmit`, não `tsc --noEmit`. O template do Vite põe as opções
  reais em `tsconfig.app.json`, e sem `-b` o lint passava verde em código que o `build` reprovava
  com `error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled`.
- O ponto de entrada do gateway é `gateway/src/main.ts`, não um guard de `import.meta.url` no fim
  do `server.ts`. O guard compara caminhos e erra no Windows por causa da barra invertida; com
  arquivo separado o teste importa `buildServer` sem abrir porta.
- Em `persistReply`, a mensagem é persistida por `messages.saveAndFlush`, não pelo cascade de
  `conversations.save`. `save` numa conversa que já tem id chama `em.merge`, que copia a mensagem
  nova: o id nasce na cópia gerenciada e a instância local fica com `id` nulo, o que quebrava o
  `markDelivery` com `InvalidDataAccessApiUsageException: The given id must not be null`.
- O runner limpo reprovou dois testes que passavam aqui, e os dois dependiam da máquina.
  `CoreApplicationTests` era o esqueleto do Initializr: `@SpringBootTest` sem
  Testcontainers, abria o datasource do `application.yml` e só passava porque o
  `docker compose` local expõe 5432 (`Connection to localhost:5432 refused` no CI).
  Apagado: os cinco ITs que estendem `PostgresIT` já provam que o contexto sobe.
  `ConversationRepositoryIT` assertava `containsExactly` sobre `findAll`, o que exige
  banco vazio; o `InboundApiIT` tem `@Transactional` em um método só e commita conversa
  nos outros. Agora é `containsSubsequence`, que prova a ordem relativa. A falha reproduz
  com `./mvnw -B test -Dsurefire.runOrder=reversealphabetical`.
- O surefire tem `<includes>` com `**/*IT.java`. O critério de aceite 6 roda `./mvnw test`, e o
  padrão do surefire só pega `*Test`: sem o include, os testes que sobem o PostgreSQL ficavam
  de fora e `./mvnw test` passava com um teste só.
