---
id: TASK-23
spec: SPEC-001
title: "Telas de Metas"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-36, RF-37, CT-23]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: efc133914957486cb85fba5df355cab29ea1aa8d70fa33b21f35c1cb2edf9ee6
adjustments: 6
adjusted_at: 2026-10-31T09:47:14Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: acd113d2c0f5bb820a93df5450050dd9822926d4630129ce740e2a7bf58b4781
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T09:47:14Z
model: sonnet
---

# TASK-23: Telas de Metas

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-36, RF-37, CT-23, RN-15, decisão 8 e os recursos `/goals` e `/goals/{id}/milestones` em "Contratos e interfaces")
- `prototype/atria-prototype.html` (telas de metas e marcos validadas no protótipo; pelas decisões do protótipo, o template `#entity-detail` com "Voltar", "Editar" e "Mais ações", a visão geral da meta em `overviewHTML` (`k === 'goal'`), as abas de `EXTRA_TABS.goal` (Marcos), o painel dos marcos, a constante `REPORTS` (relatório `goals-progress`), `REP_ENTITY` e o botão "Relatórios" do módulo, e o formulário `KINDS.goal` com a grade `.screen-form .form`)
- `docs/decisoes-do-prototipo.md` (linhas PD-11, PD-14, PD-19, PD-57, PD-59, PD-61 e PD-62 e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa)
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004 DEC-006`: DEC-002 (as decisões do protótipo valem já; os relatórios com filtros por entidade entram no MVP), DEC-004 (item 3: Progresso das metas sem período, com os filtros de meta e de situação) e DEC-006 (item 1: metas com etiquetas no servidor e o filtro por prazo, e o campo de etiquetas da base na tela)
- `vostok/work/tasks/SPEC-001/TASK-05.md` (componentes da base: `PageHeader` com "Voltar" e ações, `MenuButton`, `SelectField`, `SegmentedField`, `DateField`, `TagField`, `FormGrid`, `FormActions` e as ligações `FormSelect`, `FormSegmented`, `FormDate` e `FormTags` de `apps/web/src/shared/forms/form-fields.tsx`)
- `apps/web/scripts/evidence-shots.mjs` (molde das evidências visuais, TASK-05: Vite numa porta livre, Chromium do `@playwright/test`, temas claro e escuro, 1440 e 360 px, `check()` com `ok`/`FALHA`, prancha `sheet()` e código de saída 1 em falha)
- `vostok/work/tasks/SPEC-001/TASK-17.md` (passos 3 e 14: o relatório `goals-progress`, sem período, com os filtros `goal_id` e `goal_status`, e `GET /reports/{report}`)
- `vostok/work/tasks/SPEC-001/TASK-08.md` (passo 8: `GET|POST /goals` com `status`, `q`, `sort`, `cursor` e `limit`, `GET|PATCH|DELETE /goals/{id}` e o `goal_status` `planned`, `in_progress`, `completed` e `abandoned`; pela DEC-006, a TASK-08 acrescentou o campo `labels` da meta (`TEXT[]`, até 20 etiquetas de até 50 caracteres; uma repetida, sem diferenciar maiúsculas, dá 422), o filtro `label` (uma etiqueta por pedido) e o filtro `has_deadline=true|false`)
- `apps/web/src/app` (só leitura: layout e roteador raiz)
- `apps/web/src/shared` (cliente da API, interface otimista, aviso de recusa, `Intl`, estado da listagem na URL, i18n comum e helpers de teste com axe e relógio fixo)
- `packages/ui` (lista, cartão, campos, seletor, barra de progresso, chip de filtro, busca, alternador de visualização, diálogo de confirmação, estados vazio, carregando e erro)
- `packages/theme` (tokens e temas claro e escuro)
- `packages/contracts` (tipos gerados de metas, marcos, `goal_status` e etiquetas da meta)
- `vostok/rules/project/frontend.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`

### Mudar

- `apps/web/src/features/goals/routes.tsx` (criar): rotas `/goals`, `/goals/new`, `/goals/$goalId` e `/goals/$goalId/edit`, exportadas por `createGoalsRoutes` para a TASK-35 registrar.
- `apps/web/src/features/goals/nav.ts` (criar): item "Metas" da sidebar.
- `apps/web/src/features/goals/i18n/pt-br.json` (criar): textos das telas de metas.
- `apps/web/src/features/goals/lib/goal-progress.ts` (criar): progresso da meta pela porcentagem de marcos concluídos, ou pelo status quando não há marcos (RN-15).
- `apps/web/src/features/goals/lib/goal-progress.test.ts` (criar): testes do progresso (CT-23).
- `apps/web/src/features/goals/hooks/use-goals.ts` (criar): listagem com filtros e busca, criação e edição de metas.
- `apps/web/src/features/goals/hooks/use-goals.test.tsx` (criar): testes da listagem e das mutações otimistas com reversão.
- `apps/web/src/features/goals/hooks/use-milestones.ts` (criar): marcos da meta: criar, renomear, concluir, reabrir e excluir, com interface otimista.
- `apps/web/src/features/goals/hooks/use-milestones.test.tsx` (criar): testes dos marcos e do progresso atualizado na hora.
- `apps/web/src/features/goals/screens/goals-screen.tsx` (criar): listagem de metas com filtros, busca, lista ou grade e progresso (RF-36).
- `apps/web/src/features/goals/screens/goal-form-screen.tsx` (criar): criar e editar meta em rota própria (título, descrição, prazo opcional, status).
- `apps/web/src/features/goals/screens/goal-screen.tsx` (criar): tela da meta com o cabeçalho (PD-14), as abas Visão geral e Marcos e as abas extras recebidas por `extra_tabs` (RF-37).
- `apps/web/src/features/goals/screens/goal-overview.tsx` (criar): visão geral da meta em cartões, com "Progresso", "Descrição" e "Registro" (PD-59).
- `apps/web/src/features/goals/lib/goal-reports.ts` (criar): relatórios do módulo e da meta, com os caminhos `/reports/goals-progress?from_module=goals` e `/reports/goals-progress?goal_id=<id>&run=1&from_module=goals` (PD-61).
- `apps/web/src/features/goals/lib/goal-reports.test.ts` (criar): testes dos caminhos dos relatórios (PD-61).
- `apps/web/src/features/goals/screens/goals-screens.test.tsx` (criar): testes das três telas, dos estados e do axe (CT-23).
- `apps/web/src/features/goals/goals.e2e.ts` (criar): fluxo ponta a ponta de CT-23, rodado na TASK-35.
- `apps/web/src/features/goals/evidence/harness.tsx` (criar): página de evidência que monta as rotas de `createGoalsRoutes` num roteador em memória do TanStack Router (`createMemoryHistory`), com os providers do app (`AppProviders`: tema, TanStack Query, i18n e preferências) e dentro do layout do app (`AppLayout`); não é importada pelo app nem por `apps/web/src/app` (nada muda em `apps/web/src/app`) e por isso fica fora do build de produção; só tokens do tema (a Verificação de cor literal continua valendo); passa no typecheck e no lint.
- `apps/web/scripts/evidence-goals.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-goals.mjs telas`), em Node sem dependências novas, no molde de `apps/web/scripts/evidence-shots.mjs` (código próprio, sem importar o da TASK-05): sobe o Vite numa porta livre por `createServer` da API do Vite, com um plugin que serve uma página HTML virtual carregando o `harness.tsx`, e o encerra no fim (KNW-006); simula a API com `context.route('/api/**')` e fixtures em memória no próprio script (metas com e sem prazo, uma com prazo vencido, etiquetas, quatro marcos com um concluído, respostas lentas para o estado de carregando e `problem+json` para o erro); captura nos temas claro e escuro, em 1440 px e em 360 px, confere o estado no DOM antes de cada captura e imprime `ok` ou `FALHA` por verificação, o caminho do PNG e a última linha `ok  0 falha(s)`; sai com código diferente de 0 se algo falhar. Em cada captura: tema aplicado, sem rolagem horizontal, sem erro de JS e axe sem violações, incluindo `color-contrast` (`@axe-core/playwright`, já em devDependencies). A prancha vai para `vostok/work/tasks/SPEC-001/evidence/TASK-23/goals-telas.png`.

### Passos

1. Leia os arquivos de "Ler" e anote os nomes do cliente da API, do helper de mutação otimista, do aviso de recusa, da formatação `Intl`, do estado da listagem na URL e do relógio injetável em `apps/web/src/shared`, e os valores do `goal_status` em `@atria/contracts` (`planned`, `in_progress`, `completed` e `abandoned`, TASK-08), o campo `labels` da meta e os filtros `label` e `has_deadline` de `GET /goals` (DEC-006). Use esses nomes nos passos seguintes, sem criar equivalentes.
2. Crie `apps/web/src/features/goals/i18n/pt-br.json` com chaves em `snake_case` agrupadas por tela (`list`, `form`, `detail`, `milestones`, `status`, `nav`), com `status.planned` "Planejada", `status.in_progress` "Em andamento", `status.completed` "Concluída" e `status.abandoned` "Abandonada" (um rótulo por valor do `goal_status`), em tom calmo e sem gamificação (ex.: vazio: "Nenhuma meta por aqui. Crie uma quando fizer sentido."). Prazo vencido usa texto neutro ("Prazo em 12 de out."), sem "atrasada".
3. Escreva `lib/goal-progress.test.ts` e depois `goal-progress.ts` com `goalProgress(goal, milestones)` que devolve um inteiro de 0 a 100: com marcos, `Math.floor(concluídos * 100 / total)`; sem marcos, 100 para o status `completed` e 0 para `planned`, `in_progress` e `abandoned` (RN-15). Testes `returns 25 with one of four milestones done`, `returns 100 with all milestones done`, `uses the status when there are no milestones` e `ignores removed milestones`.
4. Escreva `hooks/use-goals.test.tsx` e depois `use-goals.ts`: `useGoals(filters)` com `useInfiniteQuery` por cursor e os filtros `status` (um valor do `goal_status`), `label`, `has_deadline` (`true` ou `false`; ausente, qualquer meta) e `q`, enviados a `GET /api/v1/goals` com os nomes da TASK-08 (DEC-006); `useCreateGoal` (`POST /api/v1/goals`, não otimista na lista, navega para a meta criada), `useUpdateGoal` (otimista com reversão e aviso) e `useDeleteGoal` (`DELETE /api/v1/goals/{id}`, otimista na lista, com reversão e aviso, navega para `/goals`) (PD-14). Testes `lists goals with filters from the url`, `dec006 sends the label and has_deadline filters to the server` (com `?label=casa&has_deadline=true` na URL, a requisição leva `label=casa` e `has_deadline=true`), `creates a goal with an optional deadline`, `rolls back a goal update when refused` e `deletes a goal and rolls back when refused`.
5. Escreva `hooks/use-milestones.test.tsx` e depois `use-milestones.ts`: `useMilestones(goalId)` (`GET /api/v1/goals/{id}/milestones`), `useCreateMilestone` (`POST`), `useToggleMilestone`, `useRenameMilestone` e `useDeleteMilestone` conforme as operações do contrato, todas otimistas no cache da meta e dos marcos, com reversão e aviso quando recusadas (RNF-09); o progresso exibido vem de `goalProgress` sobre o cache, e por isso muda na hora. Testes `adds four milestones`, `completes a milestone and shows 25 percent at once` e `rolls back a completed milestone when refused`.
6. Para cada tela, escreva primeiro o teste em `screens/goals-screens.test.tsx` (Testing Library, `userEvent` e axe) e depois a tela. Todo teste verifica: cabeçalho com `page-heading` e subtítulo; estados carregando, vazio com texto explicativo e erro com "Tentar de novo"; erros de formulário em `role="alert"`; navegação completa por `userEvent.tab()` com foco visível; zero violações no axe. Escreva antes `lib/goal-reports.ts`: `GOALS_REPORTS = [{ id: 'goals-progress', title_key: 'goals.reports.goals_progress' }]` (o único relatório do módulo `goals` no catálogo da TASK-17), `goalsReportHref(id)` que devolve `/reports/<id>?from_module=goals` e `goalReportHref(goalId)` que devolve `/reports/goals-progress?goal_id=<goalId>&run=1&from_module=goals`, com o teste `lib/goal-reports.test.ts` `builds the module and the goal report paths` (PD-61).
7. `goals-screen.tsx` em `/goals`: filtros por status, por etiqueta e por prazo, busca e visualização em lista ou grade, com os nomes acessíveis "Filtros", "Busca" e "Visualização" (usados pelos e2e da TASK-35), na URL (`?status=&label=&has_deadline=&q=&view=`); o filtro de status é o `SelectField` da TASK-05, nunca um `<select>` nativo (PD-62), com "Todos" e os quatro valores do `goal_status`; o de prazo é um `SelectField` "Prazo" com "Qualquer" (sem `has_deadline`), "Com prazo" (`true`) e "Sem prazo" (`false`); o de etiqueta é um `TextField` "Etiqueta" que grava `?label=` ao confirmar com Enter e limpa com o campo vazio (DEC-006); cada meta mostra título, status, as etiquetas em pills, prazo por `Intl` no fuso do usuário e a barra de progresso (`role="progressbar"`, `aria-valuenow`, rótulo com a porcentagem por `Intl.NumberFormat` em `percent`); item sem imagem tem a cor derivada do id. O cabeçalho tem "Nova meta" (primário) e "Relatórios", um `MenuButton` da TASK-05 com um item por relatório de `GOALS_REPORTS` ("Progresso das metas", link para `/reports/goals-progress?from_module=goals`) (PD-61). Testes `filters and searches goals through the url`, `dec006 filters goals by label and by deadline through the url` (escolher "Com prazo" e digitar "casa" + Enter deixam `?has_deadline=true&label=casa` na URL), `pd62 lists the four goal statuses in the status filter` ("Planejada", "Em andamento", "Concluída" e "Abandonada"), `switches between list and grid`, `shows empty, loading and error states` e `pd61 lists the goals reports in the Relatórios menu` (abre o menu e vê "Progresso das metas" com `href="/reports/goals-progress?from_module=goals"`).
8. `goal-form-screen.tsx` em `/goals/new` e `/goals/$goalId/edit`: `react-hook-form` com `zod` (título obrigatório, descrição opcional, prazo opcional em data, status `z.enum(['planned', 'in_progress', 'completed', 'abandoned'])` com padrão `planned`, etiquetas `string[]` opcionais, enviadas como `labels` (até 20, cada uma com até 50 caracteres, sem repetidas sem diferenciar maiúsculas, as mesmas regras da TASK-08; o erro aparece no campo com `role="alert"`, e o 422 do servidor também), visibilidade pessoal ou compartilhada com padrão pessoal), com a base da TASK-05 (PD-19, PD-62): o `PageHeader` com "Voltar" e o formulário numa coluna centralizada na largura do `FormGrid`; título, descrição, etiquetas e visibilidade com `data-span="full"`, e status e prazo lado a lado; o status em `FormSelect` com os quatro valores do `goal_status` (`planned`, `in_progress`, `completed` e `abandoned`, TASK-08; o protótipo tem três status próprios, que não valem: são mais de três opções, por isso o seletor e não o grupo segmentado); as etiquetas no `FormTags`, o `TagField` da base em pills (PD-11, DEC-006), enviadas como `labels`; o prazo em `FormDate`, o calendário próprio com "Hoje" e "Limpar" (PD-57); a visibilidade em `FormSegmented` ("Pessoal" e "Compartilhada"); e o `FormActions` com "Cancelar" (`ghost`, volta à meta na edição e à lista na criação) e "Salvar". Testes `creates a goal with title, deadline and status`, `shows the validation error inside the form`, `pd62 lays the form in the grid with title, description and visibility on the full row` (os três e as etiquetas com `data-span="full"`, nenhum `<select>` nem `<input type="date">` nativo, e "Cancelar" antes de "Salvar"), `dec006 adds labels as pills and sends them with the goal` ("casa" + Enter e "saúde" + vírgula viram duas pills, e o envio leva `labels: ['casa', 'saúde']`), `dec006 refuses more than 20 labels or a label longer than 50 characters inside the form` (o erro em `role="alert"` no campo e nenhum envio), `pd62 offers the four goal statuses in the form` (abre o seletor e vê as quatro opções, com "Planejada" escolhida na criação), `pd57 picks the deadline in the custom calendar` (abre o `DateField`, escolhe um dia com as setas e Enter e envia `deadline` em `YYYY-MM-DD`; "Limpar" envia `deadline: null`) e `pd19 centers the header and the form in the form column`.
9. `goal-screen.tsx` em `/goals/$goalId`: cabeçalho com "Voltar", eyebrow "Metas · Meta", título e subtítulo (prazo e porcentagem) e, nas ações, "Editar" com o ícone de lápis (link para a rota de edição) e o `MenuButton` "⋯ Mais ações" (botão só com ícone, `aria-label="Mais ações"`) com a seção "Relatórios" ("Progresso das metas", link para `goalReportHref(goalId)`, PD-61), uma linha separadora e "Excluir" em tom `danger`, que pede confirmação e chama `useDeleteGoal` (PD-14); abas Visão geral (padrão) e Marcos na URL (`tab=overview|milestones`), seguidas das abas recebidas pela propriedade `extra_tabs` (`{ id, label, render }[]`), para a TASK-35 montar Conexões sem esta feature importar outras. `goal-overview.tsx` (PD-59): zona principal com o cartão "Progresso" (barra de progresso e os campos Progresso, com "(pelo status)" quando não há marcos, Status e Prazo, ou "Sem prazo") e o cartão "Descrição" só quando houver descrição; lateral com o cartão "Registro" (as etiquetas em pills no topo, quando houver, como o `reg` do protótipo, e Visibilidade, Criado em e Atualizado em, por `Intl`) (DEC-006); duas zonas que viram uma coluna abaixo de 960 px. A aba Marcos tem a barra de progresso, a lista de marcos com caixa de seleção para concluir ou reabrir, o campo em linha para acrescentar marco (Enter adiciona) e excluir marco com diálogo de confirmação. Testes `creates a goal, adds four milestones, completes one and shows 25 percent`, `deletes a milestone after confirmation`, `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações`, `deletes the goal after confirmation from Mais ações`, `pd61 opens the goal progress report filtered by the goal from Mais ações` (o item tem `href="/reports/goals-progress?goal_id=<id>&run=1&from_module=goals"`), `pd59 shows the overview in cards with Progresso, Descrição and Registro` (sem descrição, o cartão "Descrição" não aparece; com etiquetas, elas aparecem no cartão "Registro") e `shows the Visão geral and Marcos tabs before the extra tabs`.
10. Crie `apps/web/src/features/goals/nav.ts` exportando `goalsNav` com `path: '/goals'`, `label_key: 'goals.nav.title'` e o ícone SVG, no formato de item de navegação de `apps/web/src/shared`.
11. Crie `apps/web/src/features/goals/routes.tsx` exportando `createGoalsRoutes(parent: AnyRoute)` com as quatro rotas, o esquema `zod` dos parâmetros de busca da lista e o `tab` (`overview` ou `milestones`, padrão `overview`) da tela da meta. Não altere `apps/web/src/app`.
12. Crie `apps/web/src/features/goals/goals.e2e.ts` com `goal with four milestones shows 25 percent after one is done`, em 360 px e desktop, com axe. Não rode: os e2e rodam na TASK-35.
13. Rode o bloco de "Verificação" e corrija até passar sem warnings.
14. Crie `apps/web/src/features/goals/evidence/harness.tsx` e `apps/web/scripts/evidence-goals.mjs` (veja "Mudar"), com as verificações de cada estado listadas na evidência `goals-telas.txt`, e rode `node apps/web/scripts/evidence-goals.mjs telas`. Corrija o código da tarefa a cada linha `FALHA` (nunca a verificação) e repita até a última linha ser `ok  0 falha(s)`; depois abra `vostok/work/tasks/SPEC-001/evidence/TASK-23/goals-telas.png` e confira cada estado nos dois temas e nas duas larguras. Não altere `apps/web/src/app`: as rotas só são registradas na TASK-35.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# Testes de componente, de hook e das funções puras da feature (Vitest + Testing Library + axe)
pnpm --filter @atria/web test -- src/features/goals
# Tipos e lint sem nenhum erro ou warning
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
# e2e escrito (roda na TASK-35)
test -s apps/web/src/features/goals/goals.e2e.ts
# Nenhuma cor literal fora dos tokens do tema
! grep -rnE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(' apps/web/src/features/goals --include=*.tsx --include=*.ts --include=*.css
# Nenhum controle nativo que a base da TASK-05 substitui (PD-57, PD-62)
! grep -rnE '<select|type="(date|number)"' apps/web/src/features/goals --include=*.tsx
# Harness e script das evidências visuais
test -f apps/web/src/features/goals/evidence/harness.tsx
test -f apps/web/scripts/evidence-goals.mjs
node --check apps/web/scripts/evidence-goals.mjs
```

