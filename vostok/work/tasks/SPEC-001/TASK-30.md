---
id: TASK-30
spec: SPEC-001
title: "Telas de Projetos"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-54, RF-55, RF-56, RF-57, CT-30]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: ea318978e9102b63d85af36883f13aa6ddb90b3bb58ad29c6feb390822d3ee72
adjustments: 4
adjusted_at: 2026-10-31T11:42:47Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 5c940acd52ce3f434ee91b7e8ba7cba43b7fc25234db21b4461a2096511c68f7
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T11:42:47Z
model: sonnet
---

# TASK-30: Telas de Projetos

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-54 a RF-57, CT-30, RN-16, RN-20, CB-07, CB-08, RNF-06, RNF-08 a RNF-10 e decisão 5.
- `vostok/rules/project/frontend.md`: estados de listagem, filtros na URL, cor determinística, tom calmo, teclado e Optimistic UI.
- `vostok/rules/project/architecture.md`: [project/architecture-07] e [project/architecture-10] (modal só para confirmação).
- `vostok/rules/project/code-style.md`: componentes sem regra de negócio, só tokens do tema.
- `vostok/rules/project/testing.md`: Vitest, Testing Library, axe e testes determinísticos.
- `vostok/rules/project/language.md`: textos em arquivo de tradução.
- `vostok/rules/project/naming-convention.md`: arquivos em `kebab-case`, chaves de objetos em `snake_case`.
- `prototype/atria-prototype.html`: lista, grade e Kanban de Projetos validados no protótipo.
- `apps/web/src/app`: só leitura, para ver o layout e como a TASK-35 registra `routes.tsx` e `nav.ts`.
- `apps/web/src/shared`: cliente da API, mutação otimista, formatação com `Intl`, i18n comum e tipo do item de navegação.
- `packages/ui`: página, abas, lista, grade, cartão, formulário, `FormGrid` e `FormActions`, `SelectField`, `DateField`, `TagField`, `Checkbox`, `MenuButton`, estados e diálogo de confirmação, e, entregues pela TASK-05, o seletor de cor da PD-12 e as variações `muted` e `success` do `Button`. Esta tarefa não cria esses componentes.
- `packages/theme`: tokens do tema e o HEX de `--primary` do tema claro (cor inicial de uma raia nova).
- `packages/contracts`: tipos gerados de `/projects`, `/projects/{id}/summary`, `/projects/{id}/lanes`, `/projects/{id}/lanes/order`, `/projects/{id}/cards`, `/projects/{id}/cards/{card_id}/move`, `/links` e `/tasks`.
- `docs/decisoes-do-prototipo.md`: linhas PD-07, PD-11, PD-12, PD-14, PD-19, PD-41 a PD-47, PD-57, PD-61 e PD-62, e a seção "Decisões resolvidas em 30/10 (DEC-002)". As decisões valem sobre o texto antigo desta tarefa.
- `vostok/memory/decisions.md`: DEC-002 (as telas seguem as decisões do protótipo; os campos novos do cartão entram no MVP; cada raia tem "conta como concluída"), DEC-003 (a tarefa ligada ao cartão é uma ligação `project_card` com `task` do contexto `links`) e DEC-004, consultadas com `vostok memory search decision DEC-002 DEC-003 DEC-004`.
- `vostok/work/tasks/SPEC-001/TASK-14.md`: contrato de Projetos ajustado: raia com `color` HEX `#rrggbb` e `counts_as_done`; cartão com `priority`, `labels`, `due_date` e `checklist`; `POST /projects/{id}/cards` com `lane_id` obrigatório; `POST /projects/{id}/cards/{card_id}/move` com `lane_id` e `position`; `PUT /projects/{id}/lanes/order`; `GET /projects/{id}/summary?today=` com `progress`, `lanes`, `upcoming_due` e `in_progress`; `progress` também na listagem; erros `last_lane`, `lane_has_cards`, `invalid_target_lane` e `validation_failed`.
- `vostok/work/tasks/SPEC-001/TASK-15.md`: contrato de `/links`: `GET /links?entity_type=&entity_id=&linked_type=` com `linked_type` e `linked_id`, `POST /links` e `DELETE /links/{id}`, tipo `project_card`, erro 409 `link_already_exists`.
- `vostok/work/tasks/SPEC-001/TASK-09.md`: `GET /tasks` (com `status=open` e `q`) e `GET /tasks/{id}`, para escolher e mostrar a tarefa ligada.
- `apps/web/scripts/evidence-shots.mjs`: molde das evidências visuais automáticas (TASK-05): Vite numa porta livre, Chromium do `@playwright/test`, temas claro e escuro, 1440 e 360 px, `check()` com `ok`/`FALHA`, prancha por `sheet()` e código de saída 1 em falha.

### Mudar

