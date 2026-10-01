# Estado em 01/10/2026

Vaga fecha em 08/10/2026. Restam 7 dias.

## Pronto

- `specs/2026-10-01-inbox-omnichannel.md` — spec com nove critérios de aceite rodáveis.
- `specs/2026-10-01-inbox-omnichannel.plano.md` — plano de 12 tarefas, código real em cada passo.
- Task 1 parcial: `.gitignore`, `.env.example`, `.env`, `docker-compose.yml` (só o serviço `postgres`), `git init -b main`.
- Task 2 Steps 1 e 2: `core/` do Spring Initializr, parent fixado em Spring Boot **3.5.16**,
  starters corrigidos, jjwt e Testcontainers acrescentados. `./mvnw -B -q compile` → exit 0.
- Commit `767ea71` como `Lucio Lima <luciolimap@gmail.com>`.

## Pendente para retomar

1. **Docker Desktop 4.93.0 não terminou de instalar.** O WSL2 já está instalado.
   Retomar com:

   ```powershell
   winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
   ```

   Depois reiniciar a máquina, abrir o Docker Desktop uma vez, aceitar os termos, e conferir:

   ```bash
   docker compose version
   docker compose up -d postgres
   docker compose ps --format '{{.Service}} {{.State}} {{.Health}}'
   ```

   Esperado: `postgres running healthy`. Isso fecha a Task 1.

2. **Repositório remoto ainda não existe.** `glab` não está instalado. Decidir entre
   `winget install glab.glab` ou criar o projeto no GitLab pela web e só adicionar o remote.
   `gh` já está autenticado como `luciolimap` para o espelho no GitHub.

3. **Task 2 Steps 3 a 12**: apagar o `application.properties` do Initializr, escrever o
   `application.yml`, a migração `V1__schema.sql`, enums, entidades, repositórios e o teste
   com Testcontainers. Precisa do Docker de pé.

## Decisões tomadas que não se refazem

- Spring Boot 3.5.16, não 4.x: o Initializr só entrega 4.x e ele renomeou os starters.
- Front-end em Bootstrap 5 e CSS próprio. Nada de Tailwind ou biblioteca de componentes.
- Telegram é canal real; WhatsApp e e-mail entram pelo mesmo contrato de webhook, simulados.
- Execução das tarefas em subagente com `model: "sonnet"`; spec, plano, revisão e commit em Opus.
