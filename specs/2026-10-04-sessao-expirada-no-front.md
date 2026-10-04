# sessao-expirada-no-front

## Intenção

O JWT vale 480 minutos. Passado o prazo, toda chamada ao core responde `401` e o
front não faz nada com isso: a sessão continua no `localStorage`, o `Inbox`
mostra lista vazia, e `api.get("/api/agents")` no `Inbox.tsx` nem tem `catch`, o
que vira unhandled rejection no console. Quem está usando vê um inbox que
esvaziou sem explicação e não tem como voltar ao login a não ser limpando o
navegador.

Sessão que o core recusa passa a terminar: o front apaga a sessão guardada e
volta para a tela de login, com o aviso de que ela expirou.

Duas coisas que não podem ser atropeladas junto:

- **O login também responde `401`**, com senha errada. Esse `401` é resposta de
  negócio da tela de login e tem de continuar aparecendo como credencial
  inválida, não como "sessão expirada".
- **Sessão corrompida no `localStorage`** (`inbox.session` com JSON inválido)
  hoje estoura no inicializador do `useState`, antes do primeiro render, e deixa
  a tela branca — sem botão de sair, porque ele está dentro da árvore que
  quebrou. Vale tratar na mesma passada: é a mesma falha de "sessão que não
  serve".

## Critério de aceite

### 1. A suíte do front cobre os três casos

```
cd web && npm test
```

Esperado: `Tests 7 passed (7)`. Os quatro primeiros saíram desta intenção:
`401` com sessão ativa dispara o aviso de expirada; `401` na rota de login
**não** dispara; sessão corrompida no `localStorage` devolve `null`; sessão sem
token é descartada. Os três últimos saíram da revisão de fecho: `401` com corpo
que não é JSON ainda derruba a sessão; `401` atrasado do token velho não derruba
a sessão nova; o que `guardarSessao` escreve, `lerSessao` devolve.

### 2. Lint e build seguem verdes

```
cd web && npm run lint && npm run build
```

Esperado: exit 0 nos dois.

### 3. Na tela, sessão vencida volta para o login

Com os quatro serviços de pé, entrar no inbox, apagar o `token` de
`inbox.session` no `localStorage` por um valor inválido e provocar uma chamada
(clicar numa conversa).

Esperado: volta para a tela de login com o aviso de sessão expirada, em vez de
inbox vazio.

## Fora de escopo

- Refresh token. A spec principal já põe refresh rotativo em "Fora de escopo"; a
  sessão expirada termina em login, não em renovação.
- Avisar antes de expirar, ou contador na tela.
- Tratar `401` vindo do gateway nas rotas de webhook: o botão **Simular** já
  mostra o próprio aviso desde a autenticação do webhook.
- Reautenticar sem passar pelo login. Sessão que o core recusa termina em login,
  inclusive quando a recusa chega pelo `/ws` fechando com `4401`.
