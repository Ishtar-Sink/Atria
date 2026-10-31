---
id: TASK-31
spec: SPEC-001
title: "Aba Conexões"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-18, RF-19, CT-13]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: a86cb1e9eeae3e6fc6b1a782fbb503139aa427be785bf540771c0b4c1d95e03d
adjustments: 4
adjusted_at: 2026-10-31T11:42:47Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 422aebbf5f465ce20b66c1e88ab23dd625a0af48bdc3208a2b67baeb055101fe
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T11:42:47Z
model: sonnet
---

# TASK-31: Aba Conexões

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-18, RF-19, CT-13, RN-10, CB-06, contrato de `/links`, fluxo principal (passos 8 a 10), RNF-06, RNF-08 a RNF-10 e decisão 27.
- `vostok/rules/project/architecture.md`: [project/architecture-05] (ligações genéricas e bidirecionais) e [project/architecture-10].
- `vostok/rules/project/frontend.md`: filtros e busca na URL, estados, cor determinística, teclado e Optimistic UI.
- `vostok/rules/project/code-style.md`: componentes sem regra de negócio, só tokens do tema.
- `vostok/rules/project/testing.md`: Vitest, Testing Library, axe e testes determinísticos.
- `vostok/rules/project/language.md`: textos em arquivo de tradução.
- `vostok/rules/project/naming-convention.md`: arquivos em `kebab-case`, chaves de objetos em `snake_case`.
- `prototype/atria-prototype.html`: aba "Conexões" validada no protótipo e o cartão "Ligações" da Visão geral do projeto (`projectOverviewHTML`).
- `docs/decisoes-do-prototipo.md`: linhas PD-42 (cartão "Ligações" na lateral da Visão geral do projeto) e PD-46 (tarefa ligada ao cartão), e a seção "Decisões resolvidas em 30/10 (DEC-002)".
- `vostok/memory/decisions.md`: DEC-002 (as telas seguem as decisões do protótipo) e DEC-003 (a tarefa ligada ao cartão é uma ligação `project_card` com `task` do contexto `links` e aparece também na aba Conexões), consultadas com `vostok memory search decision DEC-002 DEC-003 DEC-004`.
- `vostok/work/tasks/SPEC-001/TASK-15.md`: contrato de `/links`: `GET /links?entity_type=&entity_id=&linked_type=&cursor=&limit=` devolve, além dos lados normalizados, `linked_type` e `linked_id` (o lado oposto à entidade consultada), sem título; `POST /links` e `DELETE /links/{id}`; os 14 tipos ligáveis (`account`, `transaction`, `transfer`, `goal`, `milestone`, `task`, `reminder`, `note`, `journal_entry`, `book`, `article`, `video`, `project`, `project_card`); erros `link_already_exists` (409), `self_link` e `unknown_entity_type` (422).
- `vostok/work/tasks/SPEC-001/TASK-14.md`: `GET /cards/{card_id}`, que devolve o cartão com `title` e `project_id` (o mesmo corpo de `GET /projects/{id}/cards/{card_id}`) e 404 `card_not_found` para cartão de outra pessoa, excluído ou de projeto excluído.
- `vostok/work/tasks/SPEC-001/TASK-30.md`: rota da tela do cartão, `/projects/$projectId/cards/$cardId`.
- `apps/web/src/app`: só leitura, para ver o layout e como a TASK-35 registra rotas e monta a aba nas telas.
- `apps/web/src/shared`: cliente da API, mutação otimista, formatação com `Intl` e i18n comum.
- `packages/ui`: abas, lista, campo de busca, filtros, estados e diálogo de confirmação.
- `packages/theme`: tokens do tema.
- `packages/contracts`: tipos gerados de `/links`, `/links/{id}`, `/search` (escolha da entidade a ligar) e dos `GET` por id das entidades ligáveis, usados para o título.
- `apps/web/scripts/evidence-shots.mjs`: molde das evidências visuais (TASK-05): Vite numa porta livre, Chromium do `@playwright/test`, temas claro e escuro, 1440 e 360 px, `check()` com `ok`/`FALHA`, prancha `sheet()` e código de saída 1 em falha.