- `apps/web/src/features/projects/routes.tsx` (criar): rotas `/projects`, `/projects/new`, `/projects/$projectId` (com `tab=overview|board|connections|settings` na URL, PD-41), `/projects/$projectId/edit`, `/projects/$projectId/lanes/new`, `/projects/$projectId/lanes/$laneId/edit`, `/projects/$projectId/cards/new` (com `lane` na URL, PD-45) e `/projects/$projectId/cards/$cardId` (formulário do cartão, PD-46), exportadas por `createProjectsRoutes(parent_route)`.
- `apps/web/src/features/projects/nav.ts` (criar): item "Projetos" da sidebar, exportado como `projectsNavItem`.
- `apps/web/src/features/projects/i18n/pt-br.json` (criar): textos da feature.
- `apps/web/src/features/projects/projects-list-page.tsx` (criar): projetos em lista e grade, com o progresso, filtros, busca, botão "Relatórios" do módulo e estados (RF-54, PD-42, PD-61).
- `apps/web/src/features/projects/project-form-page.tsx` (criar): criação e edição do projeto em rota própria.
- `apps/web/src/features/projects/project-page.tsx` (criar): tela do projeto com as abas Visão geral (padrão), Quadro, as abas extras recebidas por `extra_tabs` (Conexões, montada pela TASK-35) e Configurações (última), e o cabeçalho com "Editar" e "Mais ações" (PD-14, PD-41, PD-61).
- `apps/web/src/features/projects/project-overview-tab.tsx` (criar): Visão geral em duas zonas, montada a partir de `GET /projects/{id}/summary`: Andamento, Próximos prazos e Em andamento na principal; Sobre, Prioridade alta e Ligações na lateral (PD-42).
- `apps/web/src/features/projects/kanban-board-page.tsx` (criar): aba Quadro com as raias e os cartões (RF-55).
- `apps/web/src/features/projects/kanban-lane.tsx` (criar): raia tingida na cor dela, com nome e contagem no cabeçalho e "+ Adicionar cartão" no pé (RF-56, PD-44, PD-45).
- `apps/web/src/features/projects/kanban-card.tsx` (criar): cartão com título, descrição, prioridade, etiquetas, prazo, progresso do checklist e tarefa ligada, movido por arrastar ou pelo seletor de raia do pé (RF-57, PD-46).
- `apps/web/src/features/projects/project-settings-tab.tsx` (criar): aba Configurações com a seção Raias: criar, renomear, trocar a cor, marcar "conta como concluída", reordenar pelo puxador e excluir (RF-56, PD-43, PD-47).
- `apps/web/src/features/projects/lane-form-page.tsx` (criar): criação e edição da raia em rota própria, com nome, cor HEX pelo seletor de cor e "Conta como concluída" (RF-56, PD-12, PD-43).
- `apps/web/src/features/projects/delete-lane-dialog.tsx` (criar): confirmação da exclusão com a raia de destino dos cartões (CB-07).
- `apps/web/src/features/projects/card-form-page.tsx` (criar): formulário próprio do cartão, para criar e editar, com "Excluir cartão" em "Mais ações" (RF-57, PD-46).
- `apps/web/src/features/projects/use-projects.ts` (criar): leitura da lista com filtros, busca e cursor vindos da URL, e mutações otimistas do projeto.
- `apps/web/src/features/projects/use-kanban.ts` (criar): leitura do quadro e mutações otimistas de raias e cartões (criar, renomear, reordenar, colorir, marcar como concluída, excluir, mover pela rota `move`).
- `apps/web/src/features/projects/use-project-summary.ts` (criar): leitura de `GET /projects/{id}/summary?today=` para a Visão geral (PD-42).
- `apps/web/src/features/projects/use-card-task-link.ts` (criar): tarefa ligada a cada cartão, lida e gravada pelas ligações `project_card` com `task` de `/links` (PD-46, DEC-003).
- `apps/web/src/features/projects/projects-list-page.test.tsx` (criar): testes da lista e da grade.
- `apps/web/src/features/projects/project-page.test.tsx` (criar): testes das abas e do cabeçalho do projeto (PD-41).
- `apps/web/src/features/projects/project-overview-tab.test.tsx` (criar): testes da Visão geral (PD-42).
- `apps/web/src/features/projects/kanban-board-page.test.tsx` (criar): testes do Quadro.
- `apps/web/src/features/projects/project-settings-tab.test.tsx` (criar): testes da seção Raias (PD-47).
- `apps/web/src/features/projects/lane-form-page.test.tsx` (criar): testes da raia.
- `apps/web/src/features/projects/delete-lane-dialog.test.tsx` (criar): testes da exclusão da raia.
- `apps/web/src/features/projects/card-form-page.test.tsx` (criar): testes do formulário do cartão (PD-46).
- `apps/web/src/features/projects/use-kanban.test.tsx` (criar): testes da interface otimista do quadro.
- `apps/web/src/features/projects/use-card-task-link.test.tsx` (criar): testes da tarefa ligada pelas ligações (DEC-003).
- `apps/web/src/features/projects/projects.e2e.ts` (criar): fluxo ponta a ponta do CT-30, rodado só na TASK-35.
- `apps/web/src/features/projects/evidence/harness.tsx` (criar): página de evidência que monta `createProjectsRoutes` num roteador em memória do TanStack Router, com os providers do app (tema, TanStack Query, i18n, preferências) e dentro do layout do app; não é importada pelo app nem por `apps/web/src/app` (nada muda em `apps/web/src/app`) e por isso fica fora do build de produção; só tokens do tema; passa no typecheck e no lint.
- `apps/web/scripts/evidence-projects.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-projects.mjs themes-widths|states-focus`), em Node sem dependências novas, no molde de `apps/web/scripts/evidence-shots.mjs` (código próprio, sem importar o da TASK-05): sobe o Vite numa porta livre por `createServer` da API do Vite com um plugin que serve uma página HTML virtual carregando o `harness.tsx` (encerra no fim, KNW-006), simula a API com `context.route('/api/**')` e fixtures em memória no próprio script (projetos, raias coloridas, cartões com prazo vencido, checklist e prioridade, `/summary`, `/links` e `/tasks`, respostas lentas para o carregando, lista vazia e `problem+json` para o erro), captura nos temas claro e escuro, em 1440 px e em 360 px, confere o estado no DOM antes de cada captura (tema aplicado, sem rolagem horizontal da página, sem erro de JS, axe sem violações, inclusive `color-contrast`, e as verificações de cada estado) e imprime `ok` ou `FALHA` por verificação, o caminho do PNG e a última linha `ok  0 falha(s)`; sai com código diferente de 0 se algo falhar; as pranchas vão para `vostok/work/tasks/SPEC-001/evidence/TASK-30/`.

### Passos

