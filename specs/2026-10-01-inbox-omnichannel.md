# inbox-omnichannel

Projeto prático para a vaga de Desenvolvedor de Software Júnior da Smartspace
(SaaS omnichannel). Prazo: candidatura fecha em 08/10/2026.

## Intenção

Um inbox omnichannel: mensagens que chegam de canais diferentes (Telegram real,
WhatsApp e e-mail simulados) aparecem numa única caixa de entrada web, onde um
agente autenticado lê a conversa, responde e marca como resolvida. A resposta sai
pelo mesmo canal de origem.

Quem avalia roda `docker compose up` e usa a aplicação em um comando. Cada
requisito listado na vaga tem um lugar visível no código: Java no domínio,
Node na borda dos canais, React + Bootstrap na interface, PostgreSQL nos dados,
GitHub com Pull Requests no processo.

## Critério de aceite

Cada item é um comando executável com saída esperada.

### 1. Sobe em um comando

```
docker compose up -d
docker compose ps --format '{{.Service}} {{.State}}'
```

Esperado: cinco serviços em `running` — `postgres`, `core` (Java), `gateway`
(Node), `web` (React), `adminer` ou equivalente opcional removido se não entrar.

### 2. Autenticação rejeita e aceita

```
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/conversations
curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"agente@smartspace.test","password":"senha123"}' | jq -r '.token != null'
```

Esperado:

```
401
true
```

### 3. Mensagem de canal entra e cria conversa

```
curl -s -X POST http://localhost:3000/webhooks/whatsapp \
  -H 'Content-Type: application/json' \
  -d '{"from":"+5511999999999","text":"oi, preciso de ajuda"}'
curl -s http://localhost:8080/api/conversations -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.channel == "WHATSAPP")] | length'
```

Esperado: `1` ou mais, e a conversa carrega a mensagem com `direction: "INBOUND"`.

### 4. Telegram é real, ponta a ponta

Mensagem enviada ao bot pelo app do Telegram aparece no inbox sem recarregar a
página. A resposta digitada no inbox chega no app do Telegram.

Evidência: GIF no `README.md` gravado da tela, com o celular visível.

### 5. Atribuição e resolução persistem

```
curl -s -X PATCH http://localhost:8080/api/conversations/1/assign \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"agentId":1}' | jq -r '.assignedAgent.name'
curl -s -X PATCH http://localhost:8080/api/conversations/1/status \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"RESOLVED"}' | jq -r '.status'
```

Esperado: nome do agente, depois `RESOLVED`. Reiniciar o `core` e repetir o
`GET` devolve os mesmos valores.

### 6. Testes passam, incluindo integração com banco real

```
cd core && ./mvnw -q test
cd gateway && npm test
```

Esperado: exit 0 nos dois. A suíte Java inclui pelo menos um teste de
repositório com Testcontainers subindo PostgreSQL, e pelo menos um teste de
regra de domínio que falha se a lógica de atribuição quebrar.

### 7. Interface responsiva em Bootstrap

Em viewport de 375px de largura a lista de conversas e a thread não se sobrepõem
e não há scroll horizontal. Verificado em screenshot no `README.md`.

### 8. Pipeline verde

`.github/workflows/ci.yml` com jobs de lint, teste e `docker build` dos três serviços.
Esperado: pipeline verde no último commit da branch principal, link no `README.md`.

### 9. Histórico de processo visível

Pelo menos cinco Pull Requests fechados no GitHub, cada um com descrição do que
entrega, e commits em Conventional Commits.

## Fora de escopo

- WhatsApp Business API e e-mail reais. Os dois são simulados pelo mesmo contrato
  de webhook do Telegram — a abstração de canal é o ponto, não a credencial.
- Refresh token rotativo, OAuth2, Keycloak. Login é JWT stateless com BCrypt e
  dois papéis. O trade-off de refresh fica documentado no `README.md`.
- Multi-tenant, cobrança, planos.
- Busca, filtros, tags, notas internas, respostas prontas, dashboard de métricas.
  Entram só se a entrega principal fechar antes do dia 7.
- Deploy público. `docker compose up` é a porta de entrada. Deploy em Render ou
  Fly fica como tarefa final opcional.
- Tailwind, shadcn ou qualquer biblioteca de UI fora de Bootstrap 5. A vaga pede
  Bootstrap; o visual sai de Bootstrap mais CSS próprio.
- Cobertura de teste alta como meta. Os testes do critério 6 são o contrato.