### Mudar

- `apps/web/src/features/connections/routes.tsx` (criar): rota `/connections/new` (com `source_type` e `source_id` na URL) para ligar a entidade a outra, exportada por `createConnectionsRoutes(parent_route)`.
- `apps/web/src/features/connections/i18n/pt-br.json` (criar): textos da feature.
- `apps/web/src/features/connections/connections-tab.tsx` (criar): aba "Conexões" reutilizável, `ConnectionsTab({ entity_type, entity_id })`, com filtro, busca, agrupamento e categorização (RF-19).
- `apps/web/src/features/connections/connection-item.tsx` (criar): item da ligação com título, categoria, data, link para a entidade e remover.
- `apps/web/src/features/connections/new-connection-page.tsx` (criar): escolha da entidade a ligar, em rota própria (RF-18).
- `apps/web/src/features/connections/remove-connection-dialog.tsx` (criar): confirmação da remoção, que tira a ligação dos dois lados (RN-10).
- `apps/web/src/features/connections/connections-summary.tsx` (criar): lista compacta das ligações de uma entidade, `ConnectionsSummary({ entity_type, entity_id, limit })`, para o cartão "Ligações" da Visão geral do projeto (PD-42), montada pela TASK-35 na propriedade `links_slot` da TASK-30.
- `apps/web/src/features/connections/entity-categories.ts` (criar): categoria (módulo), rota da tela e leitura do título de cada um dos 14 tipos do contrato da TASK-15.
- `apps/web/src/features/connections/use-connections.ts` (criar): leitura das ligações da entidade e o filtro, a busca e o agrupamento.
- `apps/web/src/features/connections/use-linked-titles.ts` (criar): título de cada entidade ligada, lido do `GET` por id do tipo, porque `/links` não traz título.
- `apps/web/src/features/connections/use-connection-mutations.ts` (criar): criar e remover ligações com Optimistic UI.
- `apps/web/src/features/connections/connections-tab.test.tsx` (criar): testes da aba.
- `apps/web/src/features/connections/new-connection-page.test.tsx` (criar): testes da criação da ligação.
- `apps/web/src/features/connections/use-connection-mutations.test.tsx` (criar): testes da interface otimista.
- `apps/web/src/features/connections/connections-summary.test.tsx` (criar): testes da lista compacta (PD-42).
- `apps/web/src/features/connections/use-linked-titles.test.tsx` (criar): testes do título das entidades ligadas.
- `apps/web/src/features/connections/connections.e2e.ts` (criar): fluxo ponta a ponta do CT-13, rodado só na TASK-35.
- `apps/web/src/features/connections/evidence/harness.tsx` (criar): página de evidência que monta `createConnectionsRoutes` e uma rota de teste com `ConnectionsTab` (uma nota de exemplo) num roteador em memória do TanStack Router, com os providers do app (tema, TanStack Query, i18n, preferências) e dentro do layout do app; não é importada pelo app nem por `apps/web/src/app` (nada muda em `apps/web/src/app`) e por isso fica fora do build de produção; só tokens do tema; passa no typecheck e no lint.
- `apps/web/scripts/evidence-connections.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-connections.mjs temas|estados`), em Node sem dependências novas, no molde de `apps/web/scripts/evidence-shots.mjs` (código próprio, sem importar o da TASK-05): sobe o Vite numa porta livre por `createServer` da API do Vite com um plugin que serve uma página HTML virtual carregando o `harness.tsx` (encerra no fim, KNW-006), simula a API com `context.route('/api/**')` e fixtures em memória no próprio script (ligações de várias categorias, `/search`, os `GET` por id, uma resposta lenta para o carregando e `problem+json` para o erro), captura nos temas claro e escuro, em 1440 px e em 360 px, confere o estado no DOM antes de cada captura (tema aplicado, sem rolagem horizontal, sem erro de JS, axe sem violações incluindo `color-contrast`, e as verificações de cada estado), imprime `ok` ou `FALHA` por verificação, o caminho do PNG e a última linha `ok  0 falha(s)`, e sai com código diferente de 0 se algo falhar; as pranchas vão para `vostok/work/tasks/SPEC-001/evidence/TASK-31/`.