1. Ler os arquivos de "Ler" e anotar os nomes exportados por `apps/web/src/shared`, `packages/ui` e `packages/contracts`: projetos com `progress { done_cards, total_cards }`; raias com `system_key`, `name`, `color` HEX, `counts_as_done` e `position`; cartões com `lane_id`, `title`, `description`, `priority`, `labels`, `due_date`, `checklist [{ id, text, done, position }]` e `position`; o resumo `ProjectSummaryResponse`; as ligações com `linked_type` e `linked_id`; e, da TASK-05, o seletor de cor da PD-12, as variações `muted` e `success` do `Button`, `MenuButton`, `SelectField`, `DateField`, `TagField`, `FormGrid` e `FormActions`. Usar só esses nomes; esta tarefa não cria o seletor de cor nem as variações de botão.
2. Criar `apps/web/src/features/projects/i18n/pt-br.json` com chaves em `snake_case` sob `projects`: `nav`, `list.*` (título, subtítulo, busca, `filters_label`, `search_label`, `view_label`, `view_list`, `view_grid`, `progress` "{{done}} de {{total}} cartões prontos", `reports`, `report_proj_cards` "Cartões por raia", `empty_title`, `empty_text`, `loading`, `error`), `form.*`, `tabs.*` (`overview` "Visão geral", `board` "Quadro", `settings` "Configurações"), `header.*` (`edit`, `more_actions`, `report_proj_cards`, `delete`), `overview.*` (`progress_title` "Andamento", `progress_text` "{{done}} de {{total}} cartões prontos", `progress_empty` "Nenhum cartão ainda. Comece pelo Quadro.", `due_title` "Próximos prazos", `due_until` "Até {{date}}", `due_overdue` "Era para {{date}}", `due_empty` "Nenhum prazo nos próximos 14 dias.", `doing_title` "Em andamento", `doing_checklist` "Checklist {{done}}/{{total}}", `doing_empty` "Nada em andamento agora.", `about_title` "Sobre", `high_title` "Prioridade alta", `links_title` "Ligações", `linked_task_of` "Tarefa ligada a “{{card}}”", `links_empty` "Nenhuma ligação ainda.", `links_connect` "Conectar a algo"), `board.*` (`add_card` "+ Adicionar cartão", `move_to` "Mover “{{card}}” para", `card_moved` para o anúncio ao leitor de tela), `lane.*` (`name`, `system.waiting`, `system.in_progress`, `system.done` (nomes das raias padrão Aguardando, Em progresso e Pronto), `color`, `counts_as_done` "Conta como concluída", `counts_as_done_hint`, `rename`, `delete`, `delete_choose_target`, `delete_last_refused`, `reorder_handle` "Reordenar a raia {{name}}, posição {{position}} de {{total}}", `reorder_hint`), `settings.*` (`lanes_title` "Raias", `lanes_text` "As colunas do quadro, na ordem em que aparecem."), `card.*` (`title`, `description`, `lane`, `due_date`, `priority`, `priority_none`, `priority_low`, `priority_medium`, `priority_high`, `task` "Ligar a uma tarefa", `task_hint` "O cartão é do projeto; a tarefa continua em Tarefas.", `labels`, `checklist`, `checklist_hint` "Um item por linha. Comece com [x] o que já foi feito.", `delete` "Excluir cartão", `linked_task_title` "Ligado à tarefa {{task}}") e `undo_notice`. Os textos seguem o protótipo.
3. Escrever os testes antes do código, com o cliente da API simulado e o relógio fixo:
   - `projects-list-page.test.tsx`: `lists projects as a list and as a grid`, `pd42 shows the project progress from the listing`, `pd61 lists the projects report in the Relatórios menu`, `exposes the Filtros, Busca and Visualização controls by accessible name`, `reads search, filters and view mode from the URL`, `uses a deterministic color for projects without image`, `shows the empty state with explanatory text`, `shows the loading state`, `shows the error state`, `has no axe violations`.
   - `project-page.test.tsx`: `pd41 opens on the overview tab by default`, `pd41 orders the tabs overview board extra tabs and settings last`, `pd41 keeps the tab in the URL`, `pd14 shows Editar and keeps Excluir inside Mais ações`, `pd61 opens the cards per lane report filtered by the project`, `has no axe violations`.
   - `project-overview-tab.test.tsx`: `pd42 requests the summary with today in the user time zone`, `pd42 shows a bar per lane and 2 of 5 cards done`, `pd42 lists upcoming due dates in 14 days with overdue in neutral text`, `pd42 lists in progress cards with checklist and priority`, `pd42 shows the high priority card only when there is one`, `pd42 shows Sobre with description visibility and dates`, `pd42 lists the tasks linked to cards and the links slot in Ligações`, `pd42 shows the empty texts of each block`, `shows the loading state`, `shows the error state`, `has no axe violations`.
   - `kanban-board-page.test.tsx`: `shows the default lanes waiting, in progress and done for a new project`, `translates default lanes by system key`, `shows the user name of a renamed default lane`, `pd44 tints the lane with its color and shows only name and count`, `pd45 opens the card form with the chosen lane from the add card button`, `pd46 shows priority labels due date checklist progress and the linked task on the card`, `pd46 moves a card to another lane by drag and drop through the move route` (`POST /projects/{id}/cards/{card_id}/move` com `lane_id` e `position`), `pd46 moves a card with the lane selector at the foot by keyboard`, `pd47 has no lane management inside the board`, `announces the move to screen readers`, `has no axe violations`.
   - `project-settings-tab.test.tsx`: `pd47 lists the lanes in order with the color handle`, `pd47 reorders lanes by dragging the handle` (`PUT /projects/{id}/lanes/order` com a lista inteira), `pd47 reorders lanes with the arrow keys on the handle`, `pd47 links to rename and change the color of a lane`, `pd43 toggles counts as done per lane`, `pd47 deletes a lane through the confirmation dialog`, `has no axe violations`.
   - `lane-form-page.test.tsx`: `creates a colored lane that appears in order`, `renames a lane`, `pd12 saves the hex color chosen in the color picker` (`#0ea5e9` no `POST`), `pd12 starts a new lane with a hex color`, `pd43 saves counts as done`.
   - `delete-lane-dialog.test.tsx`: `asks for the target lane when the lane has cards` (CB-07), `refuses to delete the last lane` (CB-08), `deletes an empty lane after confirmation`.
   - `card-form-page.test.tsx`: `pd46 creates a card with title description lane due date priority labels and checklist` (`POST /projects/{id}/cards` com `lane_id` da URL), `pd46 parses the checklist lines with done items marked by [x]`, `pd46 edits a card with PATCH and moves it with the move route when the lane changes`, `pd46 links the chosen task after saving` (`POST /links` com `project_card` e `task`), `pd46 replaces and removes the linked task`, `pd46 deletes the card from Mais ações after confirmation`, `pd11 turns labels into pills`, `shows the server errors inside the form with role alert`, `has no axe violations`.
   - `use-kanban.test.tsx`: `moves the card before the server answers`, `rolls back and shows the undo notice when the server rejects` (RNF-09), `pd43 recomputes the progress when a lane counts as done`.
   - `use-card-task-link.test.tsx`: `dec003 reads the linked task from links with linked_type task`, `dec003 never sends a task id inside the card`, `dec003 treats a link_already_exists answer as linked`.
