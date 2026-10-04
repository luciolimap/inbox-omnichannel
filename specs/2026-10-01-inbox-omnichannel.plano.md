# Inbox Omnichannel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um inbox web onde mensagens de Telegram (real), WhatsApp e e-mail (simulados) caem numa única caixa de entrada, e um agente autenticado responde pelo canal de origem.

**Architecture:** Três serviços. `gateway` (Node + Fastify) é a borda: recebe webhook de canal, traduz o payload cru para um contrato interno único, repassa ao core e mantém as conexões WebSocket do navegador. `core` (Java + Spring Boot) é o domínio: autenticação, contatos, conversas, mensagens, PostgreSQL via JPA e Flyway. `web` (React + Bootstrap 5) consome a API REST do core e escuta o WebSocket do gateway. A fronteira existe porque webhook de canal precisa aceitar rajada e responder 200 em milissegundos, enquanto o domínio precisa transação — não existe para exibir duas linguagens.

**Tech Stack:** Java 21 / Spring Boot 3.5.16 / Spring Security / JPA / Flyway / jjwt 0.12 / Testcontainers · Node 24 / TypeScript / Fastify 5 / @fastify/websocket / Vitest · React 19 / TypeScript / Vite / Bootstrap 5 · PostgreSQL 16 · Docker Compose · GitHub Actions

**Spec:** `specs/2026-10-01-inbox-omnichannel.md`

**Execução:** `subagent-driven-development`. O agente pai planeja, revisa e commita
em Opus; cada tarefa é despachada a um subagente com `model: "sonnet"`.

## Global Constraints

- Java 21 (JDK instalado: `21.0.11`). Build por `./mvnw` — Maven **não** está instalado na máquina; o wrapper vem do zip do Spring Initializr.
- Spring Boot **3.5.16**, não 4.x. O Initializr só entrega 4.x e renomeou os starters; 3.5.x é o que as empresas rodam e o que todo bloco de código deste plano assume.
- Node 24.15. Gateway e web usam TypeScript em modo `strict`.
- Front-end: **Bootstrap 5 e CSS próprio apenas**. Proibido Tailwind, shadcn, MUI, Chakra ou qualquer biblioteca de componentes. A vaga pede Bootstrap literalmente.
- Banco: PostgreSQL 16, sempre em container. `psql` não está instalado localmente.
- Docker e Docker Compose **não** estão instalados. A Task 1 instala — é ação de faixa vermelha e precisa do `## PLAN` e do ok do usuário antes.
- Auth: JWT stateless HS256, senha com BCrypt, dois papéis — `AGENT` e `ADMIN`. Sem refresh token, sem OAuth2.
- Canais: `TELEGRAM`, `WHATSAPP`, `EMAIL`. Só Telegram fala com serviço externo real; os outros dois entram pelo mesmo contrato de webhook.
- Chamada entre `core` e `gateway` sempre carrega o header `X-Internal-Token`, valor da env `INTERNAL_TOKEN`. É fronteira de confiança: sem o header, 401.
- `external_id` de mensagem é sempre prefixado pelo canal (`telegram:4812`, `whatsapp:9f3a`). O prefixo é o que torna o índice único global seguro entre canais.
- Commits em Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `ci:`). Mínimo cinco Pull Requests fechados no GitHub.
- Comentário no código diz **por que**, nunca **o quê**. Teto: uma linha de comentário a cada dez de código.
- Nenhum segredo commitado. `.env.example` tem as chaves com valor de exemplo; `.env` fica no `.gitignore`.

## Review Focus

Classes de entrada que a spec implica mas nenhum critério de aceite exercita. Cada linha tem um teste atribuído à task que é dona do código.

1. **Webhook com payload malformado ou sem texto** — Telegram manda `update` de muitos tipos (entrou no grupo, foto, sticker). O gateway deve responder 200 e ignorar, nunca 500 nem conversa órfã no banco. → teste na Task 7, Step 3 e Task 8, Step 5.
2. **Mesma mensagem entregue duas vezes** — Telegram reentrega o webhook quando não recebe 200 rápido. A segunda entrega não pode virar mensagem duplicada no inbox. → teste na Task 5, Step 6.
3. **JWT expirado, assinado com outra chave ou truncado** — deve dar 401 com corpo JSON, nunca 500 nem stacktrace. → teste na Task 3, Step 8.
4. **Corpo de mensagem vazio, só espaço, ou acima de 4096 caracteres** — validação no limite de confiança, 400 com mensagem útil. → teste na Task 6, Step 3.
5. **Gateway fora do ar quando o agente responde** — a mensagem já salva não pode desaparecer nem aparecer como entregue. Fica `FAILED` e a interface mostra. → teste na Task 6, Step 9.

---

## File Structure

```
smartspace-projeto/
├── docker-compose.yml          Orquestra postgres, core, gateway, web
├── .github/workflows/ci.yml   lint, test, docker build dos três serviços
├── .env.example                Chaves de ambiente com valor de exemplo
├── .gitignore
├── README.md                   O que é, como rodar, por que a fronteira existe
├── specs/                      spec.md e este plano
├── core/                       Domínio Java
│   ├── pom.xml  mvnw  mvnw.cmd  .mvn/  Dockerfile
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/migration/V1__schema.sql
│   ├── src/main/java/com/smartspace/inbox/
│   │   ├── CoreApplication.java          Vem do Initializr, nome mantido
│   │   ├── DataInitializer.java          Semeia dois agentes se a tabela está vazia
│   │   ├── agent/      Agent, Role, AgentRepository, AgentController, AgentDto
│   │   ├── auth/       JwtService, JwtAuthFilter, SecurityConfig, AuthController, dtos
│   │   ├── contact/    Contact, ContactRepository
│   │   ├── conversation/ Conversation, Message, Channel, ConversationStatus,
│   │   │                 Direction, DeliveryStatus, repositórios,
│   │   │                 ConversationService, ConversationController, dtos
│   │   ├── inbound/    InboundController, InboundRequest, InternalTokenFilter
│   │   ├── gateway/    GatewayClient                 core → gateway
│   │   └── error/      ApiExceptionHandler, ApiError
│   └── src/test/java/com/smartspace/inbox/
│       ├── conversation/ConversationServiceTest.java      regra de domínio, sem banco
│       ├── conversation/ConversationRepositoryIT.java      Testcontainers
│       ├── auth/AuthControllerIT.java
│       └── support/PostgresIT.java                         base Testcontainers
├── gateway/                    Borda Node
│   ├── package.json  tsconfig.json  Dockerfile  vitest.config.ts
│   ├── src/
│   │   ├── server.ts           Monta o Fastify, registra rotas
│   │   ├── env.ts              Lê e valida env na subida
│   │   ├── channels/types.ts   ChannelAdapter, InboundMessage — o contrato
│   │   ├── channels/telegram.ts    Único adapter que fala com serviço externo
│   │   ├── channels/simulated.ts   WhatsApp e e-mail pelo mesmo contrato
│   │   ├── channels/registry.ts
│   │   ├── core-client.ts      gateway → core
│   │   └── realtime.ts         Hub de WebSocket
│   └── test/
│       ├── channels.test.ts
│       └── routes.test.ts
└── web/                        Interface React
    ├── package.json  tsconfig.json  vite.config.ts  Dockerfile  nginx.conf
    └── src/
        ├── main.tsx  App.tsx  styles.css
        ├── api.ts              fetch tipado + injeção do Bearer
        ├── auth.tsx            AuthProvider, useAuth, token no localStorage
        ├── realtime.ts         Hook de WebSocket com reconexão
        ├── pages/Login.tsx  pages/Inbox.tsx
        └── components/ConversationList.tsx  MessageThread.tsx  Composer.tsx
                       ChannelBadge.tsx  StatusBadge.tsx
```

---

### Task 1: Esqueleto do repositório, Docker e PostgreSQL de pé

Nada compila ainda. O entregável é: `docker compose up -d postgres` sobe um PostgreSQL acessível e o repo existe no GitHub.

**Files:**
- Create: `.gitignore`, `.env.example`, `docker-compose.yml`, `README.md`

**Interfaces:**
- Consumes: nada.
- Produces: serviço `postgres` em `localhost:5432`, banco `inbox`, usuário `inbox`, senha vinda de `POSTGRES_PASSWORD`. Rede Docker `default` do compose, onde os outros serviços alcançam o banco pelo host `postgres`.

- [ ] **Step 1: Instalar Docker Desktop (ação de faixa vermelha — o agente pai mostra o `## PLAN` e espera o ok)**

Windows 10 Home exige backend WSL2.

```powershell
wsl --install --no-distribution
winget install -e --id Docker.DockerDesktop
```

Depois reiniciar a máquina, abrir o Docker Desktop uma vez e aceitar os termos.

- [ ] **Step 2: Verificar que o Docker responde**

Run: `docker compose version`
Expected: linha começando com `Docker Compose version v2.`

- [ ] **Step 3: Criar `.gitignore`**

```gitignore
.env
target/
node_modules/
dist/
*.log
.idea/
.vscode/
.DS_Store
```

- [ ] **Step 4: Criar `.env.example`**

```dotenv
# Copie para .env e ajuste. O .env nao vai para o repositorio.
POSTGRES_PASSWORD=inbox_dev
JWT_SECRET=troque-este-segredo-por-no-minimo-32-caracteres
INTERNAL_TOKEN=token-interno-de-desenvolvimento

# Token do bot criado no @BotFather. Sem ele o canal Telegram fica desligado
# e apenas os canais simulados funcionam.
TELEGRAM_BOT_TOKEN=
```

- [ ] **Step 5: Criar `docker-compose.yml` com apenas o banco**

Os outros serviços entram na Task 11, quando existirem `Dockerfile`s para construir.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: inbox
      POSTGRES_USER: inbox
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-inbox_dev}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U inbox -d inbox"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

- [ ] **Step 6: Subir e verificar**

```bash
cp .env.example .env
docker compose up -d postgres
docker compose ps --format '{{.Service}} {{.State}} {{.Health}}'
```

Expected: `postgres running healthy`

- [ ] **Step 7: Commit e primeiro Pull Request**

```bash
git init -b main
git add .gitignore .env.example docker-compose.yml specs/
git commit -m "chore: esqueleto do repositorio e postgres em container"
```

Criar o repositorio no GitHub, adicionar o remote, enviar `main`. A partir daqui cada task vive numa branch `feat/<nome>` e fecha por Pull Request.

---

### Task 2: Core — Spring Boot de pé, schema no Flyway, entidades, teste com Testcontainers

**Files:**
- Create: `core/` inteiro a partir do Spring Initializr, `core/src/main/resources/application.yml`, `core/src/main/resources/db/migration/V1__schema.sql`
- Create: `core/src/main/java/com/smartspace/inbox/agent/{Agent,Role,AgentRepository}.java`
- Create: `core/src/main/java/com/smartspace/inbox/contact/{Contact,ContactRepository}.java`
- Create: `core/src/main/java/com/smartspace/inbox/conversation/{Conversation,Message,Channel,ConversationStatus,Direction,DeliveryStatus,ConversationRepository,MessageRepository}.java`
- Test: `core/src/test/java/com/smartspace/inbox/support/PostgresIT.java`, `core/src/test/java/com/smartspace/inbox/conversation/ConversationRepositoryIT.java`

**Interfaces:**
- Consumes: serviço `postgres` da Task 1.
- Produces:
  - `enum Channel { TELEGRAM, WHATSAPP, EMAIL }`
  - `enum ConversationStatus { OPEN, PENDING, RESOLVED }`
  - `enum Direction { INBOUND, OUTBOUND }`
  - `enum DeliveryStatus { PENDING, SENT, FAILED }`
  - `enum Role { AGENT, ADMIN }`
  - `Agent` com `Long getId()`, `String getName()`, `String getEmail()`, `String getPasswordHash()`, `Role getRole()`
  - `Contact` com `Long getId()`, `Channel getChannel()`, `String getExternalId()`, `String getDisplayName()`
  - `Conversation` com `Long getId()`, `Contact getContact()`, `Channel getChannel()`, `ConversationStatus getStatus()`, `Agent getAssignedAgent()`, `Instant getLastMessageAt()`, `List<Message> getMessages()`, e os setters `setStatus`, `setAssignedAgent`, `setLastMessageAt`
  - `Message` com `Long getId()`, `Direction getDirection()`, `String getBody()`, `String getExternalId()`, `DeliveryStatus getDeliveryStatus()`, `Instant getCreatedAt()`, `Agent getSentByAgent()`, `setDeliveryStatus`
  - `AgentRepository extends JpaRepository<Agent, Long>` com `Optional<Agent> findByEmail(String email)`
  - `ContactRepository extends JpaRepository<Contact, Long>` com `Optional<Contact> findByChannelAndExternalId(Channel channel, String externalId)`
  - `ConversationRepository extends JpaRepository<Conversation, Long>` com `List<Conversation> findAllByOrderByLastMessageAtDesc()`, `List<Conversation> findByStatusOrderByLastMessageAtDesc(ConversationStatus status)`, `Optional<Conversation> findFirstByContactAndStatusNotOrderByLastMessageAtDesc(Contact contact, ConversationStatus status)`
  - `MessageRepository extends JpaRepository<Message, Long>` com `Optional<Message> findByExternalId(String externalId)`
  - `PostgresIT` — classe base `@SpringBootTest` com container PostgreSQL compartilhado

- [ ] **Step 1: Baixar o esqueleto do Spring Initializr**

Maven não está instalado; o zip traz o wrapper `mvnw`.

```bash
curl -fsSL -o core.zip "https://start.spring.io/starter.zip?type=maven-project&language=java&bootVersion=4.0.8.RELEASE&javaVersion=21&groupId=com.smartspace&artifactId=core&name=core&packageName=com.smartspace.inbox&dependencies=web,data-jpa,security,validation,flyway,postgresql,lombok,actuator"
unzip -q core.zip -d core && rm core.zip
chmod +x core/mvnw
```

O Initializr só oferece Spring Boot 4.x — a linha 3.x saiu do catálogo. O zip serve
pelo wrapper `mvnw` e pela estrutura; a versão é corrigida no passo seguinte.