### Passos

1. Ler os arquivos de "Ler" e anotar os nomes exportados por `apps/web/src/shared`, `packages/ui` e `packages/contracts` (ligação com `source_type`, `source_id`, `target_type`, `target_id`, `linked_type` e `linked_id`, o resultado de `/search` e as respostas dos `GET` por id das entidades ligáveis).
2. Criar `entity-categories.ts` com a constante `ENTITY_CATEGORIES`, que leva cada um dos 14 tipos do contrato da TASK-15 à categoria, à rota da tela (`route`, uma função `(id, detail) => string | null`, que recebe a resposta do `GET` por id para os tipos cuja rota depende da entidade pai), ao `GET` por id (`detail_path`) e ao campo do título (`title_of`): `account` em `finance` (`/finance/accounts/{id}`, `/accounts/{id}`, `name`), `transaction` em `finance` (`/finance/transactions/{id}`, `/transactions/{id}`, `description`), `transfer` em `finance` (sem rota e sem `detail_path`), `goal` em `goals` (`/goals/{id}`, `/goals/{id}`, `title`), `milestone` em `goals` (sem rota e sem `detail_path`), `task` em `tasks` (`/tasks/{id}`, `/tasks/{id}`, `title`), `reminder` em `reminders` (`/reminders/{id}`, `/reminders/{id}`, `title`), `note` em `notes` (`/notes/{id}`, `/notes/{id}`, `title`), `journal_entry` em `journal` (`/journal/{id}`, `/journal-entries/{id}`, a data de `occurred_at` com `Intl`), `book`, `article` e `video` em `library` (`/library/books/{id}`, `/library/articles/{id}`, `/library/videos/{id}`; `/books/{id}`, `/articles/{id}`, `/videos/{id}`; `title`, e no vídeo sem título, a `url`), `project` em `projects` (`/projects/{id}`, `/projects/{id}`, `name`) e `project_card` em `projects` (`/projects/{project_id}/cards/{id}`, com o `project_id` da resposta, `/cards/{id}` da TASK-14, `title`). Os tipos sem `detail_path` (`transfer` e `milestone`, cuja leitura no servidor exige o id da entidade pai, que a ligação não traz) aparecem com o rótulo do tipo e sem link; o `project_card` mostra o rótulo do tipo, sem link, enquanto a leitura carrega ou quando ela responde 404 `card_not_found`. Usar os nomes de tipo exatos do contrato; descartado o tipo `card`, que não existe nele.
3. Criar `i18n/pt-br.json` com chaves em `snake_case` sob `connections`: `tab_title`, `add`, `search_label`, `filter_category`, `group_by`, `group_by_category`, `group_by_date`, `group_none`, `category.<categoria>` para cada categoria, `type.<tipo>` para cada um dos 14 tipos (rótulo usado quando não há título), `summary.empty` ("Nenhuma ligação ainda."), `summary.connect` ("Conectar a algo"), `summary.more` ("Ver todas"), `empty_title`, `empty_text` (explica como ligar), `no_results`, `loading`, `error`, `remove`, `remove_confirm` (diz que some dos dois lados), `new.title`, `new.subtitle`, `new.search_label`, `new.pick`, `new.already_linked` e `undo_notice`.
4. Escrever os testes antes do código, com o cliente da API simulado:
   - `connections-tab.test.tsx`: `lists the connections of any entity type and id`, `exposes the Filtros, Busca and Visualização controls by accessible name`, `shows a connection created on the other side` (bidirecional), `filters by category`, `searches by title`, `groups by category and by date`, `labels each connection with its category`, `links each connection to the entity screen`, `keeps filter, search and grouping in the URL`, `shows the empty state with explanatory text`, `shows the loading state`, `shows the error state`, `has no axe violations`.
   - `new-connection-page.test.tsx`: `searches entities and links the chosen one`, `does not offer the entity itself nor one already linked`, `returns to the entity screen after linking`, `is operable by keyboard only`.
   - `use-connection-mutations.test.tsx`: `removes the connection before the server answers`, `rolls back and shows the undo notice when the server rejects` (RNF-09).
   - `use-linked-titles.test.tsx`: `reads the title from the detail endpoint of each linked type`, `formats the journal entry date with Intl`, `shows the type label without link for transfer and milestone`, `dec003 reads the project card title and link from the card endpoint` (`GET /cards/{card_id}` com `title` e `project_id`; o link é `/projects/<project_id>/cards/<card_id>`) e `shows the project card type label without link when the card is not found`.
   - `connections-summary.test.tsx`: `pd42 lists the linked entities with title and type label up to the limit`, `pd42 links each item to the entity screen`, `pd42 shows the empty text and the connect link to the connections tab`, `shows the loading state`, `has no axe violations`.
   - em `connections-tab.test.tsx`, acrescentar `dec003 lists the task linked to a project card on the task side` e `uses linked_type and linked_id from the server for the other side`.