4. Rodar `pnpm --filter @atria/web test -- src/features/projects` e confirmar que falham por falta da implementação.
5. Implementar `use-projects.ts`, `use-kanban.ts` e `use-project-summary.ts` com TanStack Query e o hook de mutação otimista de `apps/web/src/shared`: mover cartão chama `POST /projects/{id}/cards/{card_id}/move` com `lane_id` e `position` (nunca o `PATCH`, que não move); reordenar raias chama `PUT /projects/{id}/lanes/order` com a lista completa de ids; os dois atualizam as posições no cache na hora e desfazem na recusa; marcar ou desmarcar `counts_as_done` (`PATCH /projects/{id}/lanes/{lane_id}`) invalida o projeto, a lista e o resumo. O resumo é lido com `?today=AAAA-MM-DD` no fuso da pessoa, pelo utilitário de data de `apps/web/src/shared`. A regra da última raia (RN-16) fica no hook: a ação de excluir fica indisponível com uma raia só.
6. Criar em `use-kanban.ts` a função `laneLabel(lane, t)`: com `name` preenchido, devolve `name` (raia criada ou padrão renomeada pela pessoa); com `name` nulo, devolve a tradução de `projects.lane.system.<system_key>` (`waiting`, `in_progress`, `done`, vindos do servidor pela TASK-14). O quadro, a Visão geral, a seção Raias, o formulário da raia, o do cartão e o diálogo de exclusão usam só essa função; renomear uma raia padrão grava `name` e mantém o `system_key`.
7. Implementar `use-card-task-link.ts` (DEC-003, PD-46): `useCardTask(card_id)` lê `GET /links?entity_type=project_card&entity_id={card_id}&linked_type=task` e, com uma ligação, `GET /tasks/{linked_id}` para o título; `useCardTasks(card_ids)` faz o mesmo para os cartões do quadro e da Visão geral com `useQueries`; `setCardTask(card_id, task_id | null)` remove a ligação atual com `DELETE /links/{id}` quando a tarefa muda ou sai, e cria a nova com `POST /links` (`source_type: "project_card"`, `source_id`, `target_type: "task"`, `target_id`), tratando 409 `link_already_exists` como já ligada. O cartão nunca leva id de tarefa.
8. Implementar `kanban-lane.tsx` (PD-44, PD-45): raia com `--lane` igual à cor HEX dela, fundo `color-mix(in srgb, var(--lane) 7%, var(--surface))` e borda `color-mix(in srgb, var(--lane) 22%, var(--border))`, sem faixa no topo; cabeçalho só com o nome (`laneLabel`) e a contagem num badge; no pé, o `Button` `muted` "+ Adicionar cartão" na cor da raia, que leva a `/projects/{id}/cards/new?lane={lane_id}`; sem ações de gerenciar a raia (PD-47). O texto do nome usa `--text`, para o contraste não depender da cor escolhida.
9. Implementar `kanban-card.tsx` (PD-46): título com link esticado para `/projects/{id}/cards/{card_id}` (PD-07), descrição em até 2 linhas, badge de prioridade (alta em `--danger` suave, média em `--warning`, baixa neutra, como no protótipo), etiquetas, prazo com `Intl`, progresso do checklist "1/3" e a tarefa ligada de `use-card-task-link`, com ícones SVG inline `aria-hidden="true"`; no pé, o `SelectField` com o rótulo oculto "Mover “{{card}}” para" e as raias, que move pela rota `move`. Arrastar e soltar nativo do HTML entre raias, com a posição de destino. Cada movimento é anunciado numa região `aria-live="polite"`.
10. Implementar `project-settings-tab.tsx` (PD-43, PD-47): seção Raias com "Nova raia" (link para `/projects/{id}/lanes/new`) e a lista das raias na ordem; cada linha com o puxador (faixa na cor da raia com seis pontinhos, `<button>` com `reorder_handle` como nome acessível), o nome, a cor, a caixa "Conta como concluída" (`Checkbox` de `packages/ui`), "Editar" (para `/projects/{id}/lanes/{lane_id}/edit`) e "Excluir" (abre `delete-lane-dialog.tsx`; indisponível com uma raia só). Reordenar arrastando pelo puxador: a linha flutua e as outras abrem espaço enquanto ela passa; pelo teclado, seta para cima e para baixo no puxador; ao soltar, `PUT .../lanes/order`. Sem animação com `prefers-reduced-motion`.
11. Implementar `delete-lane-dialog.tsx` com o diálogo de confirmação de `packages/ui`: com cartões, exige escolher a raia de destino; com uma raia só, mostra `delete_last_refused` e não exclui.
12. Implementar os formulários em rota própria com `react-hook-form`, `zod`, `FormGrid` e `FormActions` (PD-19, PD-62), com erros no formulário com `role="alert"`: `project-form-page.tsx`; `lane-form-page.tsx` com nome, cor pelo seletor de cor da TASK-05 (HEX `#rrggbb` gravado em minúsculas; nova raia começa em `#6d28d9`, o `--primary` do tema claro usado pela TASK-14, PD-12) e "Conta como concluída" (PD-43); e `card-form-page.tsx` (PD-46) com título, descrição, raia (`SelectField`, vinda de `lane` na URL ao criar), prazo (`DateField`, PD-57), prioridade (`SelectField` com "Sem prioridade", Baixa, Média, Alta), "Ligar a uma tarefa" (`SelectField` com busca por letra sobre `GET /tasks?status=open&limit=100`, e a tarefa ligada atual mesmo se concluída), etiquetas (`TagField`, PD-11, gravadas em `labels`) e checklist (área de texto, um item por linha, `[x] ` no começo marca o feito, como no protótipo). Ao salvar: criar com `POST /projects/{id}/cards`; editar com `PATCH` e, se a raia mudou, `POST .../move`; depois, `setCardTask`. No cabeçalho da edição, o `MenuButton` "Mais ações" com "Excluir cartão" em vermelho, com confirmação. "Voltar" e "Cancelar" levam ao Quadro (`?tab=board`).
13. Implementar `project-overview-tab.tsx` (PD-42) sobre `use-project-summary.ts`: zona principal com Andamento (barra horizontal com um segmento por raia, proporcional a `card_count`, na cor dela, `role="img"` com o nome e a contagem de cada raia no `aria-label`, legenda e "2 de 5 cartões prontos" de `progress`), Próximos prazos (`upcoming_due`, "Até 05/11/2026" ou, se `overdue`, "Era para 28/10/2026", em texto neutro, sem vermelho, [project/frontend-14]) e Em andamento (`in_progress`, com "Checklist 1/3 · Prioridade alta" ou "Sem checklist"); lateral com Sobre (descrição, visibilidade, criado e atualizado em), Prioridade alta (só quando algum cartão aberto tem `priority` alta, da lista do quadro) e Ligações (as tarefas ligadas aos cartões, de `useCardTasks`, como "Tarefa ligada a “Comprar luminária”", seguidas do conteúdo da propriedade `links_slot`, por onde a TASK-35 monta as ligações do próprio projeto sem esta feature importar outra; sem nenhuma das duas, "Nenhuma ligação ainda." e o link "Conectar a algo" para `?tab=connections`). Duas zonas que viram uma coluna abaixo de 960 px, no padrão do dashboard. Cada cartão citado leva ao formulário do cartão.
14. Implementar `project-page.tsx` (PD-41, PD-14, PD-61): abas `Tabs` de `packages/ui` na ordem Visão geral (padrão), Quadro (`kanban-board-page.tsx`), as recebidas pela propriedade `extra_tabs` (Conexões, da TASK-35) e Configurações (`project-settings-tab.tsx`), com a aba em `tab` na URL; cabeçalho com "Editar" (ícone de lápis, para `/projects/{id}/edit`) e o `MenuButton` "Mais ações" com "Relatório de cartões por raia" para `/reports/proj-cards?project_id={id}` e "Excluir" em vermelho, com confirmação. Implementar `kanban-board-page.tsx` (rolagem horizontal das raias só dentro do quadro, com as raias empilhadas abaixo de 480 px) e `projects-list-page.tsx` (cabeçalho com "Novo projeto" e o `MenuButton` "Relatórios" com "Cartões por raia" para `/reports/proj-cards`, busca, filtros, modos lista e grade na URL, o progresso de cada projeto e os estados vazio, carregando e erro). Os três controles da listagem têm os nomes acessíveis exatos "Filtros", "Busca" e "Visualização" (`aria-label` ou rótulo vindo das chaves `filters_label`, `search_label` e `view_label` da tradução), usados pelos e2e da TASK-35.
15. Criar `routes.tsx` com `createProjectsRoutes(parent_route)` e `nav.ts` com `projectsNavItem` (destino `/projects`, ícone SVG inline com `aria-hidden="true"`).
16. Criar `projects.e2e.ts` (Playwright) com o CT-30: lista e grade, abrir um projeto na Visão geral com as raias padrão, criar raia com cor HEX em Configurações, reordenar pelo puxador, marcar uma raia como concluída e ver o Andamento mudar, criar cartão pelo "+ Adicionar cartão" com prazo, checklist e tarefa ligada, e movê-lo pelo seletor do pé, em 360 px e desktop, com axe. Não rodar: ele roda na TASK-35.
17. Rodar a Verificação até passar sem nenhum warning de lint.
18. Criar `apps/web/src/features/projects/evidence/harness.tsx` e `apps/web/scripts/evidence-projects.mjs` (veja "Mudar") e rodar `node apps/web/scripts/evidence-projects.mjs themes-widths` e `node apps/web/scripts/evidence-projects.mjs states-focus`. Corrigir o código da tarefa a cada linha `FALHA` e conferir as pranchas `projects-themes-widths.png` e `projects-states-focus.png` abrindo-as.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
pnpm --filter @atria/web test -- src/features/projects
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
test -f apps/web/src/features/projects/projects.e2e.ts
# Evidências visuais automáticas
test -f apps/web/src/features/projects/evidence/harness.tsx
test -f apps/web/scripts/evidence-projects.mjs
node --check apps/web/scripts/evidence-projects.mjs
```

### Evidências

- `projects-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/projects --reporter=verbose`
  - Prova: os testes de Projetos passam, cobrindo lista e grade, abas do projeto, Visão geral, raias padrão, raias customizáveis, cartões móveis por mouse e teclado, exclusão de raia, formulário do cartão, estados, axe e interface otimista (RF-54 a RF-57, CT-30, CB-07, CB-08, RNF-06, RNF-09).
  - Trecho: os arquivos `projects-list-page.test.tsx`, `project-page.test.tsx`, `project-overview-tab.test.tsx`, `kanban-board-page.test.tsx`, `project-settings-tab.test.tsx`, `lane-form-page.test.tsx`, `delete-lane-dialog.test.tsx`, `card-form-page.test.tsx`, `use-kanban.test.tsx` e `use-card-task-link.test.tsx` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `projects-prototype-decisions.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/projects --reporter=verbose -t "pd|dec003"`
  - Prova: as decisões do protótipo de Projetos estão nas telas: cor HEX pelo seletor (PD-12), abas com a Visão geral primeiro (PD-41), Visão geral pelo `/summary` (PD-42), "conta como concluída" por raia (PD-43), raia tingida (PD-44), "+ Adicionar cartão" no pé (PD-45), cartão completo com formulário próprio, tarefa ligada pelas ligações e movimento pela rota `move` (PD-46, DEC-003), Raias em Configurações (PD-47), "Mais ações" (PD-14) e relatórios (PD-61) (DEC-002).
  - Trecho: os casos `pd12 saves the hex color chosen in the color picker`, `pd41 opens on the overview tab by default`, `pd42 shows a bar per lane and 2 of 5 cards done`, `pd43 toggles counts as done per lane`, `pd46 moves a card to another lane by drag and drop through the move route`, `pd46 links the chosen task after saving`, `pd47 reorders lanes by dragging the handle` e `dec003 reads the linked task from links with linked_type task` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests`, `No test files found` ou nenhum caso `pd` ou `dec003` executado.
