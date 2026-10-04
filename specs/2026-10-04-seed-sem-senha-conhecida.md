# seed-sem-senha-conhecida

## Intenção

`DataInitializer` semeia `agente@smartspace.test` e `admin@smartspace.test` com
`senha123` em qualquer ambiente, sem guarda nenhuma, e o `README` publica a
credencial. Qualquer instância que subir exposta nasce com um ADMIN de senha
conhecida.

A senha de demonstração passa a existir só fora de produção. Com o profile
`prod` ativo, o seed exige `SEED_ADMIN_PASSWORD` no ambiente: sem ela o boot
falha dizendo o que falta, em vez de subir com credencial pública.

Fora de `prod` nada muda — `docker compose up -d` continua entregando o inbox
usável com `agente@smartspace.test` / `senha123`, que é o critério de aceite 1
da spec principal e o que quem avalia o projeto roda.

## Critério de aceite

### 1. A regra do seed está coberta por teste

```
cd core && ./mvnw -B test -Dtest=DataInitializerTest
```

Esperado: `Tests run: 8, Failures: 0`. Cinco cobrem a regra: fora de produção
sem variável usa a senha de demonstração; fora de produção com variável usa a do
ambiente; em produção com variável usa a do ambiente; em produção sem variável
falha; espaço nas pontas sai da senha. Três sobem o bean de verdade, para pegar
o nome da propriedade digitado errado no `yml` e a detecção por profile: em
produção com banco vazio o seed exige a variável; em produção com banco já
povoado o deploy sobe sem ela; fora de produção o seed roda com a de
demonstração.

### 2. Em produção sem a variável o core não sobe

```
cd core && SPRING_PROFILES_ACTIVE=prod ./mvnw -B spring-boot:run
```

Esperado: o boot falha citando `SEED_ADMIN_PASSWORD`, sem semear agente nenhum.
Vale também quando o profile chega por grupo
(`--spring.profiles.active=live --spring.profiles.group.live=prod`).

O `docker-compose.yml` repassa `SPRING_PROFILES_ACTIVE` ao serviço `core`, senão
a regra existiria sem interruptor no único caminho de deploy do projeto.

### 3. Fora de produção o login de demonstração continua valendo

```
docker compose up -d
curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"agente@smartspace.test","password":"senha123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['agent']['role'])"
```

Esperado: `AGENT`.

### 4. A suíte inteira segue verde

```
cd core && ./mvnw -B test
```

Esperado: `Tests run: 37, Failures: 0` — os 29 de antes mais os 8 do item 1.

## Fora de escopo

- Trocar o par de agentes de demonstração por cadastro de usuário. O inbox não
  tem tela de cadastro e isso não está na spec principal.
- Forçar senha forte, expiração ou troca no primeiro login.
- Remover a credencial de demonstração do `README`. Ela continua certa fora de
  `prod`, que é como o projeto é avaliado; o `README` passa a dizer que vale só
  ali.
- Criar o primeiro agente em produção por outro caminho. Em `prod` o seed usa
  `SEED_ADMIN_PASSWORD` e, com o banco já povoado, não roda nem exige a
  variável; cadastro de usuário continua fora de escopo.