5. Rodar `pnpm --filter @atria/web test -- src/features/connections` e confirmar que falham por falta da implementação.
6. Implementar `use-linked-titles.ts`: `useQueries` com o `GET` de `detail_path` de cada ligação, chave de cache por tipo e id (a mesma das features donas não é exigida), e `title_of` sobre a resposta; tipo sem `detail_path` ou leitura com 404 devolve o rótulo `type.<tipo>` e `href` nulo; com a resposta, devolve o título e `href = route(id, resposta)`, o que no `project_card` usa o `project_id` de `GET /cards/{card_id}` (TASK-14). Implementar `use-connections.ts`: GET `/links` com `entity_type` e `entity_id` (o servidor devolve as ligações dos dois lados, com `linked_type` e `linked_id` da outra ponta, usados sem recalcular), com `linked_type` na consulta quando o filtro de categoria tem um só tipo e filtro no cliente nos demais casos, título de `use-linked-titles.ts` e filtro por categoria, busca por título e agrupamento (por categoria, por data da ligação ou sem agrupamento), lidos e gravados na URL com chaves prefixadas por `connections_` para não colidir com as da tela que monta a aba. Implementar `use-connection-mutations.ts` (POST `/links` e DELETE `/links/{id}`, otimistas).
7. Implementar `connection-item.tsx` (título, rótulo da categoria com a cor determinística derivada do id da entidade, data com `Intl`, link pela rota de `ENTITY_CATEGORIES`, botão remover com `aria-label`), `remove-connection-dialog.tsx` (diálogo de confirmação de `packages/ui`) e `connections-tab.tsx` (`ConnectionsTab({ entity_type, entity_id })` com o botão "Conectar com", que leva a `/connections/new?source_type=...&source_id=...`, busca, filtro, agrupamento e os estados). Os três controles da listagem têm os nomes acessíveis exatos "Filtros", "Busca" e "Visualização" (este no controle de agrupamento; `aria-label` ou rótulo vindo das chaves `filters_label`, `search_label` e `view_label` da tradução), usados pelos e2e da TASK-35.
8. Implementar `connections-summary.tsx` (PD-42): `ConnectionsSummary({ entity_type, entity_id, limit = 5 })` com as ligações mais recentes, cada uma com o título (link pela rota de `ENTITY_CATEGORIES`, quando houver) e o rótulo do tipo embaixo, como no protótipo; com mais ligações que o limite, o link "Ver todas" para `?tab=connections`; sem ligações, "Nenhuma ligação ainda." em texto calmo e o link "Conectar a algo" para `?tab=connections`; usa `use-connections.ts` e `use-linked-titles.ts`, sem filtro nem busca na URL.
9. Implementar `new-connection-page.tsx`: página com cabeçalho, campo de busca sobre `/search` (todas as categorias), lista de resultados navegável por setas e Enter, sem a própria entidade e as já ligadas, e volta à tela da entidade de origem depois de ligar.
10. Criar `routes.tsx` com `createConnectionsRoutes(parent_route)`. A feature não tem `nav.ts`; a TASK-35 monta `ConnectionsTab` nas telas de cada entidade e `ConnectionsSummary` na propriedade `links_slot` da Visão geral do projeto (TASK-30).
11. Criar `connections.e2e.ts` (Playwright) com o CT-13: ligar uma nota a uma meta, ver a ligação nos dois lados, filtrar e agrupar a aba, remover pela meta e ver que some dos dois lados, em 360 px e desktop, com axe. Não rodar: ele roda na TASK-35.
12. Rodar a Verificação até passar sem nenhum warning de lint.
13. Criar `evidence/harness.tsx` e `apps/web/scripts/evidence-connections.mjs` (veja "Mudar") e rodar `node apps/web/scripts/evidence-connections.mjs temas` e `node apps/web/scripts/evidence-connections.mjs estados`. Corrigir o código da tarefa a cada linha `FALHA` e abrir as pranchas `connections-themes-widths.png` e `connections-states-focus.png` para conferir.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
pnpm --filter @atria/web test -- src/features/connections
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
grep -q "export function ConnectionsTab" apps/web/src/features/connections/connections-tab.tsx
grep -q "export function ConnectionsSummary" apps/web/src/features/connections/connections-summary.tsx
! grep -qE "'card'|\"card\"" apps/web/src/features/connections/entity-categories.ts
grep -q "/cards/" apps/web/src/features/connections/entity-categories.ts
test -f apps/web/src/features/connections/connections.e2e.ts
test -f apps/web/src/features/connections/evidence/harness.tsx
test -f apps/web/scripts/evidence-connections.mjs
node --check apps/web/scripts/evidence-connections.mjs
```

### Evidências

- `connections-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/connections --reporter=verbose`
  - Prova: os testes da aba Conexões passam, cobrindo ligações nos dois lados, filtro, busca, agrupamento, categorização, criação, remoção, estados, axe e interface otimista (RF-18, RF-19, CT-13, RNF-06, RNF-09).
  - Trecho: os arquivos `connections-tab.test.tsx`, `new-connection-page.test.tsx` e `use-connection-mutations.test.tsx` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `connections-consumers.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/connections --reporter=verbose -t "pd42|dec003|linked"`
  - Prova: a feature atende os consumidores das ligações: a lista compacta para o cartão "Ligações" da Visão geral do projeto (PD-42), a tarefa ligada a um cartão visível do lado da tarefa (DEC-003) e o título de cada entidade ligada lido do `GET` por id, com os 14 tipos do contrato da TASK-15.
  - Trecho: os casos `pd42 lists the linked entities with title and type label up to the limit`, `pd42 shows the empty text and the connect link to the connections tab`, `dec003 lists the task linked to a project card on the task side`, `dec003 reads the project card title and link from the card endpoint` e `reads the title from the detail endpoint of each linked type` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests`, `No test files found` ou nenhum caso `pd42` ou `dec003` executado.