- `projects-files.txt` (automática): `find apps/web/src/features/projects -type f | sort`
  - Prova: a feature tem rotas, item de menu, traduções, telas, abas, hooks, testes e o e2e do CT-30.
  - Trecho: `routes.tsx`, `nav.ts`, `i18n/pt-br.json`, `project-overview-tab.tsx`, `project-settings-tab.tsx`, `use-card-task-link.ts` e `projects.e2e.ts` na lista.
  - Falha: `No such file or directory` ou algum desses arquivos ausente.
- `projects-themes-widths.txt` (automática): `node apps/web/scripts/evidence-projects.mjs themes-widths`
  - Prova: identidade visual nos dois temas, raias tingidas na cor HEX, Visão geral em duas zonas e layout funcional a partir de 360 px, medidos no DOM e fotografados na grade de projetos, na Visão geral, no Quadro e na seção Raias (RNF-08, RNF-10, PD-42, PD-44, PD-47).
  - Trecho: uma linha `ok` por verificação, como `ok ... tema claro aplicado`, `ok ... tema escuro aplicado`, `ok ... raias tingidas na cor HEX · nome em --text`, `ok ... "+ Adicionar cartão" no pé da raia`, `ok ... barra do Andamento com um segmento por raia`, `ok ... prazo vencido sem a cor de perigo`, `ok ... puxador das raias visível`, `ok ... 360 px · raias empilhadas`, `ok ... 360 px · zonas numa coluna`, `ok ... sem rolagem horizontal da página`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclusive color-contrast)` em cada captura; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-30/projects-themes-widths.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (rolagem horizontal da página em 360 px, nome da raia ilegível sobre a cor, prazo vencido em vermelho, contraste baixo no tema escuro), a ausência da linha `png:`, código de saída diferente de 0 ou a prancha sem algum dos estados.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-30/projects-themes-widths.png`, a prancha com as capturas rotuladas da grade de projetos, da Visão geral, do Quadro e da seção Raias, nos temas claro e escuro, em 360 px e em 1440 px.
