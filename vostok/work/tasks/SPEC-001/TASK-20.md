---
id: TASK-20
spec: SPEC-001
title: "Telas de admin"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-05, RF-10, RF-11, RF-12, RF-13, CT-05, CT-10]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: faa286f1848d9f121e5c26bf052f5ea1ca088eb0a9b9746b7ba9332dd6dead77
adjustments: 4
adjusted_at: 2026-10-31T09:46:59Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 2605a796696703819d4572bf00c0f5d9686431baa1a52b913afa880f2af5ab97
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T09:46:59Z
model: sonnet
---

# TASK-20: Telas de admin

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-05, RF-10 a RF-13, CT-05, CT-10, RN-12, RN-13 e os recursos `/admin/*` em "Contratos e interfaces")
- `prototype/atria-prototype.html` (telas de usuários, convites e estado da instância validadas no protótipo; a grade do formulário `.screen-form .form` e `.form-actions` e o seletor próprio `.cs-trigger`, base da PD-62)
- `docs/decisoes-do-prototipo.md` (linhas PD-19 e PD-62 e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa; PD-11, PD-14, PD-57 e PD-59 não se aplicam: as telas de admin não têm etiquetas, campos de data nem página de detalhe)
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004`: DEC-002 (as decisões do protótipo valem já, também nas telas); DEC-003 e DEC-004 não mudam o contexto auth
- `vostok/work/tasks/SPEC-001/TASK-05.md` (componentes da base: `SelectField` como seletor próprio, `FormGrid`, `FormActions`, `PageHeader` e as ligações de `apps/web/src/shared/forms/form-fields.tsx`, PD-19 e PD-62)
- `apps/web/src/app` (só leitura: layout e roteador raiz)
- `vostok/work/tasks/SPEC-001/TASK-06.md` (passo 8: `GET /me`, filtros de `GET /admin/users`, campos `role` e `is_active` do `PATCH /admin/users/{id}`, `GET|PATCH /admin/instance/settings` e códigos de erro)
- `apps/web/src/shared` (cliente da API, interface otimista, aviso de recusa, `Intl`, i18n comum, estado da listagem na URL e helpers de teste com axe)
- `packages/ui` (tabela, lista, cartão, chip de filtro, campo de busca, alternador de visualização, diálogo de confirmação, estados vazio, carregando e erro)
- `packages/theme` (tokens e temas claro e escuro)
- `packages/contracts` (tipos gerados de `/me`, `/admin/users`, `/admin/invites`, `/admin/instance` e `/admin/instance/settings`)
- `apps/server/src/auth/interface` (regras de quem pode o quê entre `admin` e `elevated` e códigos de erro)
- `vostok/rules/project/frontend.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `apps/web/scripts/evidence-shots.mjs` (molde das evidências visuais, TASK-05)

### Mudar

