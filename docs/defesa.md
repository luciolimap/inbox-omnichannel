# Defesa das decisões

Uma pergunta por decisão, a resposta curta primeiro e o limite logo em seguida.
É o que eu diria numa sanidade de arquitetura, não um resumo do README.

## Por que dois runtimes, e não um só?

Porque os dois lados têm exigências opostas e medidas diferentes. O webhook de
canal precisa responder 200 em milissegundos: o Telegram reentrega o mesmo
`update` em laço enquanto não recebe 200, e um 4xx vira uma tempestade de
reentregas. O domínio precisa do contrário — transação, constraint, rollback.

**Onde um entrevistador aperta:** "isso é complexidade sem ganho, um Spring Boot
resolve os dois."

**Resposta:** resolve, e seria a escolha certa se a borda não tivesse latência
própria. O que não aceito é o inverso — tratar webhook dentro da transação do
domínio, porque aí uma rajada de canal vira contenção de banco. A fronteira paga
a si mesma no dia em que o canal muda de formato: o `core` não sabe o que é
Telegram, recebe `InboundRequest` com canal e id externo.

**Limite:** dois runtimes custam dois pipelines, duas imagens e um contrato
interno para manter. Num time de uma pessoa isso é caro.

## Por que JWT e não sessão no servidor?

Porque o `core` não guarda estado de sessão, e com isso escala horizontal sem
sticky session nem Redis para sessão compartilhada.

**Onde aperta:** "e para revogar um token agora?"

**Resposta:** não revogo. Hoje revogar significa esperar o TTL expirar. Essa é a
troca honesta de JWT stateless, e eu a aceitei porque logout imediato não é
requisito deste inbox.

**Limite:** no dia em que for — refresh rotativo com blocklist dos refresh, e o
access token fica curto. Blocklist de access token reintroduz o estado que o JWT
tinha removido, então ou o TTL é curto ou o JWT não era a escolha.

## Por que Testcontainers e não H2?

Porque o teste tem de reprovar o que a produção reprova. A idempotência deste
projeto é um índice único em `external_id` no PostgreSQL. O H2 aceita dialeto que
o PostgreSQL recusa, e a Flyway rodaria uma migração diferente da real: o teste
ficaria verde justamente onde eu mais preciso dele vermelho.

**Onde aperta:** "sobe container em cada build, isso é lento."

**Resposta:** é, e por isso o container é um só para a suíte inteira, não um por
teste. O preço veio junto com uma armadilha: sem rollback por teste, o dado de um
teste entra na asserção de ordem do outro. O `ConversationRepositoryIT` falhou com
`[1L, 3L, 2L]` antes de eu pôr `@Transactional` em cada teste de integração.

## Por que idempotência no banco e não na aplicação?

Porque o banco é o único ponto que vê todas as réplicas. Um `exists` antes do
`insert` na aplicação é uma condição de corrida com janela: duas réplicas checam,
as duas não acham, as duas inserem. O índice único não tem janela — a segunda
inserção falha, e a falha é o caminho normal, não a exceção.

**Onde aperta:** "e se o canal reenviar com outro `external_id`?"

**Resposta:** aí não é a mesma mensagem para o canal, e não tenho como saber que
é. O `external_id` é sempre prefixado pelo canal (`telegram:4812`,
`whatsapp:9f3a`) justamente para o índice global ser seguro entre canais.

## Por que `FAILED` em vez de lançar exceção?

Porque perder a mensagem do agente é pior que não a entregar. Se o gateway está
fora do ar quando o agente responde, a mensagem já está salva: ela fica
`deliveryStatus = FAILED`, a interface mostra o crachá de não entregue, e o
agente sabe. Deixar a exceção subir e abortar a transação apagaria o texto que a
pessoa acabou de escrever.

**Onde aperta:** "`FAILED` sem reenvio não é entrega, é um TODO com nome bonito."

**Resposta:** correto, e é deliberado. A rota devolve 502 — não finjo sucesso. O
reenvio certo é uma fila com repetição e recuo exponencial; sem fila, repetição
dentro do request só move a falha para o timeout do navegador.

## O que falta para ir a produção?

Nesta ordem, porque cada item depois do primeiro depende dele:

1. **Fila entre `core` e `gateway`.** Hoje o despacho é HTTP síncrono. É a causa
   raiz do `FAILED` sem reenvio.
2. **Refresh token rotativo.** Revogação hoje é esperar o TTL.
3. **WhatsApp e e-mail reais.** O adapter simulado existe para provar que entra
   pelo mesmo contrato; a troca não toca o `core`.
4. **Observabilidade.** O `actuator` está de pé, mas não há métrica de
   mensagem por canal nem alerta de `FAILED` crescendo.
5. **Paginação em `GET /api/conversations`.** Devolve tudo; morre no primeiro
   inbox com dez mil conversas.

## O que eu refaria

O front-end recarrega a conversa inteira a cada evento do WebSocket, em vez de
aplicar o delta. Escolhi assim porque delta divergindo em silêncio é o bug que
não aparece em teste — mas num inbox com conversa longa isso é tráfego à toa, e
a correção é delta com número de sequência, não delta cru.