### Evidências

- `goals-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/goals --reporter=verbose`
  - Prova: metas, marcos e progresso passam nos testes, com interface otimista, reversão e axe sem violações (RF-36, RF-37, CT-23, RNF-06, RNF-09).
  - Trecho: as linhas `✓` de `returns 25 with one of four milestones done`, `completes a milestone and shows 25 percent at once`, `creates a goal, adds four milestones, completes one and shows 25 percent`, `rolls back a completed milestone when refused` e `shows empty, loading and error states`, e o resumo sem falhas.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `goals-pd-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/goals --reporter=verbose -t "(pd|dec)[0-9]"`
  - Prova: as telas seguem as decisões do protótipo e a DEC-006: relatórios do módulo e da meta, cabeçalho do detalhe, visão geral em cartões, formulário na grade, calendário próprio, coluna centralizada, etiquetas em pills, filtros de etiqueta e de prazo e os quatro valores do `goal_status` (DEC-002, DEC-006, PD-11, PD-14, PD-19, PD-57, PD-59, PD-61, PD-62).
  - Trecho: as linhas `✓` de `dec006 sends the label and has_deadline filters to the server`, `dec006 filters goals by label and by deadline through the url`, `dec006 adds labels as pills and sends them with the goal`, `pd62 lists the four goal statuses in the status filter`, `pd62 offers the four goal statuses in the form`, `pd61 lists the goals reports in the Relatórios menu`, `pd61 opens the goal progress report filtered by the goal from Mais ações`, `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações`, `pd59 shows the overview in cards with Progresso, Descrição and Registro`, `pd62 lays the form in the grid with title, description and visibility on the full row`, `pd57 picks the deadline in the custom calendar` e `pd19 centers the header and the form in the form column`.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `goals-e2e-specs.txt` (automática): `grep -n "test(" apps/web/src/features/goals/goals.e2e.ts`
  - Prova: o fluxo ponta a ponta de CT-23 está escrito para a TASK-35.
  - Trecho: a linha com `goal with four milestones shows 25 percent after one is done`.
  - Falha: `No such file or directory` ou saída vazia.