- [ ] **Step 2: Fixar o parent em Spring Boot 3.5.16 e ajustar as dependências**

O Spring Boot 4 renomeou os starters (`spring-boot-starter-webmvc`, e um starter de
teste por fatia em vez de `spring-boot-starter-test`). Fixar em 3.5.16 troca uma API
nova e pouco documentada pela que toda empresa roda hoje — e é a versão que este
plano assume em cada bloco de código.

Em `core/pom.xml`, trocar a versão do parent:

```xml
<version>3.5.16</version>
```

Trocar `spring-boot-starter-webmvc` por `spring-boot-starter-web`, trocar
`spring-boot-starter-flyway` por `org.flywaydb:flyway-core`, e trocar os seis
starters de teste `spring-boot-starter-*-test` por:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
</dependency>
```

Acrescentar jjwt:

```xml
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
```

Provar que resolve antes de escrever qualquer classe:

Run: `cd core && ./mvnw -B -q compile`
Expected: exit 0, sem saída.

- [ ] **Step 3: Escrever `core/src/main/resources/application.yml`**

Apagar o `application.properties` que veio do Initializr antes — os dois juntos
fazem o `properties` ganhar e a configuração do `yml` ser ignorada em silêncio.

```yaml
spring:
  application:
    name: inbox-core
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:inbox}
    username: ${DB_USER:inbox}
    password: ${DB_PASSWORD:inbox_dev}
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate
    properties:
      hibernate.jdbc.time_zone: UTC
  flyway:
    enabled: true

inbox:
  jwt:
    secret: ${JWT_SECRET:segredo-de-desenvolvimento-com-mais-de-32-chars}
    ttl-minutes: 480
  internal-token: ${INTERNAL_TOKEN:token-interno-de-desenvolvimento}
  gateway-url: ${GATEWAY_URL:http://localhost:3000}

server:
  port: 8080

logging:
  level:
    com.smartspace.inbox: DEBUG
```

- [ ] **Step 4: Escrever a migração `core/src/main/resources/db/migration/V1__schema.sql`**

```sql
create table agent (
    id            bigserial primary key,
    name          varchar(120) not null,
    email         varchar(180) not null unique,
    password_hash varchar(100) not null,
    role          varchar(20)  not null
);

create table contact (
    id           bigserial primary key,
    channel      varchar(20)  not null,
    external_id  varchar(180) not null,
    display_name varchar(180),
    unique (channel, external_id)
);

create table conversation (
    id                bigserial primary key,
    contact_id        bigint      not null references contact (id),
    channel           varchar(20) not null,
    status            varchar(20) not null,
    assigned_agent_id bigint references agent (id),
    created_at        timestamptz not null default now(),
    last_message_at   timestamptz not null default now()
);

create index conversation_status_last_message_idx
    on conversation (status, last_message_at desc);

create table message (
    id               bigserial primary key,
    conversation_id  bigint      not null references conversation (id) on delete cascade,
    direction        varchar(10) not null,
    body             text        not null,
    external_id      varchar(220),
    delivery_status  varchar(20) not null,
    sent_by_agent_id bigint references agent (id),
    created_at       timestamptz not null default now()
);

-- Telegram reentrega o webhook quando nao recebe 200 rapido. O external_id vem
-- prefixado pelo canal (telegram:4812), entao o unico global nao colide entre
-- canais e a reentrega para no banco, nao na aplicacao.
create unique index message_external_id_idx
    on message (external_id) where external_id is not null;

create index message_conversation_created_idx
    on message (conversation_id, created_at);
```

- [ ] **Step 5: Escrever os enums**

`core/src/main/java/com/smartspace/inbox/conversation/Channel.java`:

```java
package com.smartspace.inbox.conversation;

public enum Channel {
    TELEGRAM, WHATSAPP, EMAIL
}
```

`ConversationStatus.java`:

```java
package com.smartspace.inbox.conversation;

public enum ConversationStatus {
    OPEN, PENDING, RESOLVED
}
```

`Direction.java`:

```java
package com.smartspace.inbox.conversation;

public enum Direction {
    INBOUND, OUTBOUND
}
```

`DeliveryStatus.java`:

```java
package com.smartspace.inbox.conversation;

public enum DeliveryStatus {
    PENDING, SENT, FAILED
}
```

`core/src/main/java/com/smartspace/inbox/agent/Role.java`:

```java
package com.smartspace.inbox.agent;

public enum Role {
    AGENT, ADMIN
}
```

- [ ] **Step 6: Escrever as entidades**

`core/src/main/java/com/smartspace/inbox/agent/Agent.java`:

```java
package com.smartspace.inbox.agent;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "agent")
@Getter
@Setter
@NoArgsConstructor
public class Agent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    public Agent(String name, String email, String passwordHash, Role role) {
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
    }
}
```

`core/src/main/java/com/smartspace/inbox/contact/Contact.java`:

```java
package com.smartspace.inbox.contact;

import com.smartspace.inbox.conversation.Channel;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "contact")
@Getter
@Setter
@NoArgsConstructor
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Channel channel;

    @Column(name = "external_id", nullable = false)
    private String externalId;

    @Column(name = "display_name")
    private String displayName;

    public Contact(Channel channel, String externalId, String displayName) {
        this.channel = channel;
        this.externalId = externalId;
        this.displayName = displayName;
    }
}
```

`core/src/main/java/com/smartspace/inbox/conversation/Conversation.java`:

```java
package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.contact.Contact;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "conversation")
@Getter
@Setter
@NoArgsConstructor
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "contact_id")
    private Contact contact;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Channel channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ConversationStatus status = ConversationStatus.OPEN;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assigned_agent_id")
    private Agent assignedAgent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "last_message_at", nullable = false)
    private Instant lastMessageAt = Instant.now();

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt asc")
    private List<Message> messages = new ArrayList<>();

    public Conversation(Contact contact) {
        this.contact = contact;
        this.channel = contact.getChannel();
    }

    public void addMessage(Message message) {
        message.setConversation(this);
        this.messages.add(message);
        this.lastMessageAt = message.getCreatedAt();
    }
}
```

`core/src/main/java/com/smartspace/inbox/conversation/Message.java`:

```java
package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.Agent;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "message")
@Getter
@Setter
@NoArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id")
    private Conversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Direction direction;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "external_id")
    private String externalId;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", nullable = false)
    private DeliveryStatus deliveryStatus = DeliveryStatus.SENT;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sent_by_agent_id")
    private Agent sentByAgent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static Message inbound(String body, String externalId) {
        Message message = new Message();
        message.direction = Direction.INBOUND;
        message.body = body;
        message.externalId = externalId;
        message.deliveryStatus = DeliveryStatus.SENT;
        return message;
    }

    public static Message outbound(String body, Agent sentBy) {
        Message message = new Message();
        message.direction = Direction.OUTBOUND;
        message.body = body;
        message.sentByAgent = sentBy;
        message.deliveryStatus = DeliveryStatus.PENDING;
        return message;
    }
}
```

- [ ] **Step 7: Escrever os repositórios**

`AgentRepository.java`:

```java
package com.smartspace.inbox.agent;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AgentRepository extends JpaRepository<Agent, Long> {
    Optional<Agent> findByEmail(String email);
}
```

`ContactRepository.java`:

```java
package com.smartspace.inbox.contact;

import com.smartspace.inbox.conversation.Channel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ContactRepository extends JpaRepository<Contact, Long> {
    Optional<Contact> findByChannelAndExternalId(Channel channel, String externalId);
}
```

`ConversationRepository.java`:

```java
package com.smartspace.inbox.conversation;

import com.smartspace.inbox.contact.Contact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    List<Conversation> findAllByOrderByLastMessageAtDesc();

    List<Conversation> findByStatusOrderByLastMessageAtDesc(ConversationStatus status);

    Optional<Conversation> findFirstByContactAndStatusNotOrderByLastMessageAtDesc(
            Contact contact, ConversationStatus status);
}
```

`MessageRepository.java`:

```java
package com.smartspace.inbox.conversation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {
    Optional<Message> findByExternalId(String externalId);
}
```

- [ ] **Step 8: Escrever a base de teste com Testcontainers**

`core/src/test/java/com/smartspace/inbox/support/PostgresIT.java`:

```java
package com.smartspace.inbox.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
public abstract class PostgresIT {

    // Um container estatico para toda a suite: subir um por classe de teste
    // multiplica o tempo de build por nada.
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
```

- [ ] **Step 9: Escrever o teste de repositório que deve falhar**

`core/src/test/java/com/smartspace/inbox/conversation/ConversationRepositoryIT.java`:

```java
package com.smartspace.inbox.conversation;

import com.smartspace.inbox.contact.Contact;
import com.smartspace.inbox.contact.ContactRepository;
import com.smartspace.inbox.support.PostgresIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ConversationRepositoryIT extends PostgresIT {

    @Autowired
    ContactRepository contacts;

    @Autowired
    ConversationRepository conversations;

    @Test
    void ordena_conversas_pela_mensagem_mais_recente() {
        Conversation antiga = novaConversa("telegram-1", Instant.parse("2026-10-01T10:00:00Z"));
        Conversation recente = novaConversa("telegram-2", Instant.parse("2026-10-01T12:00:00Z"));

        List<Conversation> resultado = conversations.findAllByOrderByLastMessageAtDesc();

        assertThat(resultado).extracting(Conversation::getId)
                .containsExactly(recente.getId(), antiga.getId());
    }

    @Test
    void acha_contato_por_canal_e_id_externo() {
        novaConversa("telegram-3", Instant.now());

        assertThat(contacts.findByChannelAndExternalId(Channel.TELEGRAM, "telegram-3")).isPresent();
        assertThat(contacts.findByChannelAndExternalId(Channel.WHATSAPP, "telegram-3")).isEmpty();
    }

    private Conversation novaConversa(String externalId, Instant lastMessageAt) {
        Contact contact = contacts.save(new Contact(Channel.TELEGRAM, externalId, "Cliente"));
        Conversation conversation = new Conversation(contact);
        conversation.setLastMessageAt(lastMessageAt);
        return conversations.save(conversation);
    }
}
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `cd core && ./mvnw -q test -Dtest=ConversationRepositoryIT`
Expected: FAIL. Antes do Step 4 estar aplicado, a falha é de validação do schema (`Schema-validation: missing table [agent]`); se o schema já estiver lá, a falha é de compilação por classe ausente. Qualquer uma serve: o teste tem de ficar vermelho antes de ficar verde.

- [ ] **Step 11: Rodar e ver passar**

Run: `cd core && ./mvnw -q test -Dtest=ConversationRepositoryIT`
Expected: PASS, dois testes.

- [ ] **Step 12: Commit**

```bash
git checkout -b feat/core-dominio
git add core/
git commit -m "feat: dominio do core com schema Flyway e teste Testcontainers"
```

---

### Task 3: Core — autenticação JWT, BCrypt e dois papéis

**Files:**
- Create: `core/src/main/java/com/smartspace/inbox/auth/{JwtService,JwtAuthFilter,SecurityConfig,AuthController,LoginRequest,LoginResponse}.java`
- Create: `core/src/main/java/com/smartspace/inbox/agent/{AgentDto,AgentController}.java`
- Create: `core/src/main/java/com/smartspace/inbox/DataInitializer.java`
- Create: `core/src/main/java/com/smartspace/inbox/error/{ApiError,ApiExceptionHandler}.java`
- Test: `core/src/test/java/com/smartspace/inbox/auth/AuthControllerIT.java`

**Interfaces:**
- Consumes: `Agent`, `Role`, `AgentRepository` da Task 2.
- Produces:
  - `JwtService` com `String generate(Agent agent)` e `Optional<String> subjectOf(String token)`
  - `record LoginRequest(String email, String password)`
  - `record LoginResponse(String token, AgentDto agent)`
  - `record AgentDto(Long id, String name, String email, String role)` com `static AgentDto from(Agent agent)`
  - `record ApiError(String error, String message)`
  - Rota pública `POST /api/auth/login`; todo o resto de `/api/**` exige Bearer válido; `/internal/**` sai do filtro JWT e é tratado na Task 5; `/actuator/health` público.
  - Agentes semeados: `agente@smartspace.test` / `senha123` com papel `AGENT`, `admin@smartspace.test` / `senha123` com papel `ADMIN`.

- [ ] **Step 1: Escrever o teste que deve falhar**

`core/src/test/java/com/smartspace/inbox/auth/AuthControllerIT.java`:

```java
package com.smartspace.inbox.auth;

import com.smartspace.inbox.support.PostgresIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AuthControllerIT extends PostgresIT {

    @Autowired
    MockMvc mvc;

    @Test
    void login_com_credencial_correta_devolve_token() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"agente@smartspace.test","password":"senha123"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.agent.role").value("AGENT"));
    }

    @Test
    void login_com_senha_errada_devolve_401() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"agente@smartspace.test","password":"errada"}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("credenciais_invalidas"));
    }

    @Test
    void rota_protegida_sem_token_devolve_401() throws Exception {
        mvc.perform(get("/api/agents")).andExpect(status().isUnauthorized());
    }

    @Test
    void rota_protegida_com_token_valido_devolve_200() throws Exception {
        String token = tokenDoAgente();
        mvc.perform(get("/api/agents").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    private String tokenDoAgente() throws Exception {
        String corpo = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"agente@smartspace.test","password":"senha123"}"""))
                .andReturn().getResponse().getContentAsString();
        return corpo.replaceAll(".*\"token\"\\s*:\\s*\"([^\"]+)\".*", "$1");
    }
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd core && ./mvnw -q test -Dtest=AuthControllerIT`
Expected: FAIL — `/api/auth/login` responde 404 e `/api/agents` não existe.

- [ ] **Step 3: Escrever `JwtService`**

```java
package com.smartspace.inbox.auth;

import com.smartspace.inbox.agent.Agent;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(@Value("${inbox.jwt.secret}") String secret,
                      @Value("${inbox.jwt.ttl-minutes}") long ttlMinutes) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofMinutes(ttlMinutes);
    }

    public String generate(Agent agent) {
        Instant agora = Instant.now();
        return Jwts.builder()
                .subject(agent.getEmail())
                .claim("role", agent.getRole().name())
                .claim("agentId", agent.getId())
                .issuedAt(Date.from(agora))
                .expiration(Date.from(agora.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public Optional<String> subjectOf(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.ofNullable(claims.getSubject());
            // Token expirado, assinado com outra chave ou truncado chega aqui. A
            // decisao de responder 401 e do filtro; o servico so diz "nao vale".
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
```

- [ ] **Step 4: Escrever `JwtAuthFilter`**

```java
package com.smartspace.inbox.auth;

import com.smartspace.inbox.agent.AgentRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final AgentRepository agents;

    public JwtAuthFilter(JwtService jwt, AgentRepository agents) {
        this.jwt = jwt;
        this.agents = agents;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            jwt.subjectOf(header.substring(7))
                    .flatMap(agents::findByEmail)
                    .ifPresent(agent -> {
                        var authority = new SimpleGrantedAuthority("ROLE_" + agent.getRole().name());
                        var auth = new UsernamePasswordAuthenticationToken(
                                agent, null, List.of(authority));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    });
        }
        chain.doFilter(request, response);
    }
}
```

- [ ] **Step 5: Escrever `SecurityConfig`**

```java
package com.smartspace.inbox.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtFilter) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/login", "/actuator/health").permitAll()
                        .requestMatchers("/internal/**").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().denyAll())
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint()))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    // O /internal/** passa livre aqui porque quem o protege e o InternalTokenFilter
    // da Task 5, com segredo compartilhado em vez de JWT de usuario.
    private AuthenticationEntryPoint entryPoint() {
        return (request, response, exception) -> {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"nao_autenticado\",\"message\":\"token ausente ou invalido\"}");
        };
    }

    private CorsConfigurationSource corsSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("http://localhost:*"));
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

- [ ] **Step 6: Escrever `AgentDto`, `AuthController`, `AgentController`, erro e seed**

`core/src/main/java/com/smartspace/inbox/agent/AgentDto.java`:

```java
package com.smartspace.inbox.agent;

public record AgentDto(Long id, String name, String email, String role) {