- `projects-states-focus.txt` (automática): `node apps/web/scripts/evidence-projects.mjs states-focus`
  - Prova: todos os estados, a exclusão segura da raia, o mover e o reordenar por teclado e o formulário completo do cartão, com a API simulada (lista vazia, resposta lenta e `problem+json`) ([project/frontend-10], [project/frontend-12], CB-07, RNF-06, PD-46, PD-47).
  - Trecho: `ok ... estado vazio · texto explicativo visível`, `ok ... estado carregando · indicador visível`, `ok ... estado de erro · mensagem visível`, `ok ... diálogo de exclusão · seletor da raia de destino`, `ok ... seletor do pé do cartão focado por Tab · contorno de foco visível (≥ 2 px)`, `ok ... cartão movido pelo teclado`, `ok ... puxador da raia focado · contorno de foco visível (≥ 2 px)`, `ok ... formulário do cartão · "Ligar a uma tarefa" preenchido`, `ok ... sem rolagem horizontal da página`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclusive color-contrast)`; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-30/projects-states-focus.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (estado sem texto, diálogo sem raia de destino, cartão ou raia que só se move com o mouse, foco invisível), a ausência da linha `png:`, código de saída diferente de 0 ou a prancha sem algum dos estados.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-30/projects-states-focus.png`, a prancha com a lista nos estados vazio, carregando e erro, o diálogo de exclusão pedindo a raia de destino, o cartão com o foco no seletor do pé, o puxador de uma raia focado e o formulário do cartão com a tarefa ligada, nos temas claro e escuro, em 360 px e em 1440 px.

### Concluída quando

- [x] Os projetos aparecem em lista e em grade, com o progresso, busca e filtros na URL e os estados vazio, carregando e erro (RF-54, CT-30).

  > Como comprovar: na saída `projects-tests.txt`, ver aprovados os casos da `projects-list-page.test.tsx`, entre eles `lists projects as a list and as a grid`.

- [x] O projeto abre na Visão geral, com as abas Visão geral, Quadro, Conexões e Configurações nessa ordem (PD-41).

  > Como comprovar: em `projects-prototype-decisions.txt`, ver aprovados `pd41 opens on the overview tab by default` e `pd41 orders the tabs overview board extra tabs and settings last`.

- [x] A Visão geral mostra Andamento, Próximos prazos (14 dias, vencido em texto neutro) e Em andamento a partir do `/summary`, e Sobre, Prioridade alta e Ligações na lateral, com as tarefas ligadas aos cartões (PD-42, DEC-003).

  > Como comprovar: em `projects-prototype-decisions.txt`, ver aprovados os casos `pd42` da `project-overview-tab.test.tsx`.