- `goals-telas.txt` (automática): `node apps/web/scripts/evidence-goals.mjs telas`
  - Prova: identidade visual, tom calmo, os dois temas, 360 px e desktop, os estados e o foco por teclado, medidos no DOM e fotografados: lista em lista e em grade com o menu "Relatórios" aberto, filtros de status, etiqueta e prazo, lista vazia, carregando e com erro, formulário na grade com as etiquetas em pills e o calendário do prazo aberto, formulário com erro de validação, visão geral da meta em cartões com o "Mais ações" aberto, aba Marcos com quatro marcos e um concluído (25%) e foco visível pelo teclado na caixa de um marco (RNF-06, RNF-08, RNF-10).
  - Trecho: uma linha `ok` por verificação, como `ok ... tema claro aplicado` e `ok ... tema escuro aplicado`, `ok ... menu "Relatórios" aberto · item "Progresso das metas"`, `ok ... filtro de status com Planejada, Em andamento, Concluída e Abandonada`, `ok ... ?has_deadline=true&label=casa na URL`, `ok ... lista vazia com texto explicativo`, `ok ... carregando visível`, `ok ... erro com "Tentar de novo"`, `ok ... etiquetas em pills · 2 pills`, `ok ... calendário do prazo dentro da janela`, `ok ... erro de validação em role="alert" dentro do formulário`, `ok ... nenhum <select> nem input date nativo`, `ok ... "Cancelar" antes de "Salvar", à direita`, `ok ... cartões Progresso, Descrição e Registro`, `ok ... "Mais ações" aberto · "Excluir" visível`, `ok ... barra de progresso aria-valuenow 25 · "25%"`, `ok ... prazo vencido sem "atrasada" e sem a cor de perigo`, `ok ... foco na caixa de um marco por Tab · contorno de foco visível ≥ 2 px` e, em cada captura, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclui color-contrast)`; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-23/goals-telas.png (42 capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (rolagem horizontal em 360 px, gamificação ou vermelho no prazo vencido, estado sem texto, foco invisível, violação no axe ou de contraste, controle nativo), a ausência da linha `png:`, a prancha sem algum dos estados ou código de saída diferente de 0 (`Cannot find module` antes da tarefa, porque o script não existe).
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-23/goals-telas.png`, a prancha com as 42 capturas rotuladas: 10 estados (lista em lista com o prazo vencido, grade com "Relatórios" aberto, filtros com o seletor de status aberto, vazia, carregando, erro, formulário com pills e calendário aberto, formulário com erro de validação, visão geral com "Mais ações" aberto e aba Marcos com 25%) nos temas claro e escuro, em 1440 px e em 360 px, mais o foco na caixa de um marco em desktop nos dois temas.