    public static AgentDto from(Agent agent) {
        return new AgentDto(agent.getId(), agent.getName(), agent.getEmail(), agent.getRole().name());
    }
}
```

`core/src/main/java/com/smartspace/inbox/auth/LoginRequest.java`:

```java
package com.smartspace.inbox.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
}
```

`core/src/main/java/com/smartspace/inbox/auth/LoginResponse.java`:

```java
package com.smartspace.inbox.auth;

import com.smartspace.inbox.agent.AgentDto;

public record LoginResponse(String token, AgentDto agent) {
}
```

`core/src/main/java/com/smartspace/inbox/auth/AuthController.java`:

```java
package com.smartspace.inbox.auth;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.agent.AgentDto;
import com.smartspace.inbox.agent.AgentRepository;
import com.smartspace.inbox.error.ApiError;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AgentRepository agents;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(AgentRepository agents, PasswordEncoder encoder, JwtService jwt) {
        this.agents = agents;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        Optional<Agent> encontrado = agents.findByEmail(request.email())
                .filter(agent -> encoder.matches(request.password(), agent.getPasswordHash()));

        // Uma resposta so para e-mail inexistente e para senha errada: dizer qual
        // dos dois falhou entrega lista de e-mails validos a quem testa em massa.
        if (encontrado.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiError("credenciais_invalidas", "e-mail ou senha incorretos"));
        }

        Agent agent = encontrado.get();
        return ResponseEntity.ok(new LoginResponse(jwt.generate(agent), AgentDto.from(agent)));
    }
}
```

`core/src/main/java/com/smartspace/inbox/agent/AgentController.java`:

```java
package com.smartspace.inbox.agent;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/agents")
public class AgentController {

    private final AgentRepository agents;

    public AgentController(AgentRepository agents) {
        this.agents = agents;
    }

    @GetMapping
    public List<AgentDto> list() {
        return agents.findAll().stream().map(AgentDto::from).toList();
    }
}
```

`core/src/main/java/com/smartspace/inbox/error/ApiError.java`:

```java
package com.smartspace.inbox.error;

public record ApiError(String error, String message) {
}
```

`core/src/main/java/com/smartspace/inbox/error/ApiExceptionHandler.java`:

```java
package com.smartspace.inbox.error;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> invalido(MethodArgumentNotValidException e) {
        String detalhe = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .orElse("corpo invalido");
        return ResponseEntity.badRequest().body(new ApiError("requisicao_invalida", detalhe));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> status(ResponseStatusException e) {
        HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
        String codigo = status.name().toLowerCase();
        return ResponseEntity.status(status).body(new ApiError(codigo, e.getReason()));
    }
}
```

`core/src/main/java/com/smartspace/inbox/DataInitializer.java`:

```java
package com.smartspace.inbox;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.agent.AgentRepository;
import com.smartspace.inbox.agent.Role;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    // O hash BCrypt nasce aqui em vez de ficar fixo numa migracao: hash
    // commitado envelhece e ninguem sabe qual senha ele guarda.
    @Bean
    ApplicationRunner seedAgents(AgentRepository agents, PasswordEncoder encoder) {
        return args -> {
            if (agents.count() > 0) {
                return;
            }
            String senha = encoder.encode("senha123");
            agents.save(new Agent("Agente Demo", "agente@smartspace.test", senha, Role.AGENT));
            agents.save(new Agent("Admin Demo", "admin@smartspace.test", senha, Role.ADMIN));
        };
    }
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd core && ./mvnw -q test -Dtest=AuthControllerIT`
Expected: PASS, quatro testes.

- [ ] **Step 8: Acrescentar o teste de token inválido (Review Focus 3)**

Em `AuthControllerIT`:

```java
    @Test
    void token_invalido_devolve_401_com_json_e_nao_500() throws Exception {
        mvc.perform(get("/api/agents").header("Authorization", "Bearer nao-e-um-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("nao_autenticado"));
    }

    @Test
    void token_assinado_com_outra_chave_devolve_401() throws Exception {
        String outro = io.jsonwebtoken.Jwts.builder()
                .subject("agente@smartspace.test")
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                        "uma-chave-diferente-com-mais-de-32-caracteres".getBytes()))
                .compact();

        mvc.perform(get("/api/agents").header("Authorization", "Bearer " + outro))
                .andExpect(status().isUnauthorized());
    }
```

- [ ] **Step 9: Rodar e ver passar**

Run: `cd core && ./mvnw -q test -Dtest=AuthControllerIT`
Expected: PASS, seis testes.

- [ ] **Step 10: Commit**

```bash
git add core/
git commit -m "feat: autenticacao JWT com BCrypt e dois papeis"
```

---

### Task 4: Core — leitura de conversas (lista e detalhe)

**Files:**
- Create: `core/src/main/java/com/smartspace/inbox/conversation/{ConversationSummary,ConversationDetail,MessageDto,ConversationService,ConversationController}.java`
- Test: `core/src/test/java/com/smartspace/inbox/conversation/ConversationApiIT.java`

**Interfaces:**
- Consumes: entidades e repositórios da Task 2, `AgentDto` e a cadeia de segurança da Task 3.
- Produces:
  - `record MessageDto(Long id, String direction, String body, String deliveryStatus, AgentDto sentByAgent, Instant createdAt)` com `static MessageDto from(Message message)`
  - `record ConversationSummary(Long id, String channel, String status, String contactName, String contactExternalId, AgentDto assignedAgent, String lastMessagePreview, Instant lastMessageAt)`
  - `record ConversationDetail(Long id, String channel, String status, String contactName, String contactExternalId, AgentDto assignedAgent, List<MessageDto> messages)`
  - `ConversationService.list(ConversationStatus status)` — `status` nulo devolve tudo
  - `ConversationService.detail(Long id)` — 404 quando não existe
  - `GET /api/conversations?status=OPEN`, `GET /api/conversations/{id}`

- [ ] **Step 1: Escrever o teste que deve falhar**

`core/src/test/java/com/smartspace/inbox/conversation/ConversationApiIT.java`:

```java
package com.smartspace.inbox.conversation;