- `connections-files.txt` (automática): `find apps/web/src/features/connections -type f | sort`
  - Prova: a feature tem a aba reutilizável, a rota de ligar, traduções, hooks, testes e o e2e do CT-13.
  - Trecho: `connections-tab.tsx`, `connections-summary.tsx`, `use-linked-titles.ts`, `routes.tsx`, `i18n/pt-br.json` e `connections.e2e.ts` na lista.
  - Falha: `No such file or directory` ou algum desses arquivos ausente.
- `connections-themes-widths.txt` (automática): `node apps/web/scripts/evidence-connections.mjs temas`
  - Prova: identidade visual nos dois temas, categorias distinguíveis e layout funcional a partir de 360 px, medidos no DOM e fotografados: a aba Conexões agrupada por categoria e a tela de ligar (`/connections/new`), em 1440 px e em 360 px, nos temas claro e escuro (RNF-08, RNF-10).
  - Trecho: uma linha `ok` por verificação, como `ok ... tema aplicado`, `ok ... grupos por categoria visíveis` (um cabeçalho por categoria das fixtures), `ok ... rótulo da categoria em cada ligação`, `ok ... controles Filtros, Busca e Visualização`, `ok ... campo de busca da tela de ligar`, `ok ... rótulos sem corte em 360 px`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclui color-contrast)` em cada captura; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-31/connections-themes-widths.png (8 capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (rótulos cortados ou rolagem horizontal em 360 px, contraste baixo no tema escuro apontado pelo axe, grupos ausentes), a ausência da linha `png:` ou código de saída diferente de 0 (`Cannot find module` antes da tarefa, porque o script não existe).
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-31/connections-themes-widths.png`, a prancha com as capturas rotuladas: aba agrupada por categoria e tela de ligar, nos temas claro e escuro, em 1440 px e em 360 px.
- `connections-states-focus.txt` (automática): `node apps/web/scripts/evidence-connections.mjs estados`
  - Prova: todos os estados da aba e o foco por teclado na tela de ligar ([project/frontend-10], [project/frontend-12], RNF-06).
  - Trecho: `ok ... estado vazio com texto explicativo`, `ok ... indicador de carregamento visível` (resposta lenta), `ok ... mensagem de erro visível` (`problem+json`), `ok ... resultado ativo depois de Tab e setas`, `ok ... contorno de foco visível · ≥ 2px` no resultado ativo, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclui color-contrast)`; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-31/connections-states-focus.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (estado sem texto, resultado que não recebe foco, contorno de foco ausente ou menor que 2 px), a ausência da linha `png:` ou código de saída diferente de 0.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-31/connections-states-focus.png`, a prancha com a aba nos estados vazio, carregando e erro e a lista de resultados da tela de ligar com o foco visível navegando só pelo teclado, nos dois temas.