### Concluída quando

- [x] Metas são cadastradas e editadas com título, descrição, prazo opcional e status, numa listagem com filtros, busca e visualização na URL (RF-36, CT-23).

  > Como comprovar: em `goals-tests.txt`, ver aprovados `creates a goal with title, deadline and status`, `filters and searches goals through the url` e `switches between list and grid`.

- [x] Marcos são acrescentados e concluídos, e o progresso é a porcentagem de marcos concluídos, mudando na hora (RF-37, CT-23).

  > Como comprovar: em `goals-tests.txt`, ver aprovados `returns 25 with one of four milestones done`, `completes a milestone and shows 25 percent at once` e `creates a goal, adds four milestones, completes one and shows 25 percent`.

- [x] Sem marcos, o progresso segue o status, e a recusa do servidor desfaz a mudança com aviso (RF-37, RNF-09).

  > Como comprovar: em `goals-tests.txt`, ver aprovados `uses the status when there are no milestones`, `rolls back a goal update when refused` e `rolls back a completed milestone when refused`.

- [x] As telas têm estados vazio, carregando e erro, navegam por teclado e não têm violações no axe (RNF-06).

  > Como comprovar: em `goals-tests.txt`, ver aprovado `shows empty, loading and error states` e o resumo sem falhas.

- [x] As telas funcionam em 360 px e desktop, nos dois temas, em tom calmo e só com tokens do tema (RNF-08, RNF-10).

  > Como comprovar: em `goals-telas.txt`, ver só linhas `ok`, inclusive `axe sem violações (inclui color-contrast)`, `sem rolagem horizontal`, `prazo vencido sem "atrasada" e sem a cor de perigo` e `contorno de foco visível ≥ 2 px`, e a última linha `ok  0 falha(s)`; abrir a prancha `goals-telas.png` e conferir as telas legíveis nos dois temas e larguras; o comando de cor literal da Verificação não encontra nada.