- `apps/web/src/features/admin/routes.tsx` (criar): rotas `/admin/users`, `/admin/invites`, `/admin/invites/new` e `/admin/instance`, exportadas por `createAdminRoutes` para a TASK-35 registrar.
- `apps/web/src/features/admin/nav.ts` (criar): item "Administração" da sidebar, visível só para `admin` e `elevated`.
- `apps/web/src/features/admin/i18n/pt-br.json` (criar): textos das telas de administração.
- `apps/web/src/features/admin/permissions.ts` (criar): funções puras que dizem quais ações cada papel vê (`canChangeRole`, `canToggleActive`, `canChangeInstance`).
- `apps/web/src/features/admin/permissions.test.ts` (criar): testes das permissões por papel (RN-12).
- `apps/web/src/features/admin/hooks/use-users.ts` (criar): papel de quem usa (`GET /me`), consulta paginada por cursor de `/admin/users` com filtro e busca, e mutações otimistas de papel e ativação.
- `apps/web/src/features/admin/hooks/use-users.test.tsx` (criar): testes da consulta e da reversão otimista quando o servidor recusa.
- `apps/web/src/features/admin/hooks/use-invites.ts` (criar): geração de convite e leitura e alteração de "convite obrigatório".
- `apps/web/src/features/admin/hooks/use-invites.test.tsx` (criar): testes da geração e da alteração otimista.
- `apps/web/src/features/admin/hooks/use-instance-status.ts` (criar): consulta de `/admin/instance`.
- `apps/web/src/features/admin/screens/users-screen.tsx` (criar): listagem de usuários com filtros, busca, visualização em lista ou tabela e ações por papel (RF-10, RF-12).
- `apps/web/src/features/admin/screens/users-screen.test.tsx` (criar): testes da listagem, dos estados e das ações (CT-10).
- `apps/web/src/features/admin/screens/invites-screen.tsx` (criar): explicação dos convites, botão "Gerar convite" e o interruptor "convite obrigatório" para o admin (RF-05, RF-11).
- `apps/web/src/features/admin/screens/invites-screen.test.tsx` (criar): testes do interruptor e dos estados (CT-05).
- `apps/web/src/features/admin/screens/new-invite-screen.tsx` (criar): rota própria que gera o convite e mostra o link para copiar (RF-11).
- `apps/web/src/features/admin/screens/new-invite-screen.test.tsx` (criar): testes da geração e da cópia do link (CT-10).
- `apps/web/src/features/admin/screens/instance-screen.tsx` (criar): versão, espaço usado e saúde da instância (RF-13).
- `apps/web/src/features/admin/screens/instance-screen.test.tsx` (criar): testes dos dados e dos estados carregando e erro (CT-10).
- `apps/web/src/features/admin/admin.e2e.ts` (criar): fluxos ponta a ponta de papéis e convite opcional, rodados na TASK-35.
- `apps/web/src/features/admin/evidence/harness.tsx` (criar): página de evidência que monta as rotas de `createAdminRoutes` num roteador em memória do TanStack Router com os providers do app (tema, TanStack Query, i18n, preferências), dentro do layout do app; não é importada pelo app nem por `apps/web/src/app` (nada muda em `apps/web/src/app`) e por isso fica fora do build de produção; só tokens do tema; passa no typecheck e no lint.
- `apps/web/scripts/evidence-admin.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-admin.mjs telas`), em Node sem dependências novas, no molde de `apps/web/scripts/evidence-shots.mjs` (código próprio, sem importar o da TASK-05): sobe o Vite numa porta livre por `createServer` da API do Vite com um plugin que serve uma página HTML virtual carregando o `harness.tsx` (encerra no fim, KNW-006), simula a API com `context.route('/api/**')` e fixtures em memória no próprio script (`/me` como admin, usuários com uma conta desativada, lista vazia, respostas lentas para o carregando e `problem+json` para o erro), captura nos temas claro e escuro, em 1440 px e em 360 px, confere o estado no DOM antes de cada captura (tema aplicado, sem rolagem horizontal, sem erro de JS, axe sem violações, inclusive `color-contrast`, por `@axe-core/playwright`, e as verificações de cada estado), imprime `ok` ou `FALHA` por verificação, o caminho do PNG e a última linha `ok  0 falha(s)`, e sai com código diferente de 0 se algo falhar; a prancha vai para `vostok/work/tasks/SPEC-001/evidence/TASK-20/admin-telas.png`.

### Passos