### Concluída quando

- [x] Qualquer entidade pode ser ligada a outra, e a ligação aparece nos dois lados (RF-18, CT-13).

  > Como comprovar: na saída `connections-tests.txt`, ver aprovados `searches entities and links the chosen one` e `shows a connection created on the other side`.

- [x] A aba "Conexões" serve a qualquer entidade, recebendo só o tipo e o id (RF-19).

  > Como comprovar: ver aprovado `lists the connections of any entity type and id` e conferir que a Verificação acha `export function ConnectionsTab`.

- [x] Cada ligação mostra o título da entidade, lido do `GET` por id do tipo, e os tipos seguem os 14 do contrato da TASK-15, com `milestone` e `transfer` pelo rótulo do tipo, sem link, e o `project_card` com o título e o link para a tela do cartão no projeto, lidos de `GET /cards/{card_id}` (TASK-14); a tarefa ligada a um cartão aparece na aba da tarefa (RF-19, DEC-003).

  > Como comprovar: em `connections-consumers.txt`, ver aprovados `reads the title from the detail endpoint of each linked type`, `dec003 lists the task linked to a project card on the task side` e `dec003 reads the project card title and link from the card endpoint`; a Verificação não acha `'card'` e acha `/cards/` em `entity-categories.ts`.

- [x] `ConnectionsSummary` lista as ligações de uma entidade para o cartão "Ligações" da Visão geral do projeto, com o texto vazio e o link "Conectar a algo" (PD-42).

  > Como comprovar: em `connections-consumers.txt`, ver aprovados os casos `pd42` da `connections-summary.test.tsx`; a Verificação acha `export function ConnectionsSummary`.

- [x] A aba tem filtro, busca, agrupamento e categorização, guardados na URL, e os estados vazio, carregando e erro (RF-19, CT-13).

  > Como comprovar: ver aprovados `filters by category`, `searches by title`, `groups by category and by date`, `labels each connection with its category` e `keeps filter, search and grouping in the URL`.

- [x] Remover a ligação de um lado tira dos dois, com confirmação, na hora e desfeito com aviso se o servidor recusar (RF-18, CT-13, RNF-09).

  > Como comprovar: ver aprovados `removes the connection before the server answers` e `rolls back and shows the undo notice when the server rejects`.