- [x] O módulo e a meta emitem o relatório "Progresso das metas": pelo botão "Relatórios" do cabeçalho da lista e pelo "Mais ações" da meta, já filtrado por ela (PD-61, DEC-002).

  > Como comprovar: em `goals-pd-tests.txt`, ver aprovados `pd61 lists the goals reports in the Relatórios menu` e `pd61 opens the goal progress report filtered by the goal from Mais ações`.

- [x] A tela da meta tem "Editar" com lápis e "Mais ações" com o relatório e "Excluir" em vermelho, e a visão geral em cartões (Progresso, Descrição e Registro), com os marcos na aba Marcos (PD-14, PD-59).

  > Como comprovar: em `goals-pd-tests.txt`, ver aprovados `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações` e `pd59 shows the overview in cards with Progresso, Descrição and Registro`; em `goals-tests.txt`, `deletes the goal after confirmation from Mais ações` e `shows the Visão geral and Marcos tabs before the extra tabs`.

- [x] A meta tem etiquetas em pills no formulário e no cartão "Registro", a lista filtra por etiqueta e por prazo, e o status usa os quatro valores do `goal_status` (`planned`, `in_progress`, `completed` e `abandoned`) (DEC-006, PD-11, PD-62).

  > Como comprovar: em `goals-pd-tests.txt`, ver aprovados `dec006 sends the label and has_deadline filters to the server`, `dec006 filters goals by label and by deadline through the url`, `dec006 adds labels as pills and sends them with the goal`, `pd62 lists the four goal statuses in the status filter` e `pd62 offers the four goal statuses in the form`.