1. Leia os arquivos de "Ler" e anote: os nomes do cliente da API, do helper de mutação otimista e do aviso de recusa em `apps/web/src/shared`, como o estado da listagem vai para a URL e os componentes de `@atria/ui`. O papel de quem usa vem de `GET /api/v1/me` (TASK-06). Use esses nomes nos passos seguintes, sem criar equivalentes. Toda escolha de lista usa o `SelectField` de `@atria/ui`, o seletor próprio da TASK-05, nunca um `<select>` nativo, e todo formulário usa o `FormActions` da base, com "Cancelar" (`ghost`) antes do primário, à direita, embaixo da linha (PD-62).
2. Crie `apps/web/src/features/admin/i18n/pt-br.json` com chaves em `snake_case` agrupadas por tela (`users`, `invites`, `new_invite`, `instance`, `nav`), em tom calmo (ex.: estado vazio dos usuários: "Nenhuma conta encontrada com esses filtros.").
3. Escreva `apps/web/src/features/admin/permissions.test.ts` e depois `permissions.ts`: `canChangeRole(viewer)` só para `admin`; `canToggleActive(viewer, target)` para `admin` em qualquer conta que não seja a própria e para `elevated` só em contas com papel `user`; `canChangeInstance(viewer)` só para `admin` (RN-12). Testes `only admin changes roles`, `elevated toggles only user accounts` e `elevated never changes the instance`. Essas funções só escondem ações; o servidor continua sendo quem recusa.
4. Escreva `apps/web/src/features/admin/hooks/use-users.test.tsx` antes do hook: `useMe` lê `GET /api/v1/me` (papel de quem usa); a consulta envia `GET /api/v1/admin/users` com `role`, `q`, `cursor` e `limit`; `useChangeRole` envia `PATCH /api/v1/admin/users/{id}` com `role` e `useToggleActive` com `is_active`; os dois atualizam o cache na hora e, quando o servidor responde 403 ou 409, restauram o valor anterior e chamam o aviso de recusa (RNF-09). Testes `lists users with filters from the url`, `grants elevated optimistically` e `rolls back the toggle when the server refuses`. Rode `pnpm --filter @atria/web test -- src/features/admin` e confirme que falham; crie `use-users.ts` com `useInfiniteQuery` e `useMutation` com o helper otimista de `apps/web/src/shared` até passarem.
5. Escreva `use-invites.test.tsx` e crie `use-invites.ts`: `useCreateInvite` envia `POST /api/v1/admin/invites` e devolve o link; `useInviteRequired` lê o valor atual em `GET /api/v1/admin/instance/settings` (só para o admin) e envia `PATCH /api/v1/admin/instance/settings` só com `invite_required`, de forma otimista com reversão. Testes `creates an invite link` e `turns off the invite requirement optimistically`.
6. Crie `use-instance-status.ts` com `useQuery` de `GET /api/v1/admin/instance`, devolvendo versão, espaço usado em bytes e saúde.
7. Para cada tela, escreva primeiro o `*.test.tsx` (Testing Library, `userEvent` e axe) e depois a tela. Todo teste de tela verifica: cabeçalho com `page-heading` e subtítulo; estados carregando, vazio com texto explicativo e erro com ação "Tentar de novo"; navegação completa por `userEvent.tab()` com foco visível; zero violações no axe.
8. `users-screen.test.tsx` e `users-screen.tsx`: filtro por papel, busca por e-mail e visualização em lista ou tabela, com os nomes acessíveis "Filtros", "Busca" e "Visualização" (usados pelos e2e da TASK-35), todos lidos e gravados na URL (`?role=&q=&view=`) pelo helper de `apps/web/src/shared`; datas com `Intl`; ações por linha conforme `permissions.ts`: "Conceder elevado"/"Retirar elevado" (admin), "Desativar"/"Reativar" (com diálogo de confirmação) e "Gerar link de redefinição" (admin), que navega para `/admin/users/$userId/password-reset` (tela da TASK-19). A conta desativada usa o token de estado neutro com fundo `*Soft`, nunca vermelho. O filtro por papel é o `SelectField` da TASK-05 ("Todos os papéis", "Administrador", "Elevado", "Usuário"), operável por setas, Enter e Esc (PD-62). Testes `filters and searches users through the url`, `picks the role filter in the custom select by keyboard` (abre com `ArrowDown`, escolhe "Elevado" com `Enter`, a URL passa a ter `role=elevated` e a página não tem `<select>`), `switches between list and table`, `hides role actions from elevated`, `deactivates a user after confirmation` e `shows empty, loading and error states`.
9. `invites-screen.test.tsx` e `invites-screen.tsx`: explica como o convite funciona (uso único, com validade), o botão "Gerar convite" leva a `/admin/invites/new` (o contrato não lista convites já gerados), e o interruptor "Exigir convite para cadastro" aparece só para o admin (`canChangeInstance`) e usa `useInviteRequired`. Testes `admin turns off the invite requirement` e `elevated does not see the invite requirement`.
10. `new-invite-screen.test.tsx` e `new-invite-screen.tsx`: rota própria (sem modal); "Gerar" chama `useCreateInvite`, mostra o link num campo só de leitura e o botão de copiar usa `navigator.clipboard.writeText` com aviso em `aria-live="polite"`. O `PageHeader` e o formulário ficam numa coluna centralizada na largura do `FormGrid` (PD-19), com o campo do link em `data-span="full"` e, no `FormActions`, "Cancelar" (`ghost`, volta a `/admin/invites`) e "Gerar" (primário) (PD-62). Testes `generates and copies an invite link` e `renders the header and the form in the centered form column` (o cabeçalho e o `FormGrid` no mesmo contêiner da coluna do formulário, e "Cancelar" antes de "Gerar").
11. `instance-screen.test.tsx` e `instance-screen.tsx`: mostra a versão, o espaço usado formatado com `Intl.NumberFormat` (unidade `byte` com notação compacta) e a saúde com texto e ícone (`aria-hidden="true"`), sem depender só da cor. Testes `shows version, used space and health` e `shows the error state when the status fails`.
12. Crie `apps/web/src/features/admin/nav.ts` exportando `adminNav` com `path: '/admin/users'`, `label_key: 'admin.nav.title'`, o ícone SVG e `roles: ['admin', 'elevated']`, no formato de item de navegação definido em `apps/web/src/shared`.
13. Crie `apps/web/src/features/admin/routes.tsx` exportando `createAdminRoutes(parent: AnyRoute)` com as quatro rotas e o esquema `zod` dos parâmetros de busca da lista de usuários; o `beforeLoad` redireciona para `/` quem não é `admin` nem `elevated`. Não altere `apps/web/src/app`.
14. Crie `apps/web/src/features/admin/admin.e2e.ts` com `admin grants elevated and elevated manages a user`, `elevated cannot change instance settings` e `sign-up works without invite when the requirement is off`, em 360 px e desktop, com axe. Não rode: os e2e rodam na TASK-35.
15. Rode o bloco de "Verificação" e corrija até passar sem warnings.
16. Crie `apps/web/src/features/admin/evidence/harness.tsx` e `apps/web/scripts/evidence-admin.mjs` (veja "Mudar") e rode `node apps/web/scripts/evidence-admin.mjs telas`. Corrija o código da tarefa a cada linha `FALHA` e repita até a última linha ser `ok  0 falha(s)`; abra a prancha `admin-telas.png` para conferir os estados, os temas e as larguras.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# Testes de componente e de hook da feature (Vitest + Testing Library + axe)
pnpm --filter @atria/web test -- src/features/admin
# Tipos e lint sem nenhum erro ou warning
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
# e2e escrito (roda na TASK-35)
test -s apps/web/src/features/admin/admin.e2e.ts
# Nenhuma cor literal fora dos tokens do tema
! grep -rnE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(' apps/web/src/features/admin --include=*.tsx --include=*.ts --include=*.css
# Nenhum controle nativo que a base da TASK-05 substitui (PD-62)
! grep -rnE '<select|type="(date|number)"' apps/web/src/features/admin --include=*.tsx
# Harness e script das evidências visuais
test -f apps/web/src/features/admin/evidence/harness.tsx
test -f apps/web/scripts/evidence-admin.mjs
node --check apps/web/scripts/evidence-admin.mjs
```

### Evidências

- `admin-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/admin --reporter=verbose`
  - Prova: telas, hooks e permissões de administração passam, com reversão otimista e axe sem violações (RF-05, RF-10 a RF-13, CT-05, CT-10, RNF-06, RNF-09).
  - Trecho: as linhas `✓` de `elevated toggles only user accounts`, `rolls back the toggle when the server refuses`, `admin turns off the invite requirement`, `generates and copies an invite link`, `shows version, used space and health`, `picks the role filter in the custom select by keyboard` e `renders the header and the form in the centered form column` (PD-19, PD-62), e o resumo sem falhas.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `admin-e2e-specs.txt` (automática): `grep -n "test(" apps/web/src/features/admin/admin.e2e.ts`
  - Prova: os fluxos ponta a ponta de papéis e convite opcional estão escritos para a TASK-35 (CT-05, CT-10).
  - Trecho: as linhas com `admin grants elevated and elevated manages a user`, `elevated cannot change instance settings` e `sign-up works without invite when the requirement is off`.
  - Falha: `No such file or directory` ou saída vazia.
- `admin-telas.txt` (automática): `node apps/web/scripts/evidence-admin.mjs telas`
  - Prova: identidade visual, os dois temas, 360 px e desktop, os estados vazio, carregando e erro e o foco por teclado, medidos no DOM e fotografados nas telas montadas pelo harness da feature (RNF-06, RNF-08, RNF-10).
  - Trecho: uma linha `ok` por verificação, como `ok ... tema claro aplicado` e `ok ... tema escuro aplicado`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclusive color-contrast)` em cada captura, `ok ... visualização em tabela` e `ok ... visualização em lista` (a tabela vira lista em 360 px), `ok ... estado vazio com texto explicativo`, `ok ... estado carregando visível`, `ok ... erro com "Tentar de novo"`, `ok ... conta desativada sem vermelho`, `ok ... seletor próprio do papel aberto, sem <select>`, `ok ... interruptor "Exigir convite para cadastro" visível`, `ok ... cabeçalho e formulário na coluna centralizada` e `ok ... ações à direita com "Cancelar" antes de "Gerar"` na geração de convite, `ok ... versão, espaço usado e saúde visíveis` e `ok ... contorno de foco visível depois de Tab (≥ 2 px)` numa ação da linha; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-20/admin-telas.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (rolagem horizontal da página em 360 px, violação do axe ou contraste insuficiente, estado sem texto explicativo, conta desativada em vermelho, `<select>` nativo, foco invisível), a ausência da linha `png:`, código de saída diferente de 0 ou a prancha sem algum dos estados.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-20/admin-telas.png`, a prancha com as capturas rotuladas, nos temas claro e escuro, em 360 px e em desktop: lista de usuários em lista e em tabela, lista vazia, carregando e com erro, convites com o interruptor, geração de convite e estado da instância, mais o foco visível pelo teclado numa ação da linha, o filtro por papel aberto no seletor próprio e a geração de convite com o cabeçalho e o formulário na coluna centralizada e as ações à direita embaixo da linha (PD-19, PD-62).

### Concluída quando

- [x] O admin concede e retira o papel `elevated`, e o `elevated` não vê essa ação (RF-10, CT-10).

  > Como comprovar: em `admin-tests.txt`, ver aprovados `only admin changes roles`, `grants elevated optimistically` e `hides role actions from elevated`.

- [x] O `elevated` gera convites com link para copiar (RF-11, CT-10).

  > Como comprovar: em `admin-tests.txt`, ver aprovados `creates an invite link` e `generates and copies an invite link`.

- [x] O `elevated` vê a lista de usuários com filtros, busca e visualização na URL, e desativa ou reativa só contas `user` (RF-12, CT-10).

  > Como comprovar: em `admin-tests.txt`, ver aprovados `filters and searches users through the url`, `switches between list and table`, `elevated toggles only user accounts` e `deactivates a user after confirmation`.

- [x] O `elevated` vê versão, espaço usado e saúde da instância, e não vê nenhum controle das configurações da instância (RF-13, CT-10).

  > Como comprovar: em `admin-tests.txt`, ver aprovados `shows version, used space and health`, `elevated never changes the instance` e `elevated does not see the invite requirement`.

- [x] O admin desliga a exigência de convite, com a mudança na hora e desfeita com aviso se o servidor recusar (RF-05, CT-05, RNF-09).

  > Como comprovar: em `admin-tests.txt`, ver aprovados `turns off the invite requirement optimistically`, `admin turns off the invite requirement` e `rolls back the toggle when the server refuses`.

- [x] As telas mostram vazio com texto, carregando e erro, navegam por teclado e não têm violações no axe (RNF-06).

  > Como comprovar: em `admin-tests.txt`, ver aprovado `shows empty, loading and error states` e o resumo sem falhas.

- [x] As telas funcionam em 360 px e desktop, nos dois temas, só com tokens do tema (RNF-08, RNF-10).

  > Como comprovar: em `admin-telas.txt`, ver `tema claro aplicado`, `tema escuro aplicado`, `sem rolagem horizontal` e `axe sem violações (inclusive color-contrast)` com `ok` e a última linha `ok  0 falha(s)`; abrir a prancha `admin-telas.png` e conferir as telas legíveis nos dois temas e larguras; a Verificação não encontra cor literal.

- [x] O filtro por papel usa o seletor próprio da base, sem `<select>` nativo, e a geração de convite tem o cabeçalho e o formulário numa coluna centralizada, com "Cancelar" e "Gerar" à direita (PD-19, PD-62).

  > Como comprovar: em `admin-tests.txt`, ver aprovados `picks the role filter in the custom select by keyboard` e `renders the header and the form in the centered form column`; a Verificação não encontra `<select`, `type="date"` nem `type="number"` na feature; em `admin-telas.txt`, ver `seletor próprio do papel aberto, sem <select>`, `cabeçalho e formulário na coluna centralizada` e `ações à direita com "Cancelar" antes de "Gerar"` com `ok`, e na prancha `admin-telas.png`, ver o seletor aberto e a coluna centralizada.

- [x] Typecheck e lint passam sem warning, e o e2e da feature está escrito para a TASK-35.

  > Como comprovar: rodar o bloco de "Verificação" e ver que termina sem erro; `admin-e2e-specs.txt` lista os três fluxos.

## Descrição

### Resumo executivo

Entrega as telas de administração: usuários, papéis, convites e o estado da instância.
Quem administra passa a gerir as contas e os convites pela interface, e o papel elevado ajuda sem poder mexer nas configurações.
Perfil padrão, risco baixo: só cria as telas da própria área e segue as permissões já garantidas pelo servidor.
Depende da base do frontend e dos contratos do servidor; destrava a integração final do frontend.

### Detalhes técnicos

**Abordagem.** Feature isolada em `apps/web/src/features/admin`, com telas sem regra de negócio, hooks do TanStack Query e um módulo puro de permissões por papel. A feature exporta `createAdminRoutes` e `adminNav`; a TASK-35 os registra.

**Componentes.** Lista de usuários (`/admin/users`, com `?role=&q=&view=`), convites (`/admin/invites`) com o interruptor "exigir convite", geração de convite em rota própria (`/admin/invites/new`) e estado da instância (`/admin/instance`).

**Decisões.**
- Permissões por papel num módulo puro só para esconder ações; o servidor continua recusando (RN-12). Descartada: confiar só na resposta 403, que mostraria botões que sempre falham.
- Papel e ativação com interface otimista e reversão com aviso (RNF-09). Descartada: esperar o servidor, que contraria [project/frontend-18].
- O interruptor "exigir convite" fica nos convites, porque RF-05 é desta tarefa, lê `GET /admin/instance/settings` e envia só `invite_required` a `PATCH /admin/instance/settings`. A tela completa de configurações da instância (RF-60) é da TASK-33, que usa o mesmo endpoint.
- "Gerar link de redefinição" só navega para `/admin/users/$userId/password-reset`, tela da TASK-19 (RF-09), sem importar código de `features/auth`, porque as duas tarefas são da mesma onda e não dependem uma da outra.
- Desativar pede confirmação num diálogo; criar convite tem rota própria, sem modal.
- Visualização em lista ou tabela; em 360 px a tabela vira lista.
- Campos e ações com a base da TASK-05 (DEC-002, PD-62): o filtro por papel é o `SelectField` (seletor próprio) e a geração de convite usa `FormGrid` e `FormActions` numa coluna centralizada (PD-19). Descartado: o `<select>` nativo e ações próprias da feature, que a PD-62 troca em todo o app.

**Evidências visuais.** A prancha `admin-telas.png` é gerada por `apps/web/scripts/evidence-admin.mjs`, como as da TASK-05: a evidência é um comando cuja saída (`admin-telas.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG. Como as rotas só são registradas no roteador pela TASK-35, o `pnpm dev` não mostra as telas; por isso o script sobe o Vite com uma página virtual que carrega `apps/web/src/features/admin/evidence/harness.tsx`, que monta `createAdminRoutes` num roteador em memória com os providers do app, dentro do layout, sem tocar em `apps/web/src/app` e fora do build de produção. A API é simulada no navegador (`context.route('/api/**')`) com fixtures do próprio script, e cada captura passa pelo axe, inclusive o contraste.

**Riscos.** O papel de quem usa vem de `GET /me` (TASK-06); sem ele, as ações ficam escondidas. O filtro por situação (ativa ou desativada) não existe em `GET /admin/users`; a situação aparece em cada linha. O espaço usado pode vir em unidade diferente de bytes: conferir o tipo gerado em `@atria/contracts`.

**Referências.** RF-05, RF-10, RF-11, RF-12, RF-13; CT-05, CT-10; RN-11, RN-12, RN-13; RNF-06, RNF-08, RNF-09, RNF-10; decisão 9 da spec; DEC-002; PD-19 e PD-62 de `docs/decisoes-do-prototipo.md`.

**Arquivos em comum na onda 7.** Nenhum: cada feature só cria arquivos na própria pasta.

### Card

- **Título:** Telas de admin
- **Tipo:** historia
- **Descrição:** Telas de usuários, papéis, convites e estado da instância, com as ações limitadas pelo papel de quem usa.
- **Critérios de aceite:**
  - [ ] O admin concede e retira o papel elevado.
  - [ ] O elevado gera convites, gere contas user e vê o estado da instância.
  - [ ] O elevado não altera papéis nem configurações da instância.
  - [ ] O admin desliga a exigência de convite.
  - [ ] Telas com estados vazio, carregando e erro, acessíveis, em 360 px e desktop, nos dois temas.
  - [ ] Filtro por papel no seletor próprio e geração de convite numa coluna centralizada, com as ações da base do frontend.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 4 | 2026-10-31 | ajuste | in_progress | Evidência manual admin-telas.png trocada por automática admin-telas.txt gerada por apps/web/scripts/evidence-admin.mjs, com a prancha PNG como Artefato; harness da feature em src/features/admin/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo 16 novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 5 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 6 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 7 | 2026-10-31 | evidências | passed | 3 evidência(s) em evidence/TASK-20/ |
| 8 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md (PD-19, PD-62), DEC-002 a DEC-004 e os componentes da TASK-05; filtro por papel no SelectField próprio, com o teste picks the role filter in the custom select by keyboard (PD-62); geração de convite com PageHeader, FormGrid e FormActions na coluna centralizada e o teste renders the header and the form in the centered form column (PD-19, PD-62); Verificação sem select, date e number nativos; Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 2 | 2026-10-30 | agente | Linha test -e da pasta da feature removida da Baseline, recusada pela validação depois do ajuste 1 |
| 3 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 4 | 2026-10-31 | agente | Evidência manual admin-telas.png trocada por automática admin-telas.txt gerada por apps/web/scripts/evidence-admin.mjs, com a prancha PNG como Artefato; harness da feature em src/features/admin/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo 16 novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
