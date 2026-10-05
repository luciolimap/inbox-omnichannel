# Lista de conversas sem N+1

## Intenção

Abrir o inbox com 50 conversas custa hoje mais de 150 consultas ao banco: a lista
carrega todas as conversas e, por `FetchType.LAZY`, todas as mensagens de cada uma
só para montar a prévia de uma linha. O contato e o agente atribuído somam mais uma
consulta cada, porque uma derived query com `ManyToOne` EAGER não vira join.

Depois desta mudança o número de consultas de `GET /api/conversations` não depende
da quantidade de conversas.

No front, cada evento do WebSocket dispara a recarga da lista e da conversa aberta.
Uma rajada de eventos — a resposta do agente gera um, o webhook de entrega gera
outro — dispara uma recarga por evento, por aba. Depois desta mudança uma rajada
dentro da mesma janela curta vira uma recarga.

## Critério de aceite

1. O número de consultas da lista não cresce com a quantidade de conversas:

```bash
cd core && ./mvnw -B test -Dtest=ConversationListQueryCountIT
```

Esperado: `Tests run: 1, Failures: 0`, `BUILD SUCCESS`. O teste semeia duas
conversas com mensagens, mede as consultas de `ConversationService.list`, semeia
mais duas e mede de novo. As duas medidas têm de ser iguais.

2. A suíte inteira do core segue verde:

```bash
cd core && ./mvnw -B test
```

Esperado: `Tests run: 38, Failures: 0` (37 de hoje mais o novo).

3. Rajada de eventos do WebSocket vira uma recarga:

```bash
cd web && npm test
```

Esperado: todos os testes passam, incluindo o novo de `useRealtime`, que entrega
três eventos seguidos ao socket e assere uma chamada só do callback.

## Fora de escopo

- Paginação da lista. O limite de verdade é a página sem fim, não o N+1, mas ela
  muda o contrato da API e o layout; esta mudança não mexe em nenhum dos dois.
- Aplicar o delta do evento no estado do front em vez de recarregar. A recarga é
  exata de graça; o delta divergiria em silêncio.
- Rate limit no gateway. Já está no "Fora de escopo" da spec do `/ws`.
- Os quatro warnings do `oxlint`. Entram em outro Pull Request.