- [x] O Quadro tem as raias Aguardando, Em progresso e Pronto, tingidas na cor de cada uma, com "+ Adicionar cartão" no pé, que abre o formulário com a raia escolhida (RF-55, CT-30, PD-44, PD-45).

  > Como comprovar: ver aprovados `shows the default lanes waiting, in progress and done for a new project`, `pd44 tints the lane with its color and shows only name and count` e `pd45 opens the card form with the chosen lane from the add card button`.

- [x] Em Configurações › Raias, as raias são criadas, renomeadas, coloridas com HEX pelo seletor de cor, marcadas como "conta como concluída", reordenadas pelo puxador (mouse e setas) e excluídas, pedindo a raia de destino e recusando a última (RF-56, CT-30, PD-12, PD-43, PD-47).

  > Como comprovar: ver aprovados os casos da `project-settings-tab.test.tsx`, da `lane-form-page.test.tsx` e da `delete-lane-dialog.test.tsx`, entre eles `pd12 saves the hex color chosen in the color picker` e `pd43 toggles counts as done per lane`.

- [x] O cartão mostra título, descrição, prioridade, etiquetas, prazo, checklist e tarefa ligada, tem formulário próprio com "Excluir cartão" em "Mais ações" e é movido entre raias arrastando ou pelo seletor do pé, pela rota `move`; a tarefa ligada é uma ligação de `/links` (RF-57, CT-30, PD-46, DEC-003).

  > Como comprovar: ver aprovados os casos `pd46` da `kanban-board-page.test.tsx` e da `card-form-page.test.tsx` e os casos `dec003` da `use-card-task-link.test.tsx`.

- [x] Mover e reordenar aparecem na hora e são desfeitos com aviso se o servidor recusar (RNF-09).

  > Como comprovar: ver aprovado `rolls back and shows the undo notice when the server rejects` na saída `projects-tests.txt`.

- [x] O projeto e a listagem têm "Editar", "Mais ações" com "Excluir" e os relatórios de cartões por raia, filtrados pelo projeto quando abertos dele (PD-14, PD-61).

  > Como comprovar: em `projects-prototype-decisions.txt`, ver aprovados `pd14 shows Editar and keeps Excluir inside Mais ações`, `pd61 opens the cards per lane report filtered by the project` e `pd61 lists the projects report in the Relatórios menu`.

- [x] As telas não têm violações no axe, funcionam só pelo teclado e nos dois temas, a partir de 360 px (RNF-06, RNF-08, RNF-10).

  > Como comprovar: ver aprovados os casos `has no axe violations`; em `projects-themes-widths.txt` e `projects-states-focus.txt`, ver `tema claro aplicado`, `tema escuro aplicado`, `contorno de foco visível`, `sem rolagem horizontal da página` e `axe sem violações` com `ok` e `ok  0 falha(s)`, e conferir as pranchas `projects-themes-widths.png` e `projects-states-focus.png`.

- [x] Testes, typecheck e lint passam sem warning, e o e2e do CT-30 está escrito para a TASK-35.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; `projects.e2e.ts` aparece em `projects-files.txt`.

## Descrição

### Resumo executivo

Entrega as telas de Projetos como no protótipo: a lista e a grade de projetos, a Visão geral de cada projeto em forma de painel, o quadro Kanban com raias tingidas e cartões completos (prazo, prioridade, checklist e tarefa ligada) e a configuração das raias.
Ajuda a pessoa a acompanhar o andamento dos projetos sem pressão, com mudanças que aparecem na hora e uso completo pelo teclado.
Perfil padrão, risco médio: consome os campos novos do servidor de Projetos (resumo, rota de mover, cor livre e conclusão por raia) e as ligações para a tarefa do cartão.
Libera a integração do frontend, que coloca Projetos no menu, monta a aba Conexões e as ligações da Visão geral e roda o fluxo ponta a ponta.

### Detalhes técnicos

- **Abordagem:** feature React em `apps/web/src/features/projects`, com rotas próprias para listar, criar e editar projetos, raias e cartões, e a tela do projeto em `/projects/$projectId` com as abas na URL. Dados com TanStack Query; mover e reordenar com atualização otimista das posições no cache.
- **Componentes:** lista e grade, formulário do projeto, tela do projeto com abas, Visão geral, quadro, raia, cartão, seção Raias com o puxador, formulário da raia, diálogo de exclusão da raia e formulário do cartão; usa `@atria/ui` (inclusive o seletor de cor da PD-12 e as variações `muted` e `success` do `Button`, entregues pela TASK-05), `@atria/theme`, `@atria/contracts` e `apps/web/src/shared`.
- **Decisões do protótipo (DEC-002):**
  - Abas Visão geral (padrão), Quadro, Conexões e Configurações (PD-41); a Conexões vem por `extra_tabs`, inserida antes de Configurações, para a feature não importar `connections`. Descartado abrir no Quadro.
  - Visão geral montada só a partir de `GET /projects/{id}/summary?today=` da TASK-14 (`progress`, `lanes`, `upcoming_due` com `overdue`, `in_progress`), com hoje no fuso da pessoa; a Prioridade alta vem dos cartões do quadro, que o resumo não traz (PD-42). Descartado recalcular os blocos no cliente, que duplicaria a regra da TASK-14.
  - Cor da raia como HEX livre pelo seletor de cor da TASK-05 (PD-12); descartada a lista de tokens. Cada raia tem "Conta como concluída" (`counts_as_done`), e o progresso vem do servidor (PD-43); descartado "Pronto é a última raia".
  - Raia tingida pela própria cor com `color-mix` e nome em `--text` (PD-44); "+ Adicionar cartão" `muted` no pé, que abre o formulário com a raia (PD-45), descartada a criação só com título na raia.
  - Cartão completo com formulário próprio em `/projects/$projectId/cards/new` e `/cards/$cardId`, sem tela de leitura separada (PD-46); descartada a `card-page.tsx`, que a PD substitui pelo formulário. Mover pelo `POST .../move` da TASK-14, por arrastar ou pelo seletor do pé; descartados o `PATCH` (não move) e o botão "Mover" com menu e Alt + setas, que o seletor do pé substitui com o mesmo alcance pelo teclado.
  - Tarefa ligada lida e gravada pelas ligações `project_card`–`task` de `/links` (TASK-15), nunca como campo do cartão (DEC-003, RN-20); a ligação aparece também na aba Conexões. Descartado guardar o id da tarefa no cartão.
  - Gerenciar raias só em Configurações › Raias, com reordenação pelo puxador e pelas setas (PD-47); descartados os botões de gerenciar dentro de cada raia. Criar e editar raia continuam em rota própria ([project/architecture-10]); descartada a edição em linha do protótipo.