- [x] O formulário usa a base da TASK-05: grade de duas colunas numa coluna centralizada, prazo no calendário próprio, status e visibilidade nos seletores da base e as ações à direita (PD-19, PD-57, PD-62).

  > Como comprovar: em `goals-pd-tests.txt`, ver aprovados `pd62 lays the form in the grid with title, description and visibility on the full row`, `pd57 picks the deadline in the custom calendar` e `pd19 centers the header and the form in the form column`; o último comando da Verificação não encontra controle nativo.

- [x] Typecheck e lint passam sem warning, e o e2e da feature está escrito para a TASK-35.

  > Como comprovar: rodar o bloco de "Verificação" e ver que termina sem erro; `goals-e2e-specs.txt` lista o fluxo.

## Descrição

### Resumo executivo

Entrega as telas de Metas: cadastro com prazo opcional e status, marcos e o progresso calculado pelos marcos concluídos.
A pessoa acompanha o que quer alcançar sem pressão, com o progresso atualizado na hora.
Perfil padrão, risco baixo: só cria as telas da própria área sobre um contrato já pronto.
Depende da base do frontend e dos contratos do servidor; destrava a integração final do frontend.

### Detalhes técnicos

**Abordagem.** Feature isolada em `apps/web/src/features/goals`, com telas sem regra de negócio, hooks do TanStack Query e uma função pura de progresso. Formulários com `react-hook-form` e `zod`. A feature exporta `createGoalsRoutes` e `goalsNav`.