import com.smartspace.inbox.contact.Contact;
import com.smartspace.inbox.contact.ContactRepository;
import com.smartspace.inbox.support.PostgresIT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class ConversationApiIT extends PostgresIT {

    @Autowired
    MockMvc mvc;

    @Autowired
    ContactRepository contacts;

    @Autowired
    ConversationRepository conversations;

    String token;

    @BeforeEach
    void autentica() throws Exception {
        String corpo = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"agente@smartspace.test","password":"senha123"}"""))
                .andReturn().getResponse().getContentAsString();
        token = corpo.replaceAll(".*\"token\"\\s*:\\s*\"([^\"]+)\".*", "$1");
    }

    @Test
    void lista_traz_resumo_com_previa_da_ultima_mensagem() throws Exception {
        criarConversaCom("oi, preciso de ajuda");

        mvc.perform(get("/api/conversations").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].channel").value("TELEGRAM"))
                .andExpect(jsonPath("$[0].status").value("OPEN"))
                .andExpect(jsonPath("$[0].lastMessagePreview").value("oi, preciso de ajuda"));
    }

    @Test
    void filtro_por_status_nao_traz_conversa_de_outro_status() throws Exception {
        Conversation resolvida = criarConversaCom("resolvida");
        resolvida.setStatus(ConversationStatus.RESOLVED);
        conversations.save(resolvida);

        mvc.perform(get("/api/conversations?status=OPEN")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + resolvida.getId() + ")]").isEmpty());
    }

    @Test
    void detalhe_traz_as_mensagens_em_ordem() throws Exception {
        Conversation conversa = criarConversaCom("primeira");
        conversa.addMessage(Message.inbound("segunda", "telegram:999"));
        conversations.save(conversa);

        mvc.perform(get("/api/conversations/" + conversa.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages[0].body").value("primeira"))
                .andExpect(jsonPath("$.messages[1].body").value("segunda"));
    }

    @Test
    void detalhe_de_conversa_inexistente_devolve_404() throws Exception {
        mvc.perform(get("/api/conversations/99999").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("not_found"));
    }

    private Conversation criarConversaCom(String texto) {
        Contact contact = contacts.save(new Contact(
                Channel.TELEGRAM, "chat-" + System.nanoTime(), "Cliente Teste"));
        Conversation conversa = new Conversation(contact);
        conversa.addMessage(Message.inbound(texto, "telegram:" + System.nanoTime()));
        return conversations.save(conversa);
    }
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd core && ./mvnw -q test -Dtest=ConversationApiIT`
Expected: FAIL — `/api/conversations` responde 403 ou 404, nenhum controlador existe.

- [ ] **Step 3: Escrever os DTOs**

`MessageDto.java`:

```java
package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.AgentDto;

import java.time.Instant;

public record MessageDto(Long id, String direction, String body, String deliveryStatus,
                         AgentDto sentByAgent, Instant createdAt) {

    public static MessageDto from(Message message) {
        return new MessageDto(
                message.getId(),
                message.getDirection().name(),
                message.getBody(),
                message.getDeliveryStatus().name(),
                message.getSentByAgent() == null ? null : AgentDto.from(message.getSentByAgent()),
                message.getCreatedAt());
    }
}
```

`ConversationSummary.java`:

```java
package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.AgentDto;

import java.time.Instant;

public record ConversationSummary(Long id, String channel, String status, String contactName,
                                  String contactExternalId, AgentDto assignedAgent,
                                  String lastMessagePreview, Instant lastMessageAt) {

    public static ConversationSummary from(Conversation conversation) {
        String previa = conversation.getMessages().isEmpty()
                ? ""
                : conversation.getMessages().get(conversation.getMessages().size() - 1).getBody();
        return new ConversationSummary(
                conversation.getId(),
                conversation.getChannel().name(),
                conversation.getStatus().name(),
                conversation.getContact().getDisplayName(),
                conversation.getContact().getExternalId(),
                conversation.getAssignedAgent() == null
                        ? null : AgentDto.from(conversation.getAssignedAgent()),
                previa,
                conversation.getLastMessageAt());
    }
}
```

`ConversationDetail.java`:

```java
package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.AgentDto;

import java.util.List;

public record ConversationDetail(Long id, String channel, String status, String contactName,
                                 String contactExternalId, AgentDto assignedAgent,
                                 List<MessageDto> messages) {

    public static ConversationDetail from(Conversation conversation) {
        return new ConversationDetail(
                conversation.getId(),
                conversation.getChannel().name(),
                conversation.getStatus().name(),
                conversation.getContact().getDisplayName(),
                conversation.getContact().getExternalId(),
                conversation.getAssignedAgent() == null
                        ? null : AgentDto.from(conversation.getAssignedAgent()),
                conversation.getMessages().stream().map(MessageDto::from).toList());
    }
}
```

- [ ] **Step 4: Escrever `ConversationService` com a leitura**

```java
package com.smartspace.inbox.conversation;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ConversationService {

    private final ConversationRepository conversations;

    public ConversationService(ConversationRepository conversations) {
        this.conversations = conversations;
    }

    @Transactional(readOnly = true)
    public List<ConversationSummary> list(ConversationStatus status) {
        List<Conversation> encontradas = status == null
                ? conversations.findAllByOrderByLastMessageAtDesc()
                : conversations.findByStatusOrderByLastMessageAtDesc(status);
        return encontradas.stream().map(ConversationSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public ConversationDetail detail(Long id) {
        return ConversationDetail.from(buscar(id));
    }

    Conversation buscar(Long id) {
        return conversations.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "conversa " + id + " nao existe"));
    }
}
```

- [ ] **Step 5: Escrever `ConversationController` com a leitura**

```java
package com.smartspace.inbox.conversation;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService service;

    public ConversationController(ConversationService service) {
        this.service = service;
    }

    @GetMapping
    public List<ConversationSummary> list(@RequestParam(required = false) ConversationStatus status) {
        return service.list(status);
    }

    @GetMapping("/{id}")
    public ConversationDetail detail(@PathVariable Long id) {
        return service.detail(id);
    }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd core && ./mvnw -q test -Dtest=ConversationApiIT`
Expected: PASS, quatro testes.

- [ ] **Step 7: Commit**

```bash
git add core/
git commit -m "feat: leitura de conversas e mensagens na API"
```

---

### Task 5: Core — ingestão de mensagem de canal, idempotente

**Files:**
- Create: `core/src/main/java/com/smartspace/inbox/inbound/{InboundController,InboundRequest,InternalTokenFilter}.java`
- Modify: `core/src/main/java/com/smartspace/inbox/conversation/ConversationService.java` (acrescentar `ingest`)
- Test: `core/src/test/java/com/smartspace/inbox/inbound/InboundApiIT.java`

**Interfaces:**
- Consumes: `ConversationService.buscar`, repositórios da Task 2, `ApiError` da Task 3.
- Produces:
  - `record InboundRequest(Channel channel, String externalContactId, String contactName, String externalMessageId, String body)`
  - `ConversationService.ingest(InboundRequest request)` devolve `MessageDto`
  - `POST /internal/inbound` exigindo header `X-Internal-Token`; sem header ou com valor errado, 401
  - Regra: contato é achado por `(channel, externalContactId)` ou criado; a conversa reaproveitada é a mais recente do contato que **não** esteja `RESOLVED`; se não houver, nasce uma nova `OPEN`
  - Regra: `externalMessageId` já visto devolve a mensagem existente sem criar outra

- [ ] **Step 1: Escrever o teste que deve falhar**

`core/src/test/java/com/smartspace/inbox/inbound/InboundApiIT.java`:

```java
package com.smartspace.inbox.inbound;

import com.smartspace.inbox.conversation.ConversationRepository;
import com.smartspace.inbox.conversation.ConversationStatus;
import com.smartspace.inbox.conversation.MessageRepository;
import com.smartspace.inbox.support.PostgresIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class InboundApiIT extends PostgresIT {

    private static final String TOKEN = "token-interno-de-desenvolvimento";

    @Autowired
    MockMvc mvc;

    @Autowired
    ConversationRepository conversations;

    @Autowired
    MessageRepository messages;

    @Test
    void mensagem_de_canal_cria_contato_e_conversa() throws Exception {
        mvc.perform(inbound("chat-100", "telegram:100", "oi, preciso de ajuda"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direction").value("INBOUND"))
                .andExpect(jsonPath("$.body").value("oi, preciso de ajuda"));

        assertThat(conversations.findAllByOrderByLastMessageAtDesc())
                .anySatisfy(conversa -> {
                    assertThat(conversa.getContact().getExternalId()).isEqualTo("chat-100");
                    assertThat(conversa.getStatus()).isEqualTo(ConversationStatus.OPEN);
                });
    }

    @Test
    void segunda_mensagem_do_mesmo_contato_cai_na_mesma_conversa() throws Exception {
        mvc.perform(inbound("chat-200", "telegram:200", "primeira")).andExpect(status().isOk());
        mvc.perform(inbound("chat-200", "telegram:201", "segunda")).andExpect(status().isOk());

        long quantas = conversations.findAllByOrderByLastMessageAtDesc().stream()
                .filter(c -> c.getContact().getExternalId().equals("chat-200"))
                .count();
        assertThat(quantas).isEqualTo(1);
    }

    @Test
    void mensagem_depois_de_resolvida_abre_conversa_nova() throws Exception {
        mvc.perform(inbound("chat-300", "telegram:300", "primeira")).andExpect(status().isOk());

        var conversa = conversations.findAllByOrderByLastMessageAtDesc().stream()
                .filter(c -> c.getContact().getExternalId().equals("chat-300"))
                .findFirst().orElseThrow();
        conversa.setStatus(ConversationStatus.RESOLVED);
        conversations.save(conversa);

        mvc.perform(inbound("chat-300", "telegram:301", "voltei")).andExpect(status().isOk());

        long quantas = conversations.findAllByOrderByLastMessageAtDesc().stream()
                .filter(c -> c.getContact().getExternalId().equals("chat-300"))
                .count();
        assertThat(quantas).isEqualTo(2);
    }

    @Test
    void sem_token_interno_devolve_401() throws Exception {
        mvc.perform(post("/internal/inbound")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"channel":"TELEGRAM","externalContactId":"x",
                                 "externalMessageId":"telegram:1","body":"oi"}"""))
                .andExpect(status().isUnauthorized());
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder inbound(
            String contato, String externalMessageId, String corpo) {
        return post("/internal/inbound")
                .header("X-Internal-Token", TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"channel":"TELEGRAM","externalContactId":"%s","contactName":"Cliente",
                         "externalMessageId":"%s","body":"%s"}"""
                        .formatted(contato, externalMessageId, corpo));
    }
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd core && ./mvnw -q test -Dtest=InboundApiIT`
Expected: FAIL — `/internal/inbound` responde 404.

- [ ] **Step 3: Escrever `InboundRequest`**

```java
package com.smartspace.inbox.inbound;

import com.smartspace.inbox.conversation.Channel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InboundRequest(
        @NotNull Channel channel,
        @NotBlank String externalContactId,
        String contactName,
        @NotBlank String externalMessageId,
        @NotBlank @Size(max = 4096) String body) {
}
```

- [ ] **Step 4: Escrever `InternalTokenFilter`**

```java
package com.smartspace.inbox.inbound;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class InternalTokenFilter extends OncePerRequestFilter {

    private final String expected;

    public InternalTokenFilter(@Value("${inbox.internal-token}") String expected) {
        this.expected = expected;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!expected.equals(request.getHeader("X-Internal-Token"))) {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"error\":\"token_interno_invalido\",\"message\":\"header X-Internal-Token ausente ou incorreto\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
```

- [ ] **Step 5: Acrescentar `ingest` ao `ConversationService` e escrever `InboundController`**

Em `ConversationService`, trocar o construtor e acrescentar o método:

```java
    private final ConversationRepository conversations;
    private final ContactRepository contacts;
    private final MessageRepository messages;

    public ConversationService(ConversationRepository conversations,
                               ContactRepository contacts,
                               MessageRepository messages) {
        this.conversations = conversations;
        this.contacts = contacts;
        this.messages = messages;
    }

    @Transactional
    public MessageDto ingest(InboundRequest request) {
        // Telegram reentrega o webhook quando nao recebe 200 rapido. Devolver a
        // mensagem que ja existe e mais barato que tratar violacao de unique, e
        // o gateway recebe a mesma resposta nas duas entregas.
        var repetida = messages.findByExternalId(request.externalMessageId());
        if (repetida.isPresent()) {
            return MessageDto.from(repetida.get());
        }

        Contact contact = contacts
                .findByChannelAndExternalId(request.channel(), request.externalContactId())
                .orElseGet(() -> contacts.save(new Contact(
                        request.channel(), request.externalContactId(), request.contactName())));

        Conversation conversation = conversations
                .findFirstByContactAndStatusNotOrderByLastMessageAtDesc(
                        contact, ConversationStatus.RESOLVED)
                .orElseGet(() -> new Conversation(contact));

        Message message = Message.inbound(request.body(), request.externalMessageId());
        conversation.addMessage(message);
        conversations.save(conversation);
        return MessageDto.from(message);
    }
```

Imports a acrescentar: `com.smartspace.inbox.contact.Contact`, `com.smartspace.inbox.contact.ContactRepository`, `com.smartspace.inbox.inbound.InboundRequest`.

`InboundController.java`:

```java
package com.smartspace.inbox.inbound;

import com.smartspace.inbox.conversation.ConversationService;
import com.smartspace.inbox.conversation.MessageDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/inbound")
public class InboundController {

    private final ConversationService service;

    public InboundController(ConversationService service) {
        this.service = service;
    }

    @PostMapping
    public MessageDto ingest(@Valid @RequestBody InboundRequest request) {
        return service.ingest(request);
    }
}
```

- [ ] **Step 6: Acrescentar o teste de entrega duplicada (Review Focus 2)**

Em `InboundApiIT`:

```java
    @Test
    void reentrega_do_mesmo_external_id_nao_duplica_mensagem() throws Exception {
        mvc.perform(inbound("chat-400", "telegram:400", "oi")).andExpect(status().isOk());
        mvc.perform(inbound("chat-400", "telegram:400", "oi")).andExpect(status().isOk());

        var conversa = conversations.findAllByOrderByLastMessageAtDesc().stream()
                .filter(c -> c.getContact().getExternalId().equals("chat-400"))
                .findFirst().orElseThrow();

        assertThat(conversa.getMessages()).hasSize(1);
    }

    @Test
    void corpo_vazio_devolve_400_e_nao_cria_conversa() throws Exception {
        mvc.perform(inbound("chat-500", "telegram:500", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("requisicao_invalida"));

        assertThat(conversations.findAllByOrderByLastMessageAtDesc())
                .noneMatch(c -> c.getContact().getExternalId().equals("chat-500"));
    }
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd core && ./mvnw -q test -Dtest=InboundApiIT`
Expected: PASS, seis testes. Rodar a suíte inteira: `./mvnw -q test` — PASS.

- [ ] **Step 8: Commit**

```bash
git add core/
git commit -m "feat: ingestao idempotente de mensagem de canal"
```

---

### Task 6: Core — responder, atribuir, resolver, e despacho ao gateway

**Files:**
- Create: `core/src/main/java/com/smartspace/inbox/gateway/GatewayClient.java`
- Create: `core/src/main/java/com/smartspace/inbox/conversation/{ReplyRequest,AssignRequest,StatusRequest,ReplyPrepared}.java`
- Modify: `core/src/main/java/com/smartspace/inbox/conversation/ConversationService.java`
- Modify: `core/src/main/java/com/smartspace/inbox/conversation/ConversationController.java`
- Test: `core/src/test/java/com/smartspace/inbox/conversation/ConversationServiceTest.java`
- Test: modificar `core/src/test/java/com/smartspace/inbox/conversation/ConversationApiIT.java`

**Interfaces:**
- Consumes: tudo das Tasks 2 a 5.
- Produces:
  - `record ReplyRequest(@NotBlank @Size(max = 4096) String body)`
  - `record AssignRequest(@NotNull Long agentId)`
  - `record StatusRequest(@NotNull ConversationStatus status)`
  - `record ReplyPrepared(MessageDto message, Channel channel, String externalContactId)`
  - `GatewayClient.dispatch(Channel channel, String externalContactId, String body)` → `boolean`, nunca lança
  - `ConversationService.persistReply(Long conversationId, ReplyRequest request, Agent agent)` → `ReplyPrepared`
  - `ConversationService.markDelivery(Long messageId, DeliveryStatus status)` → `MessageDto`
  - `ConversationService.assign(Long conversationId, Long agentId)` → `ConversationDetail`
  - `ConversationService.changeStatus(Long conversationId, ConversationStatus status)` → `ConversationDetail`
  - `POST /api/conversations/{id}/messages`, `PATCH /api/conversations/{id}/assign`, `PATCH /api/conversations/{id}/status`

- [ ] **Step 1: Escrever o teste de regra de domínio, sem banco**

`core/src/test/java/com/smartspace/inbox/conversation/ConversationServiceTest.java`:

```java
package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.agent.AgentRepository;
import com.smartspace.inbox.agent.Role;
import com.smartspace.inbox.contact.Contact;
import com.smartspace.inbox.contact.ContactRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConversationServiceTest {

    ConversationRepository conversations = mock(ConversationRepository.class);
    ContactRepository contacts = mock(ContactRepository.class);
    MessageRepository messages = mock(MessageRepository.class);
    AgentRepository agents = mock(AgentRepository.class);

    ConversationService service;
    Conversation conversa;
    Agent agente;

    @BeforeEach
    void preparar() {
        service = new ConversationService(conversations, contacts, messages, agents);
        conversa = new Conversation(new Contact(Channel.TELEGRAM, "chat-1", "Cliente"));
        agente = new Agent("Agente Demo", "agente@smartspace.test", "hash", Role.AGENT);
        when(conversations.findById(1L)).thenReturn(Optional.of(conversa));
        when(conversations.save(any(Conversation.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void atribuir_grava_o_agente_na_conversa() {
        when(agents.findById(7L)).thenReturn(Optional.of(agente));

        ConversationDetail resultado = service.assign(1L, 7L);

        assertThat(resultado.assignedAgent().email()).isEqualTo("agente@smartspace.test");
        assertThat(conversa.getAssignedAgent()).isSameAs(agente);
    }

    @Test
    void atribuir_a_agente_inexistente_recusa() {
        when(agents.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assign(1L, 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("agente 99 nao existe");

        assertThat(conversa.getAssignedAgent()).isNull();
    }

    @Test
    void resolver_muda_o_status() {
        ConversationDetail resultado = service.changeStatus(1L, ConversationStatus.RESOLVED);

        assertThat(resultado.status()).isEqualTo("RESOLVED");
        assertThat(conversa.getStatus()).isEqualTo(ConversationStatus.RESOLVED);
    }

    @Test
    void responder_nasce_pendente_de_entrega_e_atualiza_a_conversa() {
        ReplyPrepared preparada = service.persistReply(1L, new ReplyRequest("ja estou vendo"), agente);

        assertThat(preparada.message().direction()).isEqualTo("OUTBOUND");
        assertThat(preparada.message().deliveryStatus()).isEqualTo("PENDING");
        assertThat(preparada.channel()).isEqualTo(Channel.TELEGRAM);
        assertThat(preparada.externalContactId()).isEqualTo("chat-1");
        assertThat(conversa.getMessages()).hasSize(1);
    }
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd core && ./mvnw -q test -Dtest=ConversationServiceTest`
Expected: FAIL de compilação — `ReplyRequest`, `ReplyPrepared`, `assign`, `changeStatus` e `persistReply` não existem.

- [ ] **Step 3: Acrescentar o teste de corpo inválido (Review Focus 4) ao `ConversationApiIT`**

```java
    @Test
    void responder_com_corpo_vazio_devolve_400() throws Exception {
        Conversation conversa = criarConversaCom("oi");

        mvc.perform(post("/api/conversations/" + conversa.getId() + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"   "}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("requisicao_invalida"));
    }

    @Test
    void responder_acima_de_4096_caracteres_devolve_400() throws Exception {
        Conversation conversa = criarConversaCom("oi");
        String gigante = "a".repeat(4097);

        mvc.perform(post("/api/conversations/" + conversa.getId() + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + gigante + "\"}"))
                .andExpect(status().isBadRequest());
    }
```

`@NotBlank` já recusa `"   "`, porque considera string só de espaço em branco como vazia.

- [ ] **Step 4: Escrever os records de requisição**

`ReplyRequest.java`:

```java
package com.smartspace.inbox.conversation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReplyRequest(@NotBlank @Size(max = 4096) String body) {
}
```

`AssignRequest.java`:

```java
package com.smartspace.inbox.conversation;

import jakarta.validation.constraints.NotNull;

public record AssignRequest(@NotNull Long agentId) {
}
```

`StatusRequest.java`:

```java
package com.smartspace.inbox.conversation;

import jakarta.validation.constraints.NotNull;

public record StatusRequest(@NotNull ConversationStatus status) {
}
```

`ReplyPrepared.java`:

```java
package com.smartspace.inbox.conversation;

public record ReplyPrepared(MessageDto message, Channel channel, String externalContactId) {
}
```

- [ ] **Step 5: Escrever `GatewayClient`**

```java
package com.smartspace.inbox.gateway;

import com.smartspace.inbox.conversation.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class GatewayClient {

    private static final Logger log = LoggerFactory.getLogger(GatewayClient.class);

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private final String gatewayUrl;
    private final String internalToken;

    public GatewayClient(@Value("${inbox.gateway-url}") String gatewayUrl,
                         @Value("${inbox.internal-token}") String internalToken) {
        this.gatewayUrl = gatewayUrl;
        this.internalToken = internalToken;
    }

    // Devolve boolean em vez de lancar: quem chama precisa gravar FAILED na
    // mensagem que ja esta no banco, e excecao atravessando a transacao
    // apagaria exatamente o registro que o agente precisa ver.
    public boolean dispatch(Channel channel, String externalContactId, String body) {
        String json = """
                {"channel":"%s","externalContactId":"%s","body":%s}"""
                .formatted(channel.name(), externalContactId, quote(body));
        HttpRequest request = HttpRequest.newBuilder(URI.create(gatewayUrl + "/internal/dispatch"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .header("X-Internal-Token", internalToken)
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return true;
            }
            log.warn("gateway recusou o despacho: {} {}", response.statusCode(), response.body());
            return false;
        } catch (Exception e) {
            log.warn("gateway inacessivel: {}", e.getMessage());
            return false;
        }
    }

    private static String quote(String texto) {
        return "\"" + texto
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t") + "\"";
    }
}
```

- [ ] **Step 6: Acrescentar escrita ao `ConversationService`**

Trocar o construtor para receber `AgentRepository` e acrescentar:

```java
    @Transactional
    public ReplyPrepared persistReply(Long conversationId, ReplyRequest request, Agent agent) {
        Conversation conversation = buscar(conversationId);
        Message message = Message.outbound(request.body(), agent);
        conversation.addMessage(message);
        conversations.save(conversation);
        return new ReplyPrepared(
                MessageDto.from(message),
                conversation.getChannel(),
                conversation.getContact().getExternalId());
    }

    @Transactional
    public MessageDto markDelivery(Long messageId, DeliveryStatus status) {
        Message message = messages.findById(messageId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "mensagem " + messageId + " nao existe"));
        message.setDeliveryStatus(status);
        messages.save(message);
        return MessageDto.from(message);
    }

    @Transactional
    public ConversationDetail assign(Long conversationId, Long agentId) {
        Conversation conversation = buscar(conversationId);
        Agent agent = agents.findById(agentId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "agente " + agentId + " nao existe"));
        conversation.setAssignedAgent(agent);
        return ConversationDetail.from(conversations.save(conversation));
    }

    @Transactional
    public ConversationDetail changeStatus(Long conversationId, ConversationStatus status) {
        Conversation conversation = buscar(conversationId);
        conversation.setStatus(status);
        return ConversationDetail.from(conversations.save(conversation));
    }
```

- [ ] **Step 7: Acrescentar as rotas de escrita ao `ConversationController`**

```java
    private final ConversationService service;
    private final GatewayClient gateway;

    public ConversationController(ConversationService service, GatewayClient gateway) {
        this.service = service;
        this.gateway = gateway;
    }

    // A orquestracao vive no controlador de proposito. Chamar o gateway de dentro
    // de um metodo @Transactional seguraria a conexao do banco durante um HTTP
    // externo; e chamar um metodo @Transactional do mesmo bean nao passa pelo
    // proxy do Spring, entao a transacao nem existiria.
    @PostMapping("/{id}/messages")
    public ResponseEntity<MessageDto> reply(@PathVariable Long id,
                                            @Valid @RequestBody ReplyRequest request,
                                            @AuthenticationPrincipal Agent agent) {
        ReplyPrepared preparada = service.persistReply(id, request, agent);

        boolean entregue = gateway.dispatch(
                preparada.channel(), preparada.externalContactId(), request.body());

        MessageDto salva = service.markDelivery(
                preparada.message().id(), entregue ? DeliveryStatus.SENT : DeliveryStatus.FAILED);

        HttpStatus status = entregue ? HttpStatus.CREATED : HttpStatus.BAD_GATEWAY;
        return ResponseEntity.status(status).body(salva);
    }

    @PatchMapping("/{id}/assign")
    public ConversationDetail assign(@PathVariable Long id, @Valid @RequestBody AssignRequest request) {
        return service.assign(id, request.agentId());
    }

    @PatchMapping("/{id}/status")
    public ConversationDetail status(@PathVariable Long id, @Valid @RequestBody StatusRequest request) {
        return service.changeStatus(id, request.status());
    }
```

Imports a acrescentar: `com.smartspace.inbox.agent.Agent`, `com.smartspace.inbox.gateway.GatewayClient`, `jakarta.validation.Valid`, `org.springframework.http.HttpStatus`, `org.springframework.http.ResponseEntity`, `org.springframework.security.core.annotation.AuthenticationPrincipal`.

`@AuthenticationPrincipal Agent agent` funciona porque o `JwtAuthFilter` da Task 3 coloca a entidade `Agent` como principal.

- [ ] **Step 8: Rodar e ver passar**

Run: `cd core && ./mvnw -q test`
Expected: PASS. `ConversationServiceTest` com quatro testes.

Prova de que o teste de domínio não é vazio: trocar `conversation.setAssignedAgent(agent)` por `conversation.setAssignedAgent(null)` em `assign` e rodar de novo — `atribuir_grava_o_agente_na_conversa` deve falhar. Restaurar.

- [ ] **Step 9: Acrescentar o teste de gateway fora do ar (Review Focus 5)**

Em `ConversationApiIT`, acrescentar o campo e o teste. O gateway não existe nos testes, então todo despacho falha de verdade — é o cenário que se quer provar.

```java
    @Test
    void gateway_fora_do_ar_salva_a_mensagem_como_falha_e_devolve_502() throws Exception {
        Conversation conversa = criarConversaCom("oi");

        mvc.perform(post("/api/conversations/" + conversa.getId() + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"ja estou vendo"}"""))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.deliveryStatus").value("FAILED"))
                .andExpect(jsonPath("$.body").value("ja estou vendo"));

        mvc.perform(get("/api/conversations/" + conversa.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.messages[1].body").value("ja estou vendo"))
                .andExpect(jsonPath("$.messages[1].deliveryStatus").value("FAILED"));
    }

    @Test
    void atribuir_e_resolver_persistem() throws Exception {
        Conversation conversa = criarConversaCom("oi");
        Long agenteId = agents.findByEmail("agente@smartspace.test").orElseThrow().getId();

        mvc.perform(patch("/api/conversations/" + conversa.getId() + "/assign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"agentId\":" + agenteId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedAgent.name").value("Agente Demo"));

        mvc.perform(patch("/api/conversations/" + conversa.getId() + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"RESOLVED"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"));

        mvc.perform(get("/api/conversations/" + conversa.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.status").value("RESOLVED"))
                .andExpect(jsonPath("$.assignedAgent.email").value("agente@smartspace.test"));
    }
```

Acrescentar ao topo da classe `@Autowired AgentRepository agents;` e os imports `com.smartspace.inbox.agent.AgentRepository` e `org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch`.

- [ ] **Step 10: Rodar a suíte inteira e ver passar**

Run: `cd core && ./mvnw -q test`
Expected: PASS, nenhuma falha.

- [ ] **Step 11: Commit**

```bash
git add core/
git commit -m "feat: responder, atribuir e resolver conversa com despacho ao gateway"
```

---

### Task 7: Gateway — Fastify, contrato de canal e canais simulados

**Files:**
- Create: `gateway/package.json`, `gateway/tsconfig.json`, `gateway/vitest.config.ts`
- Create: `gateway/src/{env.ts,server.ts,core-client.ts,realtime.ts}`
- Create: `gateway/src/channels/{types.ts,simulated.ts,registry.ts}`
- Test: `gateway/test/{channels.test.ts,routes.test.ts}`

**Interfaces:**
- Consumes: `POST /internal/inbound` do core (Task 5).
- Produces:
  - `type Channel = "TELEGRAM" | "WHATSAPP" | "EMAIL"`
  - `interface InboundMessage { channel, externalContactId, contactName, externalMessageId, body }`
  - `interface ChannelAdapter { channel; parseWebhook(payload: unknown): InboundMessage | null; send(externalContactId: string, body: string): Promise<void>; outbox?: Array<{ to: string; body: string }> }`
  - `buildServer(): FastifyInstance` exportada para o teste usar `server.inject`
  - `POST /webhooks/:channel`, `POST /internal/dispatch`, `GET /health`, `GET /simulated/outbox`
  - Telegram entra na Task 8; aqui o registry tem só WhatsApp e e-mail

- [ ] **Step 1: Criar o pacote**

```bash
mkdir -p gateway/src/channels gateway/test
cd gateway
npm init -y
npm pkg set type=module main=dist/server.js
npm pkg set scripts.dev="tsx watch src/server.ts" scripts.build="tsc" scripts.start="node dist/server.js" scripts.test="vitest run" scripts.lint="tsc --noEmit"
npm install fastify @fastify/websocket @fastify/cors
npm install -D typescript tsx vitest @types/node
```

`gateway/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`gateway/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 2: Escrever o teste de contrato que deve falhar**

`gateway/test/channels.test.ts`:

```ts
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
```

- [ ] **Step 3: Escrever o teste de rota que deve falhar (Review Focus 1)**

`gateway/test/routes.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

process.env.INTERNAL_TOKEN = "token-de-teste";
process.env.CORE_URL = "http://core.invalido";

const { buildServer } = await import("../src/server.js");

describe("rotas do gateway", () => {
  let server: FastifyInstance;
  let chamadasAoCore: number;

  beforeEach(async () => {
    chamadasAoCore = 0;
    vi.stubGlobal("fetch", async () => {
      chamadasAoCore += 1;
      return new Response(
        JSON.stringify({ id: 1, direction: "INBOUND", body: "oi", deliveryStatus: "SENT" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    server = buildServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    vi.unstubAllGlobals();
  });

  it("webhook valido repassa ao core", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      payload: { from: "+5511999999999", text: "oi" },
    });

    expect(resposta.statusCode).toBe(200);
    expect(chamadasAoCore).toBe(1);
  });

  it("webhook sem texto responde 200 e nao chama o core", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      payload: { from: "+5511999999999" },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ignored: true });
    expect(chamadasAoCore).toBe(0);
  });

  it("webhook de canal desconhecido responde 404", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/webhooks/fax",
      payload: { from: "x", text: "y" },
    });

    expect(resposta.statusCode).toBe(404);
  });

  it("dispatch sem token interno responde 401", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/internal/dispatch",
      payload: { channel: "WHATSAPP", externalContactId: "+5511999999999", body: "oi" },
    });

    expect(resposta.statusCode).toBe(401);
  });

  it("dispatch com token entrega pelo adapter do canal", async () => {
    const resposta = await server.inject({
      method: "POST",
      url: "/internal/dispatch",
      headers: { "x-internal-token": "token-de-teste" },
      payload: { channel: "WHATSAPP", externalContactId: "+5511999999999", body: "ja estou vendo" },
    });

    expect(resposta.statusCode).toBe(200);

    const outbox = await server.inject({ method: "GET", url: "/simulated/outbox" });
    expect(outbox.json()).toContainEqual({
      channel: "WHATSAPP",
      to: "+5511999999999",
      body: "ja estou vendo",
    });
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd gateway && npm test`
Expected: FAIL — `Cannot find module '../src/server.js'`.

- [ ] **Step 5: Escrever `env.ts`**

```ts
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
```

- [ ] **Step 6: Escrever `channels/types.ts` — o contrato**

```ts
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

  /** Só os canais simulados preenchem: e onde o avaliador ve a resposta "entregue". */
  outbox?: Array<{ to: string; body: string }>;
}
```

- [ ] **Step 7: Escrever `channels/simulated.ts`**

```ts
import { randomUUID } from "node:crypto";
import type { Channel, ChannelAdapter } from "./types.js";

interface SimulatedPayload {
  from?: unknown;
  text?: unknown;
  name?: unknown;
}

// WhatsApp Business API e e-mail reais exigem credencial e aprovacao que nao
// cabem no prazo. Entram pelo mesmo contrato do Telegram de proposito: trocar
// este adapter por um real nao toca uma linha do core.
export function simulatedAdapter(channel: Channel): ChannelAdapter {
  const outbox: Array<{ to: string; body: string }> = [];

  return {
    channel,

    parseWebhook(payload) {
      const corpo = payload as SimulatedPayload | null;
      const from = corpo?.from;
      const text = corpo?.text;
      if (typeof from !== "string" || from.trim() === "") return null;
      if (typeof text !== "string" || text.trim() === "") return null;

      return {
        channel,
        externalContactId: from,
        contactName: typeof corpo?.name === "string" ? corpo.name : null,
        externalMessageId: `${channel.toLowerCase()}:${randomUUID()}`,
        body: text,
      };
    },

    async send(externalContactId, body) {
      outbox.push({ to: externalContactId, body });
    },

    outbox,
  };
}
```

- [ ] **Step 8: Escrever `channels/registry.ts`**

```ts
import { simulatedAdapter } from "./simulated.js";
import type { Channel, ChannelAdapter } from "./types.js";

const adapters = new Map<Channel, ChannelAdapter>([
  ["WHATSAPP", simulatedAdapter("WHATSAPP")],
  ["EMAIL", simulatedAdapter("EMAIL")],
]);

export function registerAdapter(adapter: ChannelAdapter): void {
  adapters.set(adapter.channel, adapter);
}

export function adapterFor(slug: string): ChannelAdapter | undefined {
  return adapters.get(slug.toUpperCase() as Channel);
}

export function allAdapters(): ChannelAdapter[] {
  return [...adapters.values()];
}
```

- [ ] **Step 9: Escrever `core-client.ts`**

```ts
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
```

- [ ] **Step 10: Escrever `realtime.ts`**

```ts
import type { WebSocket } from "@fastify/websocket";

const clientes = new Set<WebSocket>();

export function addClient(socket: WebSocket): void {
  clientes.add(socket);
  socket.on("close", () => clientes.delete(socket));
}

export function broadcast(evento: unknown): void {
  const payload = JSON.stringify(evento);
  for (const socket of clientes) {
    // readyState 1 e OPEN. Um socket meio fechado derruba o send e levaria o
    // webhook inteiro com ele se nao fosse filtrado aqui.
    if (socket.readyState === 1) {
      socket.send(payload);
    }
  }
}

export function clientCount(): number {
  return clientes.size;
}
```

- [ ] **Step 11: Escrever `server.ts`**

```ts
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { env } from "./env.js";
import { adapterFor, allAdapters } from "./channels/registry.js";
import { ingest } from "./core-client.js";
import { addClient, broadcast } from "./realtime.js";

interface DispatchBody {
  channel?: string;
  externalContactId?: string;
  body?: string;
}

export function buildServer(): FastifyInstance {
  const server = Fastify({ logger: true });

  server.register(cors, { origin: true });
  server.register(websocket);

  server.get("/health", async () => ({ status: "ok" }));

  server.register(async (instance) => {
    instance.get("/ws", { websocket: true }, (connection) => {
      addClient(connection.socket ?? (connection as unknown as never));
    });
  });

  server.post<{ Params: { channel: string } }>("/webhooks/:channel", async (request, reply) => {
    const adapter = adapterFor(request.params.channel);
    if (!adapter) {
      return reply.status(404).send({ error: "canal_desconhecido" });
    }

    const mensagem = adapter.parseWebhook(request.body);
    // Canal manda muito mais que texto. Responder 200 e ignorar e o contrato:
    // 4xx faz o Telegram reentregar o mesmo update para sempre.
    if (!mensagem) {
      return reply.status(200).send({ ignored: true });
    }

    const salva = await ingest(mensagem);
    broadcast({ type: "inbound", channel: mensagem.channel, message: salva });
    return reply.status(200).send({ ok: true });
  });

  server.post<{ Body: DispatchBody }>("/internal/dispatch", async (request, reply) => {
    if (request.headers["x-internal-token"] !== env.internalToken) {
      return reply.status(401).send({ error: "token_interno_invalido" });
    }

    const { channel, externalContactId, body } = request.body ?? {};
    if (!channel || !externalContactId || !body) {
      return reply.status(400).send({ error: "campos_obrigatorios_ausentes" });
    }

    const adapter = adapterFor(channel);
    if (!adapter) {
      return reply.status(404).send({ error: "canal_desconhecido" });
    }

    await adapter.send(externalContactId, body);
    broadcast({ type: "outbound", channel: adapter.channel, body });
    return reply.status(200).send({ ok: true });
  });

  server.get("/simulated/outbox", async () =>
    allAdapters().flatMap((adapter) =>
      (adapter.outbox ?? []).map((enviada) => ({ channel: adapter.channel, ...enviada })),
    ),
  );

  return server;
}

// Só sobe o servidor quando este arquivo e o ponto de entrada; o teste importa
// buildServer e usa server.inject, sem abrir porta.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop()!)) {
  const server = buildServer();
  server.listen({ port: env.port, host: "0.0.0.0" }).catch((erro) => {
    server.log.error(erro);
    process.exit(1);
  });
}
```

- [ ] **Step 12: Rodar e ver passar**

Run: `cd gateway && npm test`
Expected: PASS, oito testes nos dois arquivos.

Se o guard do `import.meta.url` no final do `server.ts` atrapalhar o teste, trocar por um `src/main.ts` separado que só chama `buildServer().listen(...)`, e apontar `scripts.start` e o `Dockerfile` para ele. A regra é: o teste importa o servidor sem abrir porta.

- [ ] **Step 13: Commit**

```bash
git add gateway/
git commit -m "feat: gateway de canais com contrato unico e canais simulados"
```

---

### Task 8: Gateway — Telegram real e WebSocket ao vivo

**Files:**
- Create: `gateway/src/channels/telegram.ts`
- Modify: `gateway/src/channels/registry.ts`, `gateway/src/server.ts`
- Test: `gateway/test/telegram.test.ts`

**Interfaces:**
- Consumes: `ChannelAdapter` e `registry` da Task 7.
- Produces:
  - `telegramAdapter: ChannelAdapter` registrado quando `TELEGRAM_BOT_TOKEN` existe
  - `POST /webhooks/telegram` aceitando o `update` cru do Telegram
  - `GET /channels` listando quais canais estão ativos, para o front-end avisar quando o Telegram está desligado

- [ ] **Step 1: Escrever o teste que deve falhar**

`gateway/test/telegram.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.INTERNAL_TOKEN = "token-de-teste";
process.env.TELEGRAM_BOT_TOKEN = "123:fake";

const { telegramAdapter } = await import("../src/channels/telegram.js");

describe("adapter do Telegram", () => {
  it("traduz update de texto", () => {
    const resultado = telegramAdapter.parseWebhook({
      update_id: 4812,
      message: {
        message_id: 7,
        text: "oi, preciso de ajuda",
        chat: { id: 55512345 },
        from: { first_name: "Maria", last_name: "Silva" },
      },
    });

    expect(resultado).toEqual({
      channel: "TELEGRAM",
      externalContactId: "55512345",
      contactName: "Maria Silva",
      externalMessageId: "telegram:4812",
      body: "oi, preciso de ajuda",
    });
  });

  it("ignora update que nao e mensagem de texto", () => {
    expect(telegramAdapter.parseWebhook({ update_id: 1 })).toBeNull();
    expect(telegramAdapter.parseWebhook({
      update_id: 2,
      message: { chat: { id: 1 }, sticker: { emoji: "🙂" } },
    })).toBeNull();
    expect(telegramAdapter.parseWebhook({
      update_id: 3,
      my_chat_member: { chat: { id: 1 } },
    })).toBeNull();
    expect(telegramAdapter.parseWebhook({
      update_id: 4,
      message: { chat: { id: 1 }, text: "   " },
    })).toBeNull();
  });

  it("send chama a API do Telegram com chat_id e texto", async () => {
    const chamadas: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      chamadas.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("{\"ok\":true}", { status: 200 });
    });

    await telegramAdapter.send("55512345", "ja estou vendo");

    expect(chamadas[0]?.url).toContain("/bot123:fake/sendMessage");
    expect(chamadas[0]?.body).toEqual({ chat_id: "55512345", text: "ja estou vendo" });
    vi.unstubAllGlobals();
  });

  it("send propaga erro quando o Telegram recusa", async () => {
    vi.stubGlobal("fetch", async () => new Response("chat not found", { status: 400 }));

    await expect(telegramAdapter.send("000", "oi")).rejects.toThrow("Telegram respondeu 400");
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd gateway && npm test -- telegram`
Expected: FAIL — `Cannot find module '../src/channels/telegram.js'`.

- [ ] **Step 3: Escrever `channels/telegram.ts`**

```ts
import { env } from "../env.js";
import type { ChannelAdapter } from "./types.js";

interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: unknown;
    chat?: { id?: unknown };
    from?: { first_name?: unknown; last_name?: unknown };
  };
}

export const telegramAdapter: ChannelAdapter = {
  channel: "TELEGRAM",

  parseWebhook(payload) {
    const update = payload as TelegramUpdate | null;
    const mensagem = update?.message;
    const chatId = mensagem?.chat?.id;
    const texto = mensagem?.text;

    // Telegram manda update de muitos tipos pelo mesmo webhook: sticker, foto,
    // entrada em grupo, edicao. So texto com chat vira mensagem no inbox.
    if (typeof chatId !== "number" && typeof chatId !== "string") return null;
    if (typeof texto !== "string" || texto.trim() === "") return null;

    const nome = [mensagem?.from?.first_name, mensagem?.from?.last_name]
      .filter((parte): parte is string => typeof parte === "string" && parte !== "")
      .join(" ");

    return {
      channel: "TELEGRAM",
      externalContactId: String(chatId),
      contactName: nome === "" ? null : nome,
      externalMessageId: `telegram:${update?.update_id ?? mensagem?.message_id}`,
      body: texto,
    };
  },

  async send(externalContactId, body) {
    if (!env.telegramBotToken) {
      throw new Error("TELEGRAM_BOT_TOKEN ausente: canal Telegram desligado");
    }

    const resposta = await fetch(
      `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: externalContactId, text: body }),
      },
    );

    if (!resposta.ok) {
      throw new Error(`Telegram respondeu ${resposta.status}: ${await resposta.text()}`);
    }
  },
};
```

- [ ] **Step 4: Registrar o Telegram só quando houver token**

Em `gateway/src/channels/registry.ts`, acrescentar ao final:

```ts
import { env } from "../env.js";
import { telegramAdapter } from "./telegram.js";

// Sem token o canal nao entra no registry: webhook do Telegram passa a
// responder 404 em vez de estourar na hora de enviar.
if (env.telegramBotToken) {
  adapters.set("TELEGRAM", telegramAdapter);
}
```

- [ ] **Step 5: Acrescentar `GET /channels` ao `server.ts`**

```ts
  server.get("/channels", async () =>
    allAdapters().map((adapter) => ({
      channel: adapter.channel,
      simulated: adapter.outbox !== undefined,
    })),
  );
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd gateway && npm test`
Expected: PASS, doze testes.

- [ ] **Step 7: Registrar o webhook no Telegram e provar ponta a ponta**

Criar o bot no `@BotFather`, pegar o token, pôr em `.env`. Expor a porta 3000 com um túnel:

```bash
npx --yes localtunnel --port 3000
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=<url-do-tunel>/webhooks/telegram"
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`

Mandar mensagem ao bot pelo app e conferir que ela aparece em `GET /api/conversations`.

- [ ] **Step 8: Commit**

```bash
git add gateway/
git commit -m "feat: canal Telegram real e difusao por WebSocket"
```

---

### Task 9: Web — Vite, Bootstrap, login e sessão

**Files:**
- Create: `web/` via Vite, `web/src/{api.ts,auth.tsx,styles.css,App.tsx,main.tsx}`, `web/src/pages/Login.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login` (Task 3).
- Produces:
  - `api.ts`: `get<T>(path)`, `post<T>(path, body)`, `patch<T>(path, body)`, `setToken(token | null)`, `ApiError` com `status` e `message`
  - `auth.tsx`: `AuthProvider`, `useAuth()` devolvendo `{ agent, login, logout, loading }`
  - Token e agente persistidos em `localStorage` sob a chave `inbox.session`
  - `App.tsx` mostra `Login` quando não há sessão e `Inbox` (Task 10) quando há

- [ ] **Step 1: Criar o pacote**

```bash
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install bootstrap bootstrap-icons
npm pkg set scripts.lint="tsc --noEmit"
```

`web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: { port: 5173, host: true },
  // Em producao o nginx serve os estaticos e o navegador fala direto com o core
  // pela VITE_API_URL; o proxy aqui e so para o dev nao tropecar em CORS.
  define: {},
  plugins: [react()],
});
```

- [ ] **Step 2: Escrever `src/api.ts`**

```ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

let token: string | null = null;

export function setToken(novo: string | null): void {
  token = novo;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const resposta = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (resposta.status === 204) {
    return undefined as T;
  }

  const texto = await resposta.text();
  const dados = texto === "" ? null : JSON.parse(texto);

  // 502 e resposta de negocio aqui: a mensagem foi salva mas nao entregue, e o
  // corpo traz a mensagem com deliveryStatus FAILED para a tela mostrar.
  if (!resposta.ok && resposta.status !== 502) {
    throw new ApiError(resposta.status, dados?.message ?? `erro ${resposta.status}`);
  }
  return dados as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
};
```

- [ ] **Step 3: Escrever `src/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setToken } from "./api";

export interface Agent {
  id: number;
  name: string;
  email: string;
  role: "AGENT" | "ADMIN";
}

interface Session {
  token: string;
  agent: Agent;
}

interface AuthValue {
  agent: Agent | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const CHAVE = "inbox.session";
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const guardada = localStorage.getItem(CHAVE);
    return guardada === null ? null : (JSON.parse(guardada) as Session);
  });
  const [loading, setLoading] = useState(false);

  // O api.ts guarda o token em modulo, nao em estado do React. Este efeito e o
  // que mantem os dois em sincronia inclusive no recarregamento da pagina.
  useEffect(() => {
    setToken(session?.token ?? null);
  }, [session]);

  const value = useMemo<AuthValue>(() => ({
    agent: session?.agent ?? null,
    loading,
    async login(email, password) {
      setLoading(true);
      try {
        const nova = await api.post<Session>("/api/auth/login", { email, password });
        localStorage.setItem(CHAVE, JSON.stringify(nova));
        setSession(nova);
      } finally {
        setLoading(false);
      }
    },
    logout() {
      localStorage.removeItem(CHAVE);
      setSession(null);
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const valor = useContext(AuthContext);
  if (valor === null) {
    throw new Error("useAuth fora do AuthProvider");
  }
  return valor;
}
```

- [ ] **Step 4: Escrever `src/pages/Login.tsx`**

```tsx
import { useState } from "react";
import { useAuth } from "../auth";
import { ApiError } from "../api";

export function Login() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("agente@smartspace.test");
  const [password, setPassword] = useState("senha123");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    try {
      await login(email, password);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "nao foi possivel entrar");
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-body-tertiary">
      <form className="card shadow-sm p-4" style={{ width: "min(26rem, 92vw)" }} onSubmit={enviar}>
        <h1 className="h4 mb-1">Inbox Omnichannel</h1>
        <p className="text-body-secondary small mb-4">Entre para atender as conversas.</p>

        <div className="mb-3">
          <label className="form-label" htmlFor="email">E-mail</label>
          <input id="email" type="email" className="form-control" required
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="senha">Senha</label>
          <input id="senha" type="password" className="form-control" required
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {erro !== null && <div className="alert alert-danger py-2 small">{erro}</div>}

        <button className="btn btn-primary w-100" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-body-secondary small mt-3 mb-0">
          Demonstração: <code>agente@smartspace.test</code> / <code>senha123</code>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Escrever `src/main.tsx` e `src/styles.css`**

`main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles.css";
import { App } from "./App";
import { AuthProvider } from "./auth";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
```

`styles.css`:

```css
/* Bootstrap ja traz o tema claro e escuro; o atributo vem do sistema do usuario. */
:root {
  color-scheme: light dark;
}

.inbox-layout {
  height: 100vh;
  display: grid;
  grid-template-columns: minmax(18rem, 24rem) 1fr;
}

.inbox-list {
  overflow-y: auto;
  border-right: 1px solid var(--bs-border-color);
}

.inbox-thread {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 0;
}

.inbox-messages {
  overflow-y: auto;
}

.message-bubble {
  max-width: min(42rem, 80%);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Abaixo de 768px as duas colunas viram uma: a lista sai de cena quando uma
   conversa esta aberta, que e como todo inbox de celular se comporta. */
@media (max-width: 767.98px) {
  .inbox-layout {
    grid-template-columns: 1fr;
  }

  .inbox-layout[data-thread-open="true"] .inbox-list,
  .inbox-layout[data-thread-open="false"] .inbox-thread {
    display: none;
  }
}
```

- [ ] **Step 6: Escrever `src/App.tsx` provisório e rodar**

```tsx
import { useAuth } from "./auth";
import { Login } from "./pages/Login";

export function App() {
  const { agent } = useAuth();
  if (agent === null) {
    return <Login />;
  }
  return <pre className="p-4">sessao aberta como {agent.email}</pre>;
}
```

Run: com `core` em pé, `cd web && npm run dev` e abrir `http://localhost:5173`
Expected: a tela de login entra com as credenciais de demonstração e passa a mostrar `sessao aberta como agente@smartspace.test`. Senha errada mostra o alerta `e-mail ou senha incorretos`.

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: tela de login e sessao no front-end"
```

---

### Task 10: Web — o inbox, com atualização ao vivo e layout responsivo

**Files:**
- Create: `web/src/realtime.ts`, `web/src/pages/Inbox.tsx`
- Create: `web/src/components/{ConversationList.tsx,MessageThread.tsx,Composer.tsx,ChannelBadge.tsx,StatusBadge.tsx}`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `GET /api/conversations`, `GET /api/conversations/{id}`, `POST /api/conversations/{id}/messages`, `PATCH .../assign`, `PATCH .../status`, `GET /api/agents` (Tasks 3, 4, 6) e o WebSocket `/ws` do gateway (Task 8).
- Produces: um inbox de duas colunas que recarrega sozinho quando chega mensagem.

- [ ] **Step 1: Escrever `src/realtime.ts`**

```ts
import { useEffect, useRef } from "react";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000/ws";

export function useRealtime(onEvent: () => void): void {
  const callback = useRef(onEvent);
  callback.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let ativo = true;

    function conectar() {
      socket = new WebSocket(WS_URL);
      socket.onmessage = () => callback.current();
      // Reconexao fixa em 3s de proposito: backoff exponencial so paga quando o
      // servidor cai por minutos, e aqui os dois sobem no mesmo compose.
      socket.onclose = () => {
        if (ativo) {
          timer = window.setTimeout(conectar, 3000);
        }
      };
    }

    conectar();

    return () => {
      ativo = false;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, []);
}
```

- [ ] **Step 2: Escrever os dois crachás**

`src/components/ChannelBadge.tsx`:

```tsx
const ESTILO: Record<string, { rotulo: string; classe: string; icone: string }> = {
  TELEGRAM: { rotulo: "Telegram", classe: "text-bg-info", icone: "bi-telegram" },
  WHATSAPP: { rotulo: "WhatsApp", classe: "text-bg-success", icone: "bi-whatsapp" },
  EMAIL: { rotulo: "E-mail", classe: "text-bg-secondary", icone: "bi-envelope" },
};

export function ChannelBadge({ channel }: { channel: string }) {
  const estilo = ESTILO[channel] ?? { rotulo: channel, classe: "text-bg-light", icone: "bi-chat" };
  return (
    <span className={`badge ${estilo.classe}`}>
      <i className={`bi ${estilo.icone} me-1`} aria-hidden="true" />
      {estilo.rotulo}
    </span>
  );
}
```

`src/components/StatusBadge.tsx`:

```tsx
const ESTILO: Record<string, { rotulo: string; classe: string }> = {
  OPEN: { rotulo: "Aberta", classe: "text-bg-primary" },
  PENDING: { rotulo: "Pendente", classe: "text-bg-warning" },
  RESOLVED: { rotulo: "Resolvida", classe: "text-bg-success" },
};

export function StatusBadge({ status }: { status: string }) {
  const estilo = ESTILO[status] ?? { rotulo: status, classe: "text-bg-light" };
  return <span className={`badge ${estilo.classe}`}>{estilo.rotulo}</span>;
}
```

- [ ] **Step 3: Escrever os tipos e a lista**

`src/components/ConversationList.tsx`:

```tsx
import { ChannelBadge } from "./ChannelBadge";
import { StatusBadge } from "./StatusBadge";

export interface ConversationSummary {
  id: number;
  channel: string;
  status: string;
  contactName: string | null;
  contactExternalId: string;
  assignedAgent: { id: number; name: string } | null;
  lastMessagePreview: string;
  lastMessageAt: string;
}

interface Props {
  conversations: ConversationSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-body-secondary">
        <i className="bi bi-inbox fs-1 d-block mb-2" aria-hidden="true" />
        <p className="mb-1">Nenhuma conversa ainda.</p>
        <p className="small mb-0">
          Mande mensagem ao bot do Telegram, ou simule um canal com o botão acima.
        </p>
      </div>
    );
  }

  return (
    <ul className="list-group list-group-flush">
      {conversations.map((conversa) => (
        <li key={conversa.id}>
          <button
            type="button"
            onClick={() => onSelect(conversa.id)}
            aria-current={conversa.id === selectedId}
            className={`list-group-item list-group-item-action text-start w-100 py-3 ${
              conversa.id === selectedId ? "active" : ""
            }`}
          >
            <div className="d-flex justify-content-between align-items-start gap-2">
              <strong className="text-truncate">
                {conversa.contactName ?? conversa.contactExternalId}
              </strong>
              <small className="text-nowrap opacity-75">
                {new Date(conversa.lastMessageAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <div className="text-truncate small opacity-75">{conversa.lastMessagePreview}</div>
            <div className="d-flex gap-1 mt-2 flex-wrap">
              <ChannelBadge channel={conversa.channel} />
              <StatusBadge status={conversa.status} />
              {conversa.assignedAgent !== null && (
                <span className="badge text-bg-light">{conversa.assignedAgent.name}</span>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Escrever a thread e o compositor**

`src/components/MessageThread.tsx`:

```tsx
import { useEffect, useRef } from "react";

export interface MessageDto {
  id: number;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  deliveryStatus: "PENDING" | "SENT" | "FAILED";
  sentByAgent: { id: number; name: string } | null;
  createdAt: string;
}

export function MessageThread({ messages }: { messages: MessageDto[] }) {
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="inbox-messages p-3 d-flex flex-column gap-2">
      {messages.map((mensagem) => {
        const minha = mensagem.direction === "OUTBOUND";
        return (
          <div key={mensagem.id} className={`d-flex ${minha ? "justify-content-end" : ""}`}>
            <div
              className={`message-bubble rounded-3 px-3 py-2 ${
                minha ? "bg-primary text-white" : "bg-body-secondary"
              }`}
            >
              <div>{mensagem.body}</div>
              <div className="small mt-1 d-flex gap-2 align-items-center opacity-75">
                <span>
                  {new Date(mensagem.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {mensagem.sentByAgent !== null && <span>{mensagem.sentByAgent.name}</span>}
                {/* FAILED precisa aparecer: a mensagem esta salva no banco mas o
                    canal nao a recebeu, e so a tela pode contar isso ao agente. */}
                {mensagem.deliveryStatus === "FAILED" && (
                  <span className="badge text-bg-danger">não entregue</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={fim} />
    </div>
  );
}
```

`src/components/Composer.tsx`:

```tsx
import { useState } from "react";

interface Props {
  disabled: boolean;
  onSend: (body: string) => Promise<void>;
}

export function Composer({ disabled, onSend }: Props) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (texto.trim() === "") return;
    setEnviando(true);
    try {
      await onSend(texto);
      setTexto("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="border-top p-3 d-flex gap-2" onSubmit={enviar}>
      <label className="visually-hidden" htmlFor="resposta">Resposta</label>
      <input
        id="resposta"
        className="form-control"
        placeholder={disabled ? "Conversa resolvida" : "Escreva a resposta..."}
        maxLength={4096}
        disabled={disabled || enviando}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button className="btn btn-primary" type="submit" disabled={disabled || enviando}>
        <i className="bi bi-send" aria-hidden="true" />
        <span className="visually-hidden">Enviar</span>
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Escrever `src/pages/Inbox.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth, type Agent } from "../auth";
import { useRealtime } from "../realtime";
import { ConversationList, type ConversationSummary } from "../components/ConversationList";
import { MessageThread, type MessageDto } from "../components/MessageThread";
import { Composer } from "../components/Composer";
import { ChannelBadge } from "../components/ChannelBadge";

interface ConversationDetail {
  id: number;
  channel: string;
  status: string;
  contactName: string | null;
  contactExternalId: string;
  assignedAgent: Agent | null;
  messages: MessageDto[];
}

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:3000";

export function Inbox() {
  const { agent, logout } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [filtro, setFiltro] = useState("");

  const carregarLista = useCallback(async () => {
    const query = filtro === "" ? "" : `?status=${filtro}`;
    setConversations(await api.get<ConversationSummary[]>(`/api/conversations${query}`));
  }, [filtro]);

  const carregarDetalhe = useCallback(async (id: number) => {
    setDetail(await api.get<ConversationDetail>(`/api/conversations/${id}`));
  }, []);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    void api.get<Agent[]>("/api/agents").then(setAgents);
  }, []);

  useEffect(() => {
    if (selectedId !== null) {
      void carregarDetalhe(selectedId);
    }
  }, [selectedId, carregarDetalhe]);

  // Qualquer evento do gateway recarrega lista e conversa aberta. Aplicar o
  // delta no estado seria mais rapido e daria divergencia silenciosa; neste
  // volume o refetch e exato de graca.
  useRealtime(() => {
    void carregarLista();
    if (selectedId !== null) {
      void carregarDetalhe(selectedId);
    }
  });

  async function responder(body: string) {
    if (selectedId === null) return;
    await api.post(`/api/conversations/${selectedId}/messages`, { body });
    await carregarDetalhe(selectedId);
    await carregarLista();
  }

  async function atribuir(agentId: number) {
    if (selectedId === null) return;
    setDetail(await api.patch<ConversationDetail>(
      `/api/conversations/${selectedId}/assign`, { agentId }));
    await carregarLista();
  }

  async function mudarStatus(status: string) {
    if (selectedId === null) return;
    setDetail(await api.patch<ConversationDetail>(
      `/api/conversations/${selectedId}/status`, { status }));
    await carregarLista();
  }

  async function simularMensagem() {
    const texto = window.prompt("Texto da mensagem simulada:", "oi, preciso de ajuda");
    if (texto === null || texto.trim() === "") return;
    await fetch(`${GATEWAY_URL}/webhooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "+5511999999999", name: "Cliente Simulado", text: texto }),
    });
    await carregarLista();
  }

  return (
    <div className="inbox-layout" data-thread-open={selectedId !== null}>
      <aside className="inbox-list bg-body">
        <header className="p-3 border-bottom sticky-top bg-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Inbox</strong>
            <div className="d-flex gap-2 align-items-center">
              <span className="small text-body-secondary d-none d-sm-inline">{agent?.name}</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={logout}>Sair</button>
            </div>
          </div>
          <div className="d-flex gap-2">
            <label className="visually-hidden" htmlFor="status">Filtrar por status</label>
            <select id="status" className="form-select form-select-sm"
                    value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todas</option>
              <option value="OPEN">Abertas</option>
              <option value="PENDING">Pendentes</option>
              <option value="RESOLVED">Resolvidas</option>
            </select>
            <button className="btn btn-sm btn-outline-primary text-nowrap" onClick={simularMensagem}>
              <i className="bi bi-plus-lg" aria-hidden="true" /> Simular
            </button>
          </div>
        </header>
        <ConversationList conversations={conversations} selectedId={selectedId}
                          onSelect={setSelectedId} />
      </aside>

      <section className="inbox-thread bg-body-tertiary">
        {detail === null ? (
          <div className="d-flex align-items-center justify-content-center h-100 text-body-secondary p-4 text-center">
            Escolha uma conversa à esquerda.
          </div>
        ) : (
          <>
            <header className="p-3 border-bottom bg-body d-flex flex-wrap gap-2 align-items-center">
              <button className="btn btn-sm btn-outline-secondary d-md-none"
                      onClick={() => setSelectedId(null)} aria-label="Voltar para a lista">
                <i className="bi bi-arrow-left" aria-hidden="true" />
              </button>
              <div className="me-auto">
                <strong className="d-block">{detail.contactName ?? detail.contactExternalId}</strong>
                <ChannelBadge channel={detail.channel} />
              </div>
              <label className="visually-hidden" htmlFor="agente">Agente responsável</label>
              <select id="agente" className="form-select form-select-sm w-auto"
                      value={detail.assignedAgent?.id ?? ""}
                      onChange={(e) => void atribuir(Number(e.target.value))}>
                <option value="" disabled>Atribuir a...</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {detail.status === "RESOLVED" ? (
                <button className="btn btn-sm btn-outline-primary"
                        onClick={() => void mudarStatus("OPEN")}>Reabrir</button>
              ) : (
                <button className="btn btn-sm btn-success"
                        onClick={() => void mudarStatus("RESOLVED")}>Resolver</button>
              )}
            </header>

            <MessageThread messages={detail.messages} />
            <Composer disabled={detail.status === "RESOLVED"} onSend={responder} />
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Trocar o `App.tsx`**

```tsx
import { useAuth } from "./auth";
import { Login } from "./pages/Login";
import { Inbox } from "./pages/Inbox";

export function App() {
  const { agent } = useAuth();
  return agent === null ? <Login /> : <Inbox />;
}
```

- [ ] **Step 7: Verificar à mão, inclusive o responsivo (critério de aceite 7)**

Com `core`, `gateway` e `web` em pé:

1. Entrar, clicar em **Simular**, confirmar que a conversa aparece sem recarregar a página.
2. Responder; a resposta aparece na thread e em `GET http://localhost:3000/simulated/outbox`.
3. Atribuir um agente e resolver; recarregar a página e os dois valores continuam lá.
4. Parar o gateway (`docker compose stop gateway` ou `Ctrl+C`), responder, e conferir que a bolha ganha o crachá `não entregue`.
5. Abrir o DevTools em 375px de largura: sem scroll horizontal, e com conversa aberta a lista sai de cena e o botão de voltar aparece.

Run: `cd web && npm run lint`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat: inbox com thread, atribuicao, resolucao e atualizacao ao vivo"
```

---

### Task 11: Containers dos três serviços e pipeline no GitHub

**Files:**
- Create: `core/Dockerfile`, `gateway/Dockerfile`, `web/Dockerfile`, `web/nginx.conf`
- Modify: `docker-compose.yml`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: os três serviços das Tasks 2 a 10.
- Produces: `docker compose up -d` sobe quatro serviços; `web` em `http://localhost:8081`, `core` em `8080`, `gateway` em `3000`. Pipeline com os estágios `lint`, `test` e `build`.

- [ ] **Step 1: Escrever `core/Dockerfile`**

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# As dependencias vem antes do codigo: mudar uma classe nao reinstala o mundo.
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

- [ ] **Step 2: Escrever `gateway/Dockerfile`**

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

- [ ] **Step 3: Escrever `web/Dockerfile` e `web/nginx.conf`**

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# O Vite assa a URL da API no bundle; por isso ela e argumento de build, nao
# variavel de runtime.
ARG VITE_API_URL=http://localhost:8080
ARG VITE_GATEWAY_URL=http://localhost:3000
ARG VITE_WS_URL=ws://localhost:3000/ws
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

`web/nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
```

- [ ] **Step 4: Completar o `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: inbox
      POSTGRES_USER: inbox
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-inbox_dev}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U inbox -d inbox"]
      interval: 5s
      timeout: 3s
      retries: 10

  core:
    build: ./core
    environment:
      DB_HOST: postgres
      DB_PASSWORD: ${POSTGRES_PASSWORD:-inbox_dev}
      JWT_SECRET: ${JWT_SECRET:?defina JWT_SECRET no .env}
      INTERNAL_TOKEN: ${INTERNAL_TOKEN:?defina INTERNAL_TOKEN no .env}
      GATEWAY_URL: http://gateway:3000
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/actuator/health"]
      interval: 10s
      timeout: 3s
      retries: 12

  gateway:
    build: ./gateway
    environment:
      PORT: 3000
      CORE_URL: http://core:8080
      INTERNAL_TOKEN: ${INTERNAL_TOKEN:?defina INTERNAL_TOKEN no .env}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-}
    ports:
      - "3000:3000"
    depends_on:
      core:
        condition: service_healthy

  web:
    build:
      context: ./web
      args:
        VITE_API_URL: http://localhost:8080
        VITE_GATEWAY_URL: http://localhost:3000
        VITE_WS_URL: ws://localhost:3000/ws
    ports:
      - "8081:80"
    depends_on:
      - core
      - gateway

volumes:
  pgdata:
```

- [ ] **Step 5: Subir tudo e conferir (critério de aceite 1)**

```bash
docker compose up -d --build
docker compose ps --format '{{.Service}} {{.State}}'
```

Expected: `postgres`, `core`, `gateway`, `web` todos `running`. Abrir `http://localhost:8081` e entrar.

- [ ] **Step 6: Escrever `.github/workflows/ci.yml`**

```yaml
stages: [lint, test, build]

default:
  interruptible: true

variables:
  DOCKER_DRIVER: overlay2

lint:gateway:
  stage: lint
  image: node:24-alpine
  cache:
    key: gateway-$CI_COMMIT_REF_SLUG
    paths: [gateway/node_modules]
  script:
    - cd gateway
    - npm ci
    - npm run lint

lint:web:
  stage: lint
  image: node:24-alpine
  cache:
    key: web-$CI_COMMIT_REF_SLUG
    paths: [web/node_modules]
  script:
    - cd web
    - npm ci
    - npm run lint

test:core:
  stage: test
  image: maven:3.9-eclipse-temurin-21
  services:
    - name: docker:27-dind
      alias: docker
  variables:
    DOCKER_HOST: tcp://docker:2375
    DOCKER_TLS_CERTDIR: ""
    # Testcontainers precisa de um Docker alcancavel; o dind acima e ele. Sem
    # isso o teste de repositorio nao roda e a prova de Postgres real cai.
    TESTCONTAINERS_HOST_OVERRIDE: docker
  script:
    - cd core
    - ./mvnw -B test

test:gateway:
  stage: test
  image: node:24-alpine
  script:
    - cd gateway
    - npm ci
    - npm test

build:images:
  stage: build
  image: docker:27-cli
  services:
    - name: docker:27-dind
      alias: docker
  variables:
    DOCKER_HOST: tcp://docker:2375
    DOCKER_TLS_CERTDIR: ""
  script:
    - docker build -t inbox-core ./core
    - docker build -t inbox-gateway ./gateway
    - docker build -t inbox-web ./web
```

- [ ] **Step 7: Enviar e conferir o pipeline (critério de aceite 8)**

Expected: pipeline verde. Se `test:core` falhar por Docker inacessível, confirmar `TESTCONTAINERS_HOST_OVERRIDE` e `DOCKER_HOST`; a correção certa é fazer o dind funcionar, nunca desligar o teste de Testcontainers.

- [ ] **Step 8: Commit**

```bash
git add core/Dockerfile gateway/Dockerfile web/Dockerfile web/nginx.conf docker-compose.yml .github/workflows/ci.yml
git commit -m "ci: containers dos tres servicos e pipeline no GitHub"
```

---

### Task 12: README, evidência visual e página de defesa

**Files:**
- Create: `README.md`, `docs/inbox.gif`, `docs/mobile.png`
- Create: `docs/defesa.md`

**Interfaces:**
- Consumes: tudo.
- Produces: a porta de entrada de 30 segundos para quem abre o repositório.

- [ ] **Step 1: Gravar a evidência**

Gravar um GIF curto (menos de 10 segundos, menos de 3 MB) mostrando: mensagem enviada no app do Telegram, ela aparecendo no inbox sem recarregar, resposta digitada, resposta chegando no Telegram. Salvar em `docs/inbox.gif`. Capturar a tela em 375px e salvar em `docs/mobile.png`.

- [ ] **Step 2: Escrever o `README.md`**

```markdown
# Inbox Omnichannel

Caixa de entrada única para mensagens de Telegram, WhatsApp e e-mail: a mensagem
chega pelo canal, o agente responde na web, e a resposta sai pelo mesmo canal.

![Mensagem chegando do Telegram e sendo respondida no inbox](docs/inbox.gif)

## Rodar

```bash
cp .env.example .env     # ajuste JWT_SECRET e INTERNAL_TOKEN
docker compose up -d --build
```

Abra <http://localhost:8081> e entre com `agente@smartspace.test` / `senha123`.

Sem token do Telegram o inbox funciona inteiro pelos canais simulados: o botão
**Simular** injeta uma mensagem pelo mesmo contrato de webhook que o Telegram usa.

Para ligar o Telegram de verdade: crie um bot no `@BotFather`, ponha o token em
`TELEGRAM_BOT_TOKEN` no `.env`, exponha a porta 3000 e registre o webhook.

## Por que três serviços

`gateway` (Node) é a borda. Recebe webhook de canal e tem um único trabalho:
responder 200 rápido, porque 4xx faz o Telegram reentregar o mesmo update em laço.
Ele traduz o payload cru de cada canal para um contrato interno único e mantém as
conexões WebSocket do navegador.

`core` (Java) é o domínio. Autenticação, contatos, conversas, mensagens, tudo em
transação no PostgreSQL. Não sabe o que é Telegram: recebe `InboundRequest` com um
canal e um id externo.

A fronteira existe por esse descasamento — borda precisa de latência, domínio
precisa de transação. Trocar o adapter simulado de WhatsApp por um real não muda
uma linha do `core`; é o teste que a abstração tem de passar.

## Decisões e seus limites

| Decisão | Por quê | O que faria em produção |
|---|---|---|
| JWT stateless, sem refresh | Logout imediato não é requisito aqui | Refresh rotativo com blocklist; hoje revogar exige esperar os 8h de TTL |
| Idempotência por índice único em `external_id` | O banco é o único ponto que vê todas as réplicas | Igual, mais uma fila com entrega pelo menos uma vez |
| `deliveryStatus = FAILED` sem reenvio | Perder a mensagem é pior que não reentregá-la | Fila com repetição e recuo exponencial |
| WhatsApp e e-mail simulados | Credencial e aprovação não cabem em uma semana | Adapter real pelo mesmo contrato |
| Front-end recarrega a conversa a cada evento | Aplicar o delta divergiria em silêncio | Delta no estado, quando o volume justificar |

## Testes

```bash
cd core && ./mvnw test      # domínio + Testcontainers com PostgreSQL real
cd gateway && npm test      # contrato de canal e rotas
```

## Interface no celular

![Inbox em viewport de 375px](docs/mobile.png)

## Stack

Java 21 · Spring Boot 3.3 · Spring Security · JPA · Flyway · PostgreSQL 16 ·
Node 24 · TypeScript · Fastify · React 19 · Bootstrap 5 · Docker Compose · GitHub Actions
```

- [ ] **Step 3: Rodar o critério de aceite inteiro e colar a saída**

Executar, em ordem, os nove itens de `specs/2026-10-01-inbox-omnichannel.md`. Colar a saída real de cada comando na resposta ao usuário. Item que não passar volta para a implementação.

- [ ] **Step 4: Escrever `docs/defesa.md`**

Gerar com a skill `explicar-codigo` em modo defesa: por que cada escolha, onde um entrevistador vai apertar, e a resposta de uma frase para cada. Cobrir no mínimo: por que dois runtimes; por que JWT e não sessão; por que Testcontainers e não H2; por que idempotência no banco e não na aplicação; por que `FAILED` em vez de lançar exceção; o que falta para ir a produção.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/
git commit -m "docs: README com evidencia de execucao e pagina de defesa"
```

---

## Self-Review

**1. Cobertura da spec.** Os nove critérios de aceite têm task: 1 → Task 11; 2 → Task 3; 3 → Tasks 5 e 7; 4 → Tasks 8 e 12; 5 → Task 6; 6 → Tasks 2, 3, 5, 6, 7, 8; 7 → Task 10; 8 → Task 11; 9 → Tasks 1 a 12 (uma branch e um Pull Request por task). O "Fora de escopo" da spec não ganhou task nenhuma, como deve ser.

**2. Placeholders.** Nenhum "TBD" ou "implementar depois". Os dois pontos que dependem de ação humana — gravar o GIF (Task 12, Step 1) e criar o bot no `@BotFather` (Task 8, Step 7) — são passos com comando e resultado esperado, não lacunas. O hash BCrypt do seed é gerado em código (`DataInitializer`), não um valor a preencher.

**3. Consistência de tipos.** `findFirstByContactAndStatusNotOrderByLastMessageAtDesc` é declarado na Task 2 e usado com o mesmo nome na Task 5. O construtor do `ConversationService` cresce duas vezes — Task 5 acrescenta `ContactRepository` e `MessageRepository`, Task 6 acrescenta `AgentRepository` — e a assinatura final de quatro parâmetros é a que o `ConversationServiceTest` da Task 6 instancia. `MessageDto`, `ConversationSummary`, `ConversationDetail` e `ReplyPrepared` nascem na Task 4 ou 6 e são consumidos pelos mesmos nomes de campo no front-end das Tasks 9 e 10. `Channel`, `ConversationStatus`, `Direction` e `DeliveryStatus` usam as mesmas constantes em Java, TypeScript e SQL.

**4. Review Focus.** Os cinco têm teste: payload malformado → Task 7, Steps 2 e 3, e Task 8, Step 1; entrega duplicada → Task 5, Step 6; JWT inválido → Task 3, Step 8; corpo vazio ou gigante → Task 5, Step 6 e Task 6, Step 3; gateway fora do ar → Task 6, Step 9.