- **Decisões:** arrastar e soltar nativo do HTML com alternativa completa de teclado e anúncio em `aria-live`, descartada uma biblioteca de arrastar e soltar, que seria dependência nova ([project/stack-12]) sem ganho que justifique; modal só na confirmação da exclusão ([project/architecture-10]); prazo vencido em texto neutro ([project/frontend-14]); abaixo de 480 px as raias ficam empilhadas, descartada a rolagem horizontal da página, que quebraria [project/frontend-17].
- **Regras:** a raia de destino dos cartões é pedida ao excluir uma raia com cartões (CB-07) e a última raia não é excluída (CB-08, RN-16); os cartões são próprios do projeto (RN-20).
- **Evidências visuais.** As pranchas `projects-themes-widths.png` e `projects-states-focus.png` são geradas por `apps/web/scripts/evidence-projects.mjs`, no molde do `evidence-shots.mjs` da TASK-05: cada evidência é um comando cuja saída (`.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG, e a prancha vai para a pasta de evidências da tarefa. Como as rotas da feature só são registradas no app pela TASK-35, o script sobe o Vite com uma página virtual que carrega `src/features/projects/evidence/harness.tsx`, que monta `createProjectsRoutes` num roteador em memória com os providers e o layout do app, sem mudar `apps/web/src/app`; a API é simulada por `context.route('/api/**')` com fixtures no script, e cada captura passa pelo axe (inclusive `color-contrast`).
- **Riscos:** posição dos cartões divergente após recusa do servidor (mitigado com o desfazer da mutação otimista e o recarregamento do quadro); a tarefa ligada exige uma leitura de `/links` por cartão, porque o contrato da TASK-15 lista ligações de uma entidade por vez (aceitável para quadros pessoais, com cache do TanStack Query); a Ligações da Visão geral depende da TASK-35 passar `links_slot`.
- **Referências da spec:** RF-54 a RF-57, CT-30, RN-16, RN-20, CB-07, CB-08, RNF-06, RNF-08 a RNF-10, decisão 5; PD-07, PD-11, PD-12, PD-14, PD-19, PD-41 a PD-47, PD-57, PD-61 e PD-62 de `docs/decisoes-do-prototipo.md`; DEC-002 e DEC-003 da memória; contratos da TASK-14 e da TASK-15.
- **Arquivos em comum na onda 7:** nenhum.

### Card

- **Título:** Telas de Projetos
- **Tipo:** historia
- **Descrição:** Telas de Projetos em lista e grade, a Visão geral de cada projeto, o Kanban com raias tingidas e cartões completos e a configuração das raias, como no protótipo.
- **Critérios de aceite:**
  - [ ] Projetos em lista e grade, com progresso, busca, filtros na URL e estados.
  - [ ] Projeto abre na Visão geral (Andamento, Próximos prazos, Em andamento, Sobre, Prioridade alta e Ligações), com as abas Quadro, Conexões e Configurações.
  - [ ] Raias com cor HEX, "conta como concluída", reordenação pelo puxador e exclusão que pede o destino dos cartões e recusa a última.
  - [ ] Cartões com prazo, prioridade, etiquetas, checklist e tarefa ligada, formulário próprio e movidos por arrastar ou pelo seletor, com interface otimista e sem violações no axe.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | ajuste | in_progress | Evidências manuais projects-themes-widths.png e projects-states-focus.png trocadas por automáticas projects-themes-widths.txt e projects-states-focus.txt geradas por apps/web/scripts/evidence-projects.mjs, com a prancha PNG como Artefato; harness da feature em src/features/projects/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 4 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
| 5 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 6 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 7 | 2026-10-31 | evidências | passed | 5 evidência(s) em evidence/TASK-30/ |
| 8 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler: decisoes-do-prototipo, DEC-002 a DEC-004 e contratos das TASK-14, TASK-15 e TASK-09; PD-41: abas Visao geral (padrao), Quadro, extras (Conexoes) e Configuracoes; PD-42: Visao geral a partir do /summary com Ligacoes e links_slot; PD-12: cor HEX pelo seletor de cor da TASK-05, sem cria-lo na tela; PD-43: conta como concluida por raia; PD-44 e PD-45: raia tingida e Adicionar cartao muted no pe; PD-46 e DEC-003: cartao completo com formulario proprio, tarefa ligada pelas ligacoes e movimento pela rota move, card-page removida; PD-47: Raias em Configuracoes com puxador; PD-14, PD-11, PD-57, PD-61 e PD-62 aplicados; testes pd e dec003, evidencia projects-prototype-decisions.txt, Concluida quando, Detalhes tecnicos e card |
| 2 | 2026-10-31 | agente | Linha da Baseline que conferia a pasta criada pela própria tarefa removida (recusada pela validação do vostok 0.2.3; defeito da issue 6) |
| 3 | 2026-10-31 | agente | Evidências manuais projects-themes-widths.png e projects-states-focus.png trocadas por automáticas projects-themes-widths.txt e projects-states-focus.txt geradas por apps/web/scripts/evidence-projects.mjs, com a prancha PNG como Artefato; harness da feature em src/features/projects/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 4 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