**Componentes.** Lista (`/goals`, com `?status=&label=&has_deadline=&q=&view=` e o menu "Relatórios"), formulário em rota própria (`/goals/new`, `/goals/$goalId/edit`) e tela da meta (`/goals/$goalId?tab=overview|milestones`) com a visão geral em cartões e a aba Marcos. Rotas de relatório consumidas: `/reports/goals-progress?from_module=goals` e `/reports/goals-progress?goal_id=<id>&run=1&from_module=goals` (TASK-34, sobre `GET /reports/goals-progress?from_module=goals` da TASK-17).

**Decisões.**
- Progresso calculado no cliente por `goalProgress` sobre o cache, com a mesma regra do servidor (RN-15), para a barra mudar na hora ao concluir um marco. Descartada: esperar o progresso devolvido pelo servidor, que contraria a interface otimista ([project/frontend-18]). O servidor continua sendo a fonte; o cache é substituído pelo retorno.
- Marcos editados em linha na tela da meta, por serem itens curtos da própria meta; a meta é criada e editada em rota própria. Excluir marco usa diálogo de confirmação.
- Prazo vencido com texto neutro e sem vermelho ([project/frontend-14]).
- Relatórios pelo módulo e pela meta (DEC-002, PD-61): o botão "Relatórios" da lista e o "Mais ações" da meta levam à página do relatório da TASK-34 (`/reports/goals-progress?from_module=goals`, e com `goal_id` quando vem da meta), com o padrão dos relatórios emitidos pelos módulos e pelas entidades, `/reports/<id>?<filtro>_id=<id>&run=1&from_module=<módulo>` (o nome do filtro é o do servidor, TASK-17; `run=1` gera na hora e `from_module` dá o "Voltar" da TASK-34). Descartado: gerar o relatório na própria tela de metas, que duplicaria a TASK-34.
- Cabeçalho do detalhe com "Editar" e "Mais ações" (PD-14) e "Excluir" só dentro do menu; descartado o botão "Excluir" visível.
- Visão geral em cartões e marcos numa aba própria, como no protótipo (PD-59, `EXTRA_TABS.goal`); a tela recebe `extra_tabs` para a TASK-35 montar Conexões depois de Marcos. Descartado: marcos na visão geral, que o protótipo separa.
- Formulário com a base da TASK-05 (PD-19, PD-57, PD-62): `FormGrid`, `FormActions`, `FormDate` no prazo, `FormSelect` no status e `FormSegmented` na visibilidade.
- Status pelo `goal_status` real da TASK-08: `planned`, `in_progress`, `completed` e `abandoned`, em `FormSelect` (mais de três opções) e no filtro da lista. Descartados: os três status do protótipo (`active`, `paused`, `done`), que não existem no servidor, e o grupo segmentado condicional.
- Etiquetas e filtros (DEC-006, item 1): a meta ganha `labels` no `FormTags` (o `TagField` da base, PD-11), mostradas em pills na lista e no cartão "Registro"; a lista filtra por `label` e `has_deadline`, que a TASK-08 passa a oferecer. O filtro de etiqueta é um campo de texto confirmado com Enter, porque não há rota que liste as etiquetas existentes. Descartado: tirar as etiquetas da tela.

