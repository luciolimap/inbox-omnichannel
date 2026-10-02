# Estado em 02/10/2026

Vaga fecha em 08/10/2026. Restam 6 dias.

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

## Pendente para retomar

1. **Task 6**: responder, atribuir, resolver, e despacho ao gateway.

2. **Repositório remoto ainda não existe.** Deve ser **privado** e **só na conta do Lucio**
   (`luciolimap`): nada de colaborador, nada de rastro de IA no histórico ou na descrição.
   `glab` não está instalado. Decidir entre `winget install glab.glab` ou criar o projeto no
   GitLab pela web e só acrescentar o remote. `gh` já está autenticado para o espelho no GitHub.

3. Decidir se `specs/` entra no repositório público da candidatura. O conteúdo mostra processo
   de engenharia, mas no formato de plano de agente.

## Decisões tomadas que não se refazem

- Spring Boot 3.5.16, não 4.x: o Initializr só entrega 4.x e ele renomeou os starters.
- Front-end em Bootstrap 5 e CSS próprio. Nada de Tailwind ou biblioteca de componentes.
- Telegram é canal real; WhatsApp e e-mail entram pelo mesmo contrato de webhook, simulados.
- Execução das tarefas em subagente com `model: "sonnet"`; spec, plano, revisão e commit em Opus.
- Teste de integração é `@Transactional`. O container do PostgreSQL é único para a suíte, então
  sem rollback por teste o dado de um teste entra na asserção de ordem do outro. O plano original
  não previa isso e o `ConversationRepositoryIT` falhou com `[1L, 3L, 2L]` antes da correção.
- O surefire tem `<includes>` com `**/*IT.java`. O critério de aceite 6 roda `./mvnw test`, e o
  padrão do surefire só pega `*Test`: sem o include, os testes que sobem o PostgreSQL ficavam
  de fora e `./mvnw test` passava com um teste só.