- [x] A aba e a tela de ligar não têm violações no axe, funcionam só pelo teclado e nos dois temas, a partir de 360 px (RNF-06, RNF-08, RNF-10).

  > Como comprovar: ver aprovados `has no axe violations` e `is operable by keyboard only`; em `connections-themes-widths.txt` e `connections-states-focus.txt`, ver só linhas `ok` (tema, sem rolagem horizontal, axe sem violações, estados e contorno de foco) e `ok  0 falha(s)`, e conferir nas pranchas `connections-themes-widths.png` e `connections-states-focus.png` os dois temas, as duas larguras, os estados e o foco.

- [x] Testes, typecheck e lint passam sem warning, e o e2e do CT-13 está escrito para a TASK-35.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; `connections.e2e.ts` aparece em `connections-files.txt`.

## Descrição

### Resumo executivo

Entrega a aba "Conexões", usada por todas as entidades para mostrar e criar as ligações com outras, com filtro, busca, agrupamento e categorias.
É o que torna o Atria um hub: finanças, notas, metas, leituras e diário ligados entre si nos dois sentidos.
Perfil padrão, risco baixo: as decisões estão tomadas e o servidor de ligações já existe.
Libera a integração do frontend, que monta a aba em cada tela de entidade.

### Detalhes técnicos