**Evidências visuais.** A prancha `goals-telas.png` é gerada por `apps/web/scripts/evidence-goals.mjs`, no molde do `evidence-shots.mjs` da TASK-05: a evidência é o comando, cuja saída (`goals-telas.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG. Como as rotas da feature só são registradas no app na TASK-35 (antes disso o `pnpm dev` mostra só a casca, com 404), o script serve uma página virtual com `src/features/goals/evidence/harness.tsx`, que monta `createGoalsRoutes` num roteador em memória com os providers e o layout do app, sem mudar `apps/web/src/app` e fora do build de produção; a API é simulada no navegador com fixtures do próprio script. Descartado: capturar à mão com `pnpm dev`, impossível sem as rotas registradas, e registrar as rotas antes da TASK-35, que muda `apps/web/src/app`.

**Riscos.** O campo `labels` e os filtros `label` e `has_deadline` vêm do ajuste da TASK-08 pela DEC-006; a tela repete os limites do servidor (20 etiquetas de até 50 caracteres, sem repetidas) para o erro aparecer antes do envio. A operação de reabrir marco também depende do contrato do contexto goals (TASK-08).

**Referências.** RF-36, RF-37; CT-23; RN-15; RNF-06, RNF-08, RNF-09, RNF-10; decisão 8 da spec; DEC-002, DEC-004 e DEC-006; PD-11, PD-14, PD-19, PD-57, PD-59, PD-61 e PD-62 de `docs/decisoes-do-prototipo.md`.

**Arquivos em comum na onda 7.** Nenhum: cada feature só cria arquivos na própria pasta.

### Card

- **Título:** Telas de Metas
- **Tipo:** historia
- **Descrição:** Telas de Metas com marcos opcionais e o progresso pela porcentagem de marcos concluídos.
- **Critérios de aceite:**
  - [ ] Metas são cadastradas com título, descrição, prazo opcional, status (Planejada, Em andamento, Concluída ou Abandonada) e etiquetas.
  - [ ] A lista filtra por status, etiqueta e prazo.
  - [ ] Com quatro marcos e um concluído, o progresso mostra 25%.
  - [ ] Concluir um marco atualiza o progresso na hora e desfaz com aviso se recusado.
  - [ ] O módulo e a meta emitem o relatório "Progresso das metas", já filtrado pela meta quando vem dela.
  - [ ] A meta tem "Editar", "Mais ações" com "Excluir" e a visão geral em cartões, com os marcos numa aba.
  - [ ] O formulário segue a grade da base, com o prazo no calendário próprio.
  - [ ] Telas acessíveis, com estados vazio, carregando e erro, em 360 px e desktop, nos dois temas.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 4 | 2026-10-31 | ajuste | in_progress | Evidência manual goals-telas.png trocada por automática goals-telas.txt gerada por apps/web/scripts/evidence-goals.mjs, com a prancha PNG como Artefato; harness da feature em src/features/goals/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo 14 novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 5 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 6 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 7 | 2026-10-31 | evidências | passed | 4 evidência(s) em evidence/TASK-23/ |
| 8 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004, TASK-05 (componentes), TASK-17 (goals-progress com goal_id e goal_status) e TASK-08 (rotas e status); PD-61: botão Relatórios na lista e Progresso das metas no Mais ações da meta com goal_id, lib/goal-reports.ts e testes pd61; PD-14: Editar com lápis e Mais ações com Excluir em danger, useDeleteGoal e testes; PD-59: visão geral em cartões Progresso, Descrição e Registro, marcos na aba Marcos e extra_tabs para a TASK-35; PD-62 e PD-19: FormGrid, FormActions, FormSelect no status, FormSegmented na visibilidade, coluna centralizada; PD-57: prazo no FormDate; Verificação sem controles nativos; evidência goals-pd-tests.txt, Concluída quando, Detalhes técnicos e card atualizados |
| 2 | 2026-10-30 | agente | Links dos relatórios no padrão do Coordenador para módulos e entidades: módulo /reports/goals-progress?from_module=goals e meta /reports/goals-progress?goal_id=<id>&run=1&from_module=goals, em Mudar, Passos, testes pd61, Concluída quando e Detalhes técnicos (PD-61); linha test -e da pasta da feature removida da Baseline, recusada pela validação |
| 3 | 2026-10-30 | agente | Etiquetas da meta no FormTags (TagField da base) no formulário, em pills na lista e no cartão Registro, e filtros tag e has_deadline na lista e no useGoals, com testes dec006 (DEC-006, PD-11); goal_status real planned, in_progress, completed e abandoned no filtro, no formulário (FormSelect, sem o grupo segmentado condicional), no i18n e no goalProgress, com testes pd62; Ler, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 4 | 2026-10-30 | agente | Nomes do contrato da TASK-08 ajustada (DEC-006): campo labels no lugar de tags e filtro label no lugar de tag, na URL, no useGoals, no formulário, nos testes dec006 e nos Detalhes técnicos; limites de 20 etiquetas de até 50 caracteres sem repetidas no zod, com o teste dec006 refuses more than 20 labels or a label longer than 50 characters inside the form; has_deadline=true\|false confirmado |
| 5 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 6 | 2026-10-31 | agente | Evidência manual goals-telas.png trocada por automática goals-telas.txt gerada por apps/web/scripts/evidence-goals.mjs, com a prancha PNG como Artefato; harness da feature em src/features/goals/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo 14 novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
