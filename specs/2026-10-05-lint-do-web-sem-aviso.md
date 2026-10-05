# Lint do web sem aviso

## Intenção

O `npm run lint` do `web` passa verde imprimindo quatro avisos do `oxlint`. Aviso
que ninguém zera envelhece em silêncio: o quinto entra sem ninguém ver.

Depois desta mudança o lint do `web` sai limpo, e um aviso novo quebra o job
`lint-web` em vez de virar ruído.

Dos quatro, dois são defeito de verdade e dois são a regra errando o alvo:

- `auth.tsx` exporta `AuthProvider` e `useAuth` no mesmo arquivo, o que desliga o
  fast refresh do módulo inteiro. O `useAuth` e o contexto saem para
  `src/auth-context.ts`.
- `realtime.ts` escreve em `callback.current` durante o render. A escrita vai para
  um efeito, que é onde ref pode ser tocada.
- Os dois `set-state-in-effect` do `Inbox.tsx` são busca inicial de dados contra o
  core, que é exatamente o "sincronizar com sistema externo" que o texto da própria
  regra autoriza. Ficam silenciados no lugar, com o motivo escrito.

## Critério de aceite

1. O lint sai limpo e um aviso novo passa a derrubar o comando:

```bash
cd web && npm run lint
```

Esperado: exit 0 e nenhuma linha com `warning`.

2. A suíte do `web` segue verde:

```bash
cd web && npm test
```

Esperado: `Test Files 2 passed (2)`, `Tests 11 passed (11)`.

3. O bundle ainda assa:

```bash
cd web && npm run build
```

Esperado: `built in <...>ms`, sem erro de TypeScript.

## Fora de escopo

- Reescrever a busca de dados do `Inbox` com biblioteca de cache ou `use`. A regra
  está errada aqui, não o código.
- Os avisos do GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`).
  Entram em outro Pull Request.
- Ligar regra nova do `oxlint`. Esta mudança zera o que já está ligado.