- **Abordagem:** feature React em `apps/web/src/features/connections` com um componente reutilizável, `ConnectionsTab({ entity_type, entity_id })`, e uma rota própria para ligar (`/connections/new`). O servidor (TASK-15) devolve as ligações dos dois lados; o hook normaliza para "a outra ponta" e aplica filtro, busca e agrupamento.
- **Componentes:** aba, item da ligação, tela de ligar, diálogo de remoção, mapa de categorias e rotas por tipo de entidade; usa `@atria/ui`, `@atria/theme`, `@atria/contracts` e `apps/web/src/shared`.
- **Decisões:** categorização pelo módulo da entidade ligada (Financeiro, Metas, Tarefas, Lembretes, Notas, Diário, Acervo, Projetos), e agrupamento por categoria ou por data da ligação; descartadas categorias livres criadas pela pessoa, que não estão no contrato de `/links`. Ligar em rota própria com volta à origem ([project/architecture-10]), descartado o seletor em modal. Estado da aba na URL com prefixo `connections_`, para não colidir com os filtros da tela que monta a aba ([project/frontend-13]). A feature não importa nenhuma outra: as rotas das entidades ficam em `ENTITY_CATEGORIES`, e a TASK-35 confere no e2e que batem com as rotas registradas.
- **Consumidores das ligações (DEC-002, DEC-003):** a TASK-30 lê sozinha a tarefa ligada a cada cartão (`GET /links` com `linked_type=task`) e não importa esta feature; o cartão "Ligações" da Visão geral do projeto (PD-42) recebe `ConnectionsSummary` pela propriedade `links_slot`, montada pela TASK-35, para as features não se importarem; descartado a TASK-30 repetir a lista. O título vem do `GET` por id de cada tipo (`use-linked-titles.ts`), porque o `/links` da TASK-15 não traz título; descartado pedir um título desnormalizado na ligação, que mudaria o contrato do servidor. Tipos e nomes seguem os 14 da TASK-15 (`project_card`, não `card`).
- **Cartão de projeto (TASK-14):** o título e o link do `project_card` vêm de `GET /cards/{card_id}`, que devolve o `project_id` para montar `/projects/<project_id>/cards/<card_id>` (rota da TASK-30). Descartados o rótulo do tipo sem link, que a versão anterior desta tarefa previa por falta da leitura por id, e guardar o `project_id` na ligação, que mudaria o contrato de `/links`.
- **Riscos:** rota de uma entidade diferente da definida pela feature dona (mitigado pelo e2e da TASK-35); `milestone` e `transfer` sem leitura por id no contrato (ficam com o rótulo do tipo, sem link); uma leitura por ligação para o título (aceitável para as poucas ligações de uma entidade, com cache).
- **Referências da spec:** RF-18, RF-19, CT-13, RN-10, CB-06, decisão 27, [project/architecture-05], RNF-06, RNF-08 a RNF-10; PD-42 e PD-46 de `docs/decisoes-do-prototipo.md`; DEC-002 e DEC-003 da memória; contrato de `/links` da TASK-15; `GET /cards/{card_id}` da TASK-14.
- **Evidências visuais:** as pranchas `connections-themes-widths.png` e `connections-states-focus.png` são geradas por `apps/web/scripts/evidence-connections.mjs`, no molde do `evidence-shots.mjs` da TASK-05: cada evidência é um comando cuja saída (`.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG. Como as rotas das features só são registradas no app pela TASK-35, o script monta a feature por `src/features/connections/evidence/harness.tsx` (rotas da feature e uma tela de teste com a aba, num roteador em memória com os providers e o layout do app), servido por uma página virtual do Vite, com a API simulada por fixtures; nada muda em `apps/web/src/app`.
- **Arquivos em comum na onda 7:** nenhum.

### Card

- **Título:** Aba Conexões
- **Tipo:** historia
- **Descrição:** Aba "Conexões" reutilizável por qualquer entidade, com ligações nos dois sentidos, filtro, busca, agrupamento e categorização, e uma tela própria para ligar entidades.
- **Critérios de aceite:**
  - [ ] A aba recebe só o tipo e o id da entidade e mostra as ligações dos dois lados.
  - [ ] Filtro por categoria, busca, agrupamento por categoria ou data, tudo na URL.
  - [ ] Ligar em tela própria e remover com confirmação, sumindo dos dois lados.
  - [ ] Cada ligação com o título da entidade (o cartão de projeto com título e link para o projeto dele), os 14 tipos do contrato e a lista compacta para as Ligações da Visão geral do projeto.
  - [ ] Interface otimista, estados vazio, carregando e erro, sem violações no axe.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | ajuste | in_progress | Evidências manuais connections-themes-widths.png e connections-states-focus.png trocadas por automáticas connections-themes-widths.txt e connections-states-focus.txt geradas por apps/web/scripts/evidence-connections.mjs, com a prancha PNG como Artefato; harness da feature em src/features/connections/evidence/harness.tsx montando as rotas e a aba sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 4 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
| 5 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 6 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 7 | 2026-10-31 | evidências | passed | 5 evidência(s) em evidence/TASK-31/ |
| 8 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler: decisoes-do-prototipo (PD-42, PD-46), DEC-002 e DEC-003 e contrato de /links da TASK-15; tipos alinhados aos 14 da TASK-15 (project_card no lugar de card, transfer e milestone), com project_card, milestone e transfer sem link; titulo de cada ligacao pelo GET por id (use-linked-titles.ts), pois /links nao traz titulo; uso de linked_type e linked_id do servidor; PD-42: ConnectionsSummary para o cartao Ligacoes da Visao geral do projeto, montado pela TASK-35 em links_slot; DEC-003: tarefa ligada ao cartao visivel do lado da tarefa; testes, Verificacao, evidencia connections-consumers.txt, Concluida quando, Detalhes tecnicos e card |
| 2 | 2026-10-30 | agente | Ler com GET /cards/{card_id} da TASK-14 e a rota do cartão da TASK-30; project_card com detail_path /cards/{id}, título title e link /projects/{project_id}/cards/{id} com o project_id da resposta, rótulo do tipo sem link enquanto carrega ou em 404 card_not_found; route como função do id e da resposta; testes, Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados; linha de Baseline que citava a pasta criada pela tarefa removida |
| 3 | 2026-10-31 | agente | Evidências manuais connections-themes-widths.png e connections-states-focus.png trocadas por automáticas connections-themes-widths.txt e connections-states-focus.txt geradas por apps/web/scripts/evidence-connections.mjs, com a prancha PNG como Artefato; harness da feature em src/features/connections/evidence/harness.tsx montando as rotas e a aba sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 4 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
