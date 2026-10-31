---
id: TASK-24
spec: SPEC-001
title: "Telas de Tarefas"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-38, RF-39, CT-24]
type: historia
labels: [SPEC-001, padrao]
status: approved
content_hash: ff05aad368022bd144d46fdd33aaf222e420d2a9678812d6bcbeefb63c543e2d
adjustments: 5
adjusted_at: 2026-10-30T22:23:10Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: ff05aad368022bd144d46fdd33aaf222e420d2a9678812d6bcbeefb63c543e2d
attempts: 0
tests_result: null
regression_result: null
evidence_result: null
updated_at: 2026-10-30T22:23:10Z
---

# TASK-24: Telas de Tarefas

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-38, RF-39, CT-24, RN-08, RN-09, RN-19, CB-02, CB-03, decisões 3 e 18, o contrato da regra de recorrência e os recursos `/tasks` e `/tasks/{id}/completion`)
- `prototype/atria-prototype.html` (telas de tarefas validadas no protótipo; pelas decisões do protótipo, `completeBtn` (botão só com o check, `aria-pressed` e o nome "Concluir hoje: <título>"), o template `#entity-detail` com "Voltar", "Concluir hoje", "Editar" e "Mais ações", a visão geral da tarefa em `overviewHTML` (`k === 'task'`), a aba "Ocorrências" da tarefa diária (`tab === 'occurrences'`), os selos "Aberta hoje" e "Feita hoje" de `KINDS.task.badges`, o formulário `KINDS.task` com a grade `.screen-form .form`, as etiquetas no topo do cartão "Registro" (`reg`) e, para o botão "Relatórios" do módulo, a constante `REPORTS` (relatório `tasks-done`, módulo `tasks`, sem filtros) e `repsOf`)
- `docs/decisoes-do-prototipo.md` (linhas PD-04, PD-11, PD-14, PD-19, PD-32, PD-33, PD-57, PD-59, PD-61 e PD-62 e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa)
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004 DEC-006 DEC-008`: DEC-002 (as decisões do protótipo valem já, também nas telas); DEC-003 (a tarefa ligada a um cartão de projeto é uma ligação do contexto links e aparece na aba Conexões, sem campo na tarefa); DEC-004 (Tarefas concluídas e abertas sem período); DEC-006 (item 1: tarefas com etiquetas no servidor e o campo de etiquetas da base na tela; item 4: recorrência com a regra completa, com o mesmo editor dos lembretes e do Financeiro); DEC-008 (esse editor é um componente da base, em `apps/web/src/shared/forms`, que as telas importam)
- `vostok/work/tasks/SPEC-001/TASK-05.md` (componentes da base: `Button` com a variação `success` e o estado `aria-pressed` (PD-03), `PageHeader` com "Voltar" e ações, `MenuButton`, `SelectField`, `SegmentedField`, `DateField`, `TimeField`, `TagField`, `FormGrid`, `FormActions` e as ligações `FormSelect`, `FormSegmented`, `FormDate`, `FormTime` e `FormTags` de `apps/web/src/shared/forms/form-fields.tsx`; e, pela DEC-008, `RecurrenceFields`/`FormRecurrence` e `summarizeRule(rule, locale)` de `apps/web/src/shared/forms/recurrence-fields.tsx`, com a prop `with_time`, padrão `true`)
- `vostok/work/tasks/SPEC-001/TASK-17.md` (o relatório `tasks-done`, do módulo `tasks`, sem período e sem filtros)
- `vostok/work/tasks/SPEC-001/TASK-22.md` e `vostok/work/tasks/SPEC-001/TASK-25.md` (o Financeiro e os Lembretes usam o mesmo `FormRecurrence` da base: o Financeiro com `with_time={false}`, os Lembretes com o horário obrigatório; DEC-006, DEC-008)
- `apps/web/src/app` (só leitura: layout e roteador raiz)
- `vostok/work/tasks/SPEC-001/TASK-09.md` (passo 8: filtros de `GET /tasks`, `PATCH /tasks/{id}` com `effective_from`, `POST|DELETE /tasks/{id}/completion` com `occurrence_date` e `GET /tasks/occurrences`; pela DEC-006, a TASK-09 acrescentou o campo `labels` da tarefa (`TEXT[]`, até 20 etiquetas de até 50 caracteres; uma repetida, sem diferenciar maiúsculas, dá 422) e o filtro `label` (uma etiqueta por pedido))
- `vostok/work/tasks/SPEC-001/TASK-06.md` (passo 8: `GET /me/preferences` com o fuso)
- `apps/web/src/shared` (cliente da API, interface otimista, aviso de recusa, `Intl`, estado da listagem na URL, i18n comum e helpers de teste com axe e relógio fixo)
- `packages/ui` (lista, caixa de seleção, campos, seletor, chip de filtro, busca, alternador de visualização, diálogo de confirmação, estados vazio, carregando e erro)
- `packages/theme` (tokens e temas claro e escuro)
- `packages/contracts` (tipos gerados de tarefas, etiquetas, ocorrências, conclusão, reabertura e regra de recorrência)
- `vostok/rules/project/frontend.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`

### Mudar

- `apps/web/src/features/tasks/routes.tsx` (criar): rotas `/tasks`, `/tasks/new`, `/tasks/$taskId` (detalhe, PD-14, PD-33, PD-59) e `/tasks/$taskId/edit`, exportadas por `createTasksRoutes` para a TASK-35 registrar.
- `apps/web/src/features/tasks/nav.ts` (criar): item "Tarefas" da sidebar.
- `apps/web/src/features/tasks/i18n/pt-br.json` (criar): textos das telas de tarefas.
- `apps/web/src/features/tasks/hooks/use-tasks.ts` (criar): listagem de tarefas (`GET /tasks`) e ocorrências do período (`GET /tasks/occurrences`) com filtros e busca, criação, edição e exclusão.
- `apps/web/src/features/tasks/hooks/use-tasks.test.tsx` (criar): testes da listagem por período no fuso do usuário e das mutações.
- `apps/web/src/features/tasks/hooks/use-task-completion.ts` (criar): concluir e reabrir tarefa pontual ou uma ocorrência, com interface otimista.
- `apps/web/src/features/tasks/hooks/use-task-completion.test.tsx` (criar): testes da conclusão por ocorrência e da reversão (CT-24).
- `apps/web/src/features/tasks/lib/task-reports.ts` (criar): relatórios do módulo, com o caminho `/reports/tasks-done?from_module=tasks` (PD-61).
- `apps/web/src/features/tasks/lib/task-reports.test.ts` (criar): teste do caminho do relatório (PD-61).
- `apps/web/src/features/tasks/components/task-item.tsx` (criar): linha da tarefa ou ocorrência com o botão de concluir só com o ícone (PD-04).
- `apps/web/src/features/tasks/components/complete-button.test.tsx` (criar): testes do nome, da variação e do estado do botão de concluir (PD-04).
- `apps/web/src/features/tasks/components/complete-button.tsx` (criar): `CompleteButton`, o `Button` `success` só com o ícone de check, `aria-pressed` e o nome que diz a ação (PD-04, PD-33).
- `apps/web/src/features/tasks/screens/task-screen.tsx` (criar): detalhe da tarefa com o cabeçalho (PD-14), "Concluir hoje" ou "Concluir" com texto (PD-04, PD-33), as abas Visão geral e, na recorrente, Ocorrências, e as abas extras recebidas por `extra_tabs`.
- `apps/web/src/features/tasks/screens/task-overview.tsx` (criar): visão geral da tarefa em cartões, com "Tarefa", "Anotações" e "Registro" (PD-59).
- `apps/web/src/features/tasks/screens/tasks-screen.tsx` (criar): listagem com filtros, busca e visualização em lista ou agrupada por dia (RF-38, RF-39).
- `apps/web/src/features/tasks/screens/task-form-screen.tsx` (criar): criar e editar tarefa pontual ou recorrente em rota própria.
- `apps/web/src/features/tasks/screens/tasks-screens.test.tsx` (criar): testes das telas, dos estados e do axe (CT-24).
- `apps/web/src/features/tasks/tasks.e2e.ts` (criar): fluxo ponta a ponta de CT-24, rodado na TASK-35.

### Passos

1. Leia os arquivos de "Ler" e anote os nomes do cliente da API, do helper de mutação otimista, do aviso de recusa, da formatação `Intl`, do estado da listagem na URL e do relógio injetável em `apps/web/src/shared`, e os tipos de `@atria/contracts` das rotas do contexto tasks (TASK-09): `GET|POST /tasks` (filtros `status=open|completed`, `recurring`, `label`, `due_from`, `due_to`, `q`, `cursor`, `limit`; a tarefa tem `labels: string[]`, DEC-006), `GET|PATCH|DELETE /tasks/{id}` (`PATCH` aceita `recurrence` com `effective_from`), `POST /tasks/{id}/completion` (corpo com `occurrence_date`, obrigatório na recorrente), `DELETE /tasks/{id}/completion?occurrence_date=` (reabrir) e `GET /tasks/occurrences?from=&to=` (até 366 dias, com `task_id`, `occurrence_date` e `completed`). O fuso vem de `GET /api/v1/me/preferences`. Use esses nomes nos passos seguintes.
2. Crie `apps/web/src/features/tasks/i18n/pt-br.json` com chaves em `snake_case` agrupadas por tela (`list`, `form`, `recurrence`, `completion`, `reports`, `nav`), sem os resumos da regra, que vêm do `summarizeRule` da base (DEC-008), em tom calmo (ex.: vazio de hoje: "Nada marcado para hoje."), sem contador de pendências e sem "atrasada".
3. Escreva `hooks/use-tasks.test.tsx` com o relógio fixo em `2026-11-05T12:00:00Z` e fuso `America/Sao_Paulo`, e depois `use-tasks.ts`: `useTasks(filters)` com `useInfiniteQuery` por cursor sobre `GET /api/v1/tasks` com `status` (`open`/`completed`), `recurring`, `label` (DEC-006), `due_from`, `due_to` e `q`, e `useTaskOccurrences(from, to)` sobre `GET /api/v1/tasks/occurrences`, juntados por `task_id` para mostrar as tarefas pontuais do período e as ocorrências das recorrentes (o período padrão é hoje, em datas locais no fuso do usuário; as recorrentes não guardam histórico, então o período das ocorrências nunca começa antes de hoje e a tela não pede datas passadas ao servidor); `useCreateTask` (`POST /api/v1/tasks`, com a regra de recorrência quando marcada; não otimista na lista porque as ocorrências vêm do servidor) `useUpdateTask` (`PATCH /api/v1/tasks/{id}`, otimista com reversão; para recorrentes, envia `recurrence` com `effective_from`, RN-08) e `useDeleteTask` (`DELETE /api/v1/tasks/{id}`, otimista com reversão). Testes `lists today tasks in the user timezone`, `dec006 sends the label filter to the server` (com `?label=casa` na URL, a requisição leva `label=casa`), `merges recurring occurrences by task id`, `creates a daily recurring task`, `updates a recurrence only from this occurrence on`, `recurring occurrences start today` (período "semana" pede `from` igual a hoje) e `deletes a task optimistically`.
4. Escreva `hooks/use-task-completion.test.tsx` e depois `use-task-completion.ts`: `useCompleteTask` envia `POST /api/v1/tasks/{id}/completion` com `occurrence_date` quando a tarefa é recorrente (RN-09) e `useReopenTask` envia `DELETE /api/v1/tasks/{id}/completion` com `occurrence_date` na query quando recorrente; as duas são otimistas no cache, mudando só o item daquela ocorrência, e restauram com aviso quando recusadas (RNF-09). Testes `completes and reopens a single task`, `completes only today occurrence of a daily task` e `rolls back the completion and warns when refused`.
5. Use o `FormRecurrence` de `apps/web/src/shared/forms/recurrence-fields.tsx` (TASK-05, DEC-008), com o horário (`with_time` no padrão `true`), para a regra completa (DEC-006, item 4: não reduza a "Pontual" e "Diária" do protótipo): frequência, intervalo, dias da semana, dia do mês com a ajuda de meses curtos (CB-02, CB-03), horário em 24 h, início e fim, com o fuso do usuário na regra. O horário é opcional nas Tarefas: o esquema `zod` do formulário aceita a regra sem `time` (nos Lembretes ele é obrigatório). Os resumos da regra ("Todo dia", "Toda semana: seg e qua", "A cada 2 meses, dia 31", "Todo ano") vêm de `summarizeRule(rule, locale)`, com o `locale` de `usePreferences()`. A feature não cria editor nem resumo próprios da regra.
5a. Escreva `lib/task-reports.test.ts` (`builds the module report path`) e depois `lib/task-reports.ts` (PD-61): `TASKS_REPORTS = [{ id: 'tasks-done', title_key: 'tasks.reports.tasks_done' }]` (o único relatório do módulo `tasks` no catálogo da TASK-17 e no `REPORTS` do protótipo) e `tasksReportHref(id)` que devolve `/reports/<id>?from_module=tasks`. O `tasks-done` não tem filtro de entidade (não está no `REP_ENTITY` do protótipo): o detalhe da tarefa não emite relatório.
6. Escreva `components/complete-button.test.tsx` e depois `components/complete-button.tsx` e `components/task-item.tsx` (PD-04, PD-33). `CompleteButton({ title, done, when })` é o `Button` da TASK-05 na variação `success`, só com o ícone de check (SVG com `aria-hidden="true"`), área mínima de 36 px, `aria-pressed={done}`, `aria-label` e `title` com a ação e o título: "Concluir: <título>" e "Reabrir: <título>" na pontual, "Concluir hoje: <título>" e "Reabrir hoje: <título>" na ocorrência de hoje, e "Concluir em <data por Intl>: <título>" nas ocorrências dos próximos dias. Testes `pd04 names the action and the title`, `pd04 uses the success variant and aria-pressed when done` e `has no axe violations`. `task-item.tsx`: título como link para `/tasks/$taskId`, data da ocorrência por `Intl`, as etiquetas em pills (DEC-006), ícone de recorrência com `aria-hidden="true"` e texto "Repete" para leitor de tela, o selo de status ("Aberta hoje" ou "Feita hoje" na ocorrência de hoje da recorrente, PD-33; "Aberta" ou "Concluída" na pontual) com o fundo `*Soft` do token, e o `CompleteButton`; tarefa concluída com texto riscado e token neutro, nunca vermelho para pendência. Nenhuma caixa de seleção para concluir.
7. Escreva `screens/tasks-screens.test.tsx` (Testing Library, `userEvent` e axe) e depois as telas. Todo teste verifica: cabeçalho com `page-heading` e subtítulo; estados carregando, vazio com texto explicativo e erro com "Tentar de novo"; erros de formulário em `role="alert"`; navegação completa por `userEvent.tab()` com foco visível; Espaço ou Enter no `CompleteButton` conclui; zero violações no axe.
8. `tasks-screen.tsx` em `/tasks`: filtros por status, tipo (pontual ou recorrente), etiqueta (um `TextField` "Etiqueta" que grava `?label=` ao confirmar com Enter e limpa com o campo vazio, DEC-006) e período (hoje, semana com hoje e os seis dias seguintes, todas), com a ajuda "Tarefas que repetem mostram só hoje e os próximos dias." e as pontuais vencidas e não concluídas listadas como abertas, sem a palavra "atrasada", busca e visualização em lista ou agrupada por dia, com os nomes acessíveis "Filtros", "Busca" e "Visualização" (usados pelos e2e da TASK-35), na URL (`?status=&recurring=&label=&range=&q=&view=`); excluir pede confirmação num diálogo; o cabeçalho tem "Nova tarefa" (primário) e "Relatórios", um `MenuButton` da TASK-05 com um item por relatório de `TASKS_REPORTS` ("Tarefas concluídas e abertas", link para `/reports/tasks-done?from_module=tasks`), como o botão "Relatórios" do módulo no protótipo (PD-61); os filtros com lista de opções usam o `SelectField` da TASK-05, nunca um `<select>` nativo (PD-62). A ocorrência de hoje de uma recorrente se conclui pela listagem com o `CompleteButton` "Concluir hoje: <título>" e mostra "Aberta hoje" ou "Feita hoje" (PD-33); a ocorrência de um dia passado nunca é oferecida, e a recusa `occurrence_in_past` do servidor desfaz a mudança com aviso (PD-32). Testes `filters tasks through the url`, `dec006 filters tasks by label through the url` (digitar "casa" + Enter deixa `?label=casa` na URL), `pd61 lists the tasks report in the Relatórios menu` (abre o menu e vê "Tarefas concluídas e abertas" com `href="/reports/tasks-done?from_module=tasks"`), `keeps overdue single tasks open without history of recurring ones`, `switches between list and grouped by day`, `completes and reopens a task from the list`, `pd33 completes today occurrence from the list and shows Feita hoje`, `pd04 completes from the list with the icon-only check button` (nenhum `checkbox` na lista; o botão tem o nome "Concluir hoje: Alongamento da manhã"), `pd32 rolls back when the server refuses a past occurrence` e `shows empty, loading and error states`.
9. `task-screen.tsx` e `task-overview.tsx` em `/tasks/$taskId`: cabeçalho com "Voltar", eyebrow "Tarefas · Tarefa", título e subtítulo (o resumo da regra na recorrente por `summarizeRule(rule, locale)` da base, como "Todo dia", "Toda semana: seg e qua", "A cada 2 meses, dia 31" ou "Todo ano", ou "Para <data>" na pontual; DEC-006, DEC-008) e, nas ações (PD-14), o botão com texto "Concluir hoje" ou "Reabrir hoje" na recorrente que tem ocorrência hoje (sem ocorrência hoje, como numa semanal fora do dia, o botão não aparece e o subtítulo mostra a próxima data) e "Concluir" ou "Reabrir" na pontual (PD-04: no detalhe o botão tem texto; PD-33), "Editar" com o ícone de lápis e o `MenuButton` "⋯ Mais ações" (`aria-label="Mais ações"`) com "Excluir" em tom `danger`, que pede confirmação e volta à lista; abas Visão geral (padrão) e, na recorrente, Ocorrências, na URL (`tab=overview|occurrences`), seguidas das abas recebidas pela propriedade `extra_tabs` (`{ id, label, render }[]`), para a TASK-35 montar Conexões sem esta feature importar outras. Visão geral (PD-59): zona principal com o cartão "Tarefa" (Status, com "Aberta hoje" ou "Feita hoje" na recorrente, Repetição com o resumo da regra completa por `summarizeRule` (DEC-006, DEC-008) e, na pontual, Data) e o cartão "Anotações" só quando houver descrição; lateral com o cartão "Registro" (as etiquetas em pills no topo, quando houver, como o `reg` do protótipo, e Visibilidade, Criado em e Atualizado em, por `Intl`) (DEC-006); uma coluna abaixo de 960 px. A aba Ocorrências mostra hoje e os seis dias seguintes, cada um com o `CompleteButton`, e o texto "Cada dia é concluído separadamente. Só hoje e os próximos dias aparecem: os dias que já passaram não ficam guardados." (PD-32). Testes `pd33 completes and reopens today from the detail with a text button`, `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações`, `deletes the task after confirmation from Mais ações`, `pd59 shows the overview in cards with Tarefa, Anotações and Registro` (com etiquetas, elas aparecem no cartão "Registro"), `dec006 summarizes the full rule in the overview` (uma semanal de seg e qua mostra "Toda semana: seg e qua" em Repetição), `pd32 lists only today and the next six days in Ocorrências` e `shows the Visão geral and Ocorrências tabs before the extra tabs`.
10. `task-form-screen.tsx` em `/tasks/new` e `/tasks/$taskId/edit`: `react-hook-form` com `zod` (título obrigatório, descrição opcional, data opcional para pontual, a repetição "Pontual" ou "Recorrente" que mostra o `FormRecurrence` da base com a regra completa e o horário, etiquetas `string[]` opcionais, enviadas como `labels` (até 20, cada uma com até 50 caracteres, sem repetidas sem diferenciar maiúsculas, as mesmas regras da TASK-09; o erro aparece no campo com `role="alert"`, e o 422 do servidor também), visibilidade com padrão pessoal), com a base da TASK-05 (PD-19, PD-57, PD-62): o `PageHeader` com "Voltar" e o formulário numa coluna centralizada na largura do `FormGrid`; título, descrição, etiquetas, visibilidade e o `fieldset` da recorrência com `data-span="full"`; as etiquetas no `FormTags`, o `TagField` da base em pills (PD-11, DEC-006), enviadas como `labels`; a repetição em `FormSegmented` ("Pontual" e "Recorrente", no lugar da caixa "Repetir"); a data da pontual em `FormDate`; a visibilidade em `FormSegmented` ("Pessoal" e "Compartilhada"); e o `FormActions` com "Cancelar" (`ghost`, volta ao detalhe na edição e à lista na criação) e "Salvar". Ao editar uma recorrente aberta a partir de uma ocorrência (`?from=<data da ocorrência>`), a mudança da regra vai com `effective_from` igual a essa data, com o texto "Vale para esta ocorrência e as próximas não concluídas" (RN-08). Testes `creates a single task`, `creates a daily task and completes today occurrence only`, `changes a recurring task from an occurrence on`, `pd62 lays the form in the grid with the repetition as a segmented field` (título, descrição e visibilidade com `data-span="full"`, nenhum `<select>`, `<input type="date">` nem caixa "Repetir", e "Cancelar" antes de "Salvar"), `pd57 picks the due date and the rule start in the custom calendar`, `pd62 accepts 930 as 09:30 in the rule time`, `pd19 centers the header and the form in the form column`, `dec006 adds labels as pills and sends them with the task` ("casa" + Enter e "saúde" + vírgula viram duas pills, e o envio leva `labels: ['casa', 'saúde']`), `dec006 refuses more than 20 labels or a label longer than 50 characters inside the form` (o erro em `role="alert"` no campo e nenhum envio) e `dec006 offers the full recurrence rule` (com "Recorrente", a frequência lista Diária, Semanal, Mensal e Anual; "Semanal" mostra os dias da semana, "Mensal" o dia do mês com a ajuda de meses curtos, e o envio de uma semanal a cada 2 semanas em seg e qua leva a regra com `interval: 2` e os dois dias).
11. Crie `apps/web/src/features/tasks/nav.ts` exportando `tasksNav` com `path: '/tasks'`, `label_key: 'tasks.nav.title'` e o ícone SVG, no formato de item de navegação de `apps/web/src/shared`.
12. Crie `apps/web/src/features/tasks/routes.tsx` exportando `createTasksRoutes(parent: AnyRoute)` com as quatro rotas, o esquema `zod` dos parâmetros de busca da lista e o `tab` (`overview` ou `occurrences`, padrão `overview`) do detalhe. Não altere `apps/web/src/app`.
13. Crie `apps/web/src/features/tasks/tasks.e2e.ts` com `single task is completed and reopened` e `daily task completes only today occurrence`, em 360 px e desktop, com axe. Não rode: os e2e rodam na TASK-35.
14. Rode o bloco de "Verificação" e corrija até passar sem warnings.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# Testes de componente e de hook da feature (Vitest + Testing Library + axe)
pnpm --filter @atria/web test -- src/features/tasks
# Tipos e lint sem nenhum erro ou warning
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
# e2e escrito (roda na TASK-35)
test -s apps/web/src/features/tasks/tasks.e2e.ts
# Nenhuma cor literal fora dos tokens do tema
! grep -rnE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(' apps/web/src/features/tasks --include=*.tsx --include=*.ts --include=*.css
# Nenhum controle nativo que a base da TASK-05 substitui (PD-57, PD-62)
! grep -rnE '<select|type="(date|time|datetime-local)"' apps/web/src/features/tasks --include=*.tsx
# Editor e resumo da regra da base, sem cópia local (DEC-008)
test ! -e apps/web/src/features/tasks/components/recurrence-fields.tsx
! grep -rnE "features/tasks/components/recurrence-fields|['\"]\.\.?/(components/)?recurrence-fields['\"]|function (RecurrenceFields|FormRecurrence|summarizeRule)" apps/web/src/features/tasks
grep -rq 'FormRecurrence' apps/web/src/features/tasks/screens/task-form-screen.tsx
grep -rq 'summarizeRule' apps/web/src/features/tasks/screens
```

### Evidências

- `tasks-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/tasks --reporter=verbose`
  - Prova: tarefas pontuais e recorrentes passam nos testes, com conclusão por ocorrência, reversão e axe sem violações (RF-38, RF-39, CT-24, RNF-06, RNF-09).
  - Trecho: as linhas `✓` de `completes and reopens a single task`, `completes only today occurrence of a daily task`, `creates a daily task and completes today occurrence only`, `rolls back the completion and warns when refused` e `shows empty, loading and error states`, e o resumo sem falhas.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `tasks-pd-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/tasks --reporter=verbose -t "(pd|dec)[0-9]"`
  - Prova: as telas seguem as decisões do protótipo e a DEC-006: botão de concluir só com o ícone nas listas e com texto no detalhe, "Concluir hoje" e "Feita hoje" na diária, sem histórico das recorrentes, cabeçalho do detalhe, visão geral em cartões, formulário na grade, calendário e hora da base, coluna centralizada, relatório do módulo, etiquetas e a regra de recorrência completa (DEC-002, DEC-006, PD-04, PD-11, PD-14, PD-19, PD-32, PD-33, PD-57, PD-59, PD-61, PD-62).
  - Trecho: as linhas `✓` de `pd61 lists the tasks report in the Relatórios menu`, `dec006 sends the label filter to the server`, `dec006 filters tasks by label through the url`, `dec006 adds labels as pills and sends them with the task`, `dec006 offers the full recurrence rule`, `dec006 summarizes the full rule in the overview`, `pd04 completes from the list with the icon-only check button`, `pd33 completes today occurrence from the list and shows Feita hoje`, `pd33 completes and reopens today from the detail with a text button`, `pd32 rolls back when the server refuses a past occurrence`, `pd32 lists only today and the next six days in Ocorrências`, `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações`, `pd59 shows the overview in cards with Tarefa, Anotações and Registro`, `pd62 lays the form in the grid with the repetition as a segmented field`, `pd57 picks the due date and the rule start in the custom calendar` e `pd19 centers the header and the form in the form column`.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `tasks-e2e-specs.txt` (automática): `grep -n "test(" apps/web/src/features/tasks/tasks.e2e.ts`
  - Prova: os fluxos ponta a ponta de CT-24 estão escritos para a TASK-35.
  - Trecho: as linhas com `single task is completed and reopened` e `daily task completes only today occurrence`.
  - Falha: `No such file or directory` ou saída vazia.
- `tasks-telas.png` (manual): prints da lista em lista e agrupada por dia, com o menu "Relatórios" aberto e o filtro de etiqueta, com tarefas pontuais, com etiquetas em pills, recorrentes ("Aberta hoje" e "Feita hoje") e concluídas e o botão de check, da lista vazia, carregando e com erro, do detalhe com a visão geral em cartões, "Concluir hoje" e o "Mais ações" aberto, da aba Ocorrências, e do formulário na grade com as etiquetas em pills, a recorrência semanal aberta com os dias da semana e o calendário aberto, nos temas claro e escuro, em 360 px e em desktop, mais um print com o foco visível pelo teclado no botão de concluir. Capture com `pnpm --filter @atria/web dev`, montando localmente as rotas de `createTasksRoutes` sem salvar mudança em `apps/web/src/app`.
  - Prova: identidade visual, tom calmo, os dois temas, 360 px e desktop, os estados e o foco por teclado (RNF-06, RNF-08, RNF-10).
  - Trecho: pendências sem vermelho nem contador, a concluída riscada em token neutro, o check verde claro que fica verde cheio quando feita e o anel de foco visível.
  - Falha: rolagem horizontal em 360 px, vermelho ou contador de urgência, estado sem texto ou foco invisível.

### Concluída quando

- [ ] Tarefas pontuais são cadastradas, concluídas e reabertas, com a mudança na hora e desfeita com aviso se o servidor recusar (RF-38, CT-24, RNF-09).

  > Como comprovar: em `tasks-tests.txt`, ver aprovados `creates a single task`, `completes and reopens a single task`, `completes and reopens a task from the list` e `rolls back the completion and warns when refused`.

- [ ] Tarefas recorrentes são criadas e cada ocorrência é concluída separadamente; mudar a regra vale desta ocorrência em diante (RF-39, CT-24).

  > Como comprovar: em `tasks-tests.txt`, ver aprovados `creates a daily recurring task`, `completes only today occurrence of a daily task`, `creates a daily task and completes today occurrence only` e `changes a recurring task from an occurrence on`.

- [ ] Tarefas recorrentes mostram só hoje e os próximos dias, sem histórico, e as pontuais vencidas continuam na lista como abertas (RF-39).

  > Como comprovar: em `tasks-tests.txt`, ver aprovados `recurring occurrences start today` e `keeps overdue single tasks open without history of recurring ones`.

- [ ] A listagem tem filtros, busca e visualização na URL, com "hoje" no fuso do usuário (RF-38).

  > Como comprovar: em `tasks-tests.txt`, ver aprovados `filters tasks through the url`, `switches between list and grouped by day` e `lists today tasks in the user timezone`.

- [ ] As telas têm estados vazio, carregando e erro, navegam por teclado e não têm violações no axe (RNF-06).

  > Como comprovar: em `tasks-tests.txt`, ver aprovado `shows empty, loading and error states` e o resumo sem falhas.

- [ ] As telas funcionam em 360 px e desktop, nos dois temas, em tom calmo e só com tokens do tema (RNF-08, RNF-10).

  > Como comprovar: abrir os prints de `tasks-telas.png` e conferir as telas legíveis nos dois temas e larguras; o último comando da Verificação não encontra cor literal.

- [ ] Concluir nas listas é um botão só com o ícone de check, com o nome da ação e do título, e no detalhe é um botão com texto; a ocorrência de hoje da diária se conclui pela listagem e pelo detalhe, com "Aberta hoje" ou "Feita hoje" (PD-04, PD-33).

  > Como comprovar: em `tasks-pd-tests.txt`, ver aprovados `pd04 completes from the list with the icon-only check button`, `pd33 completes today occurrence from the list and shows Feita hoje` e `pd33 completes and reopens today from the detail with a text button`.

- [ ] Recorrentes não oferecem dias passados: a aba Ocorrências mostra hoje e os seis dias seguintes, e a recusa de uma data passada desfaz a mudança com aviso (PD-32).

  > Como comprovar: em `tasks-pd-tests.txt`, ver aprovados `pd32 lists only today and the next six days in Ocorrências` e `pd32 rolls back when the server refuses a past occurrence`.

- [ ] O detalhe da tarefa tem "Editar" com lápis, "Mais ações" com "Excluir" em vermelho e a visão geral em cartões (Tarefa, Anotações e Registro) (PD-14, PD-59).

  > Como comprovar: em `tasks-pd-tests.txt`, ver aprovados `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações` e `pd59 shows the overview in cards with Tarefa, Anotações and Registro`; em `tasks-tests.txt`, `deletes the task after confirmation from Mais ações`.

- [ ] O módulo emite o relatório "Tarefas concluídas e abertas" pelo botão "Relatórios" do cabeçalho da lista (PD-61).

  > Como comprovar: em `tasks-pd-tests.txt`, ver aprovado `pd61 lists the tasks report in the Relatórios menu`; em `tasks-tests.txt`, `builds the module report path`.

- [ ] A tarefa tem etiquetas em pills no formulário, na lista e no cartão "Registro", e a lista filtra por etiqueta (DEC-006, PD-11).

  > Como comprovar: em `tasks-pd-tests.txt`, ver aprovados `dec006 sends the label filter to the server`, `dec006 filters tasks by label through the url` e `dec006 adds labels as pills and sends them with the task`.

- [ ] A recorrência oferece a regra completa (frequência, intervalo, dias da semana, dia do mês, horário, início e fim) pelo `FormRecurrence` da base, o mesmo dos lembretes e do Financeiro, e o detalhe mostra o resumo da regra pelo `summarizeRule` da base, sem cópia local (DEC-006, DEC-008).

  > Como comprovar: em `tasks-pd-tests.txt`, ver aprovados `dec006 offers the full recurrence rule` e `dec006 summarizes the full rule in the overview`; a Verificação não acha `components/recurrence-fields.tsx` na feature e acha `FormRecurrence` no formulário e `summarizeRule` nas telas.

- [ ] O formulário usa a base da TASK-05: grade numa coluna centralizada, repetição e visibilidade em grupo segmentado, datas no calendário próprio, hora em 24 h e as ações à direita (PD-19, PD-57, PD-62).

  > Como comprovar: em `tasks-pd-tests.txt`, ver aprovados `pd62 lays the form in the grid with the repetition as a segmented field`, `pd57 picks the due date and the rule start in the custom calendar` e `pd19 centers the header and the form in the form column`; em `tasks-tests.txt`, `pd62 accepts 930 as 09:30 in the rule time`; o último comando da Verificação não encontra controle nativo.

- [ ] Typecheck e lint passam sem warning, e o e2e da feature está escrito para a TASK-35.

  > Como comprovar: rodar o bloco de "Verificação" e ver que termina sem erro; `tasks-e2e-specs.txt` lista os dois fluxos.

## Descrição

### Resumo executivo

Entrega as telas de Tarefas: tarefas pontuais e recorrentes, com conclusão de cada ocorrência separadamente.
A pessoa organiza o dia sem contadores de pendência nem vermelho, e vê a conclusão na hora.
Perfil padrão, risco baixo: as regras de recorrência ficam no servidor; a tela só as mostra e envia.
Depende da base do frontend e dos contratos do servidor; destrava a integração final do frontend.

### Detalhes técnicos

**Abordagem.** Feature isolada em `apps/web/src/features/tasks`, com telas sem regra de negócio e hooks do TanStack Query. As ocorrências das recorrentes vêm do servidor (TASK-09); a tela não gera datas. Formulários com `react-hook-form` e `zod`. A feature exporta `createTasksRoutes` e `tasksNav`.

**Componentes.** Lista (`/tasks`, com `?status=&recurring=&label=&range=&q=&view=` e o menu "Relatórios") em lista ou agrupada por dia, detalhe (`/tasks/$taskId?tab=overview|occurrences`) com a visão geral em cartões, formulário em rota própria (`/tasks/new`, `/tasks/$taskId/edit`), linha da tarefa e botão de concluir; os campos e o resumo da recorrência vêm da base (`FormRecurrence`, `summarizeRule`, DEC-008).

**Decisões.**
- Concluir e reabrir otimistas, por ocorrência (RN-09). Criação de recorrente não otimista na lista, porque as ocorrências são geradas pelo servidor; descartada a geração no cliente, que duplicaria as regras de fim de mês e 29/02 (CB-02, CB-03).
- Mudar uma recorrente a partir de uma ocorrência envia `effective_from` igual à data dela (RN-08). Descartado: diálogo "só esta" ou "desta em diante", porque o contrato da TASK-09 não edita uma ocorrência sozinha.
- Lista montada com `GET /tasks` e `GET /tasks/occurrences` (rota extra da TASK-09), juntados por `task_id`. Descartado: gerar as ocorrências no cliente.
- Recorrentes sem histórico, decidido no protótipo (TASK-01): as ocorrências começam hoje e a "semana" é hoje e os seis dias seguintes; só a tarefa pontual vencida continua na lista. Critério: o servidor descarta as conclusões passadas (TASK-09), e uma semana para trás mostraria ocorrências que não existem mais.
- Regra de recorrência completa (DEC-006, item 4) pelo `FormRecurrence` da base (DEC-008), o mesmo dos lembretes e do Financeiro, com o horário (`with_time` padrão) opcional pelo `zod` desta feature, e o resumo da regra pelo `summarizeRule(rule, locale)` da base. Descartados: só "Pontual" e "Diária", como no protótipo; e um `recurrence-fields.tsx` próprio da feature, que repetia o do Financeiro e o dos Lembretes e que a DEC-008 troca pelo componente da base.
- Etiquetas (DEC-006, item 1): `labels` no `FormTags` (o `TagField` da base, PD-11), em pills na linha da tarefa e no cartão "Registro", e o filtro `label` na lista, que a TASK-09 passa a oferecer. O filtro é um campo de texto confirmado com Enter, porque não há rota que liste as etiquetas existentes. Descartado: tirar as etiquetas da tela.
- Relatórios pelo módulo (PD-61): o botão "Relatórios" do cabeçalho da lista leva a `/reports/tasks-done?from_module=tasks` (TASK-34, sobre o `tasks-done` da TASK-17, sem período), no padrão `/reports/<id>?from_module=<módulo>` das outras features. O `tasks-done` não tem filtro de entidade, então o "Mais ações" do detalhe não emite relatório. Descartado: gerar o relatório na própria tela.
- Tarefa se conclui e lembrete só avisa (RN-19): esta feature não cria lembretes.
- Concluir com o botão de check (DEC-002, PD-04, PD-33): nas listas e na aba Ocorrências, o `Button` `success` só com o ícone, com `aria-pressed` e o nome "Concluir hoje: <título>"; no detalhe, o botão com texto. Descartada: a caixa de seleção com o título como rótulo, que a PD-04 troca.
- Detalhe próprio em `/tasks/$taskId` (PD-14, PD-33, PD-59), que a tarefa não tinha e que a aba Conexões da TASK-31 e o registro da TASK-35 já esperam; cabeçalho com "Editar" e "Mais ações", "Excluir" só dentro do menu; visão geral em cartões e Ocorrências numa aba, como no protótipo. Descartado: só a listagem e o formulário, que deixariam a PD-33 sem o "Concluir hoje" do detalhe.
- Formulário com a base da TASK-05 (PD-19, PD-57, PD-62): `FormGrid`, `FormActions`, repetição em `FormSegmented` ("Pontual" e "Recorrente", no lugar da caixa "Repetir"), frequência em `FormSelect`, datas em `FormDate`, hora em `FormTime` e visibilidade em `FormSegmented`.

**Riscos.** O campo `labels` e o filtro `label` vêm do ajuste da TASK-09 pela DEC-006; a tela repete os limites do servidor (20 etiquetas de até 50 caracteres, sem repetidas) para o erro aparecer antes do envio. `GET /tasks/occurrences` aceita no máximo 366 dias: o período "todas" lista só as tarefas, sem expandir ocorrências. "Hoje" precisa ser calculado no fuso do usuário com o relógio injetável ([project/testing-07]).

**Referências.** RF-38, RF-39; CT-24; RN-08, RN-09, RN-19; CB-02, CB-03; RNF-06, RNF-08, RNF-09, RNF-10; decisões 3 e 18 da spec; DEC-002, DEC-003, DEC-004, DEC-006 e DEC-008; PD-04, PD-11, PD-14, PD-19, PD-32, PD-33, PD-57, PD-59, PD-61 e PD-62 de `docs/decisoes-do-prototipo.md`.

**Arquivos em comum na onda 7.** Nenhum: cada feature só cria arquivos na própria pasta. O `FormRecurrence` e o `summarizeRule` vêm da base (TASK-05) e são só importados, também pela TASK-22 e pela TASK-25.

### Card

- **Título:** Telas de Tarefas
- **Tipo:** historia
- **Descrição:** Telas de Tarefas pontuais e recorrentes, com cada ocorrência concluída separadamente.
- **Critérios de aceite:**
  - [ ] Tarefas pontuais são criadas, concluídas e reabertas.
  - [ ] Numa tarefa diária, só a ocorrência de hoje fica concluída.
  - [ ] Recorrentes mostram só hoje e o futuro; pontuais vencidas continuam abertas.
  - [ ] Conclusão aparece na hora e é desfeita com aviso se recusada.
  - [ ] Concluir é um botão de check nas listas e um botão com texto no detalhe, com "Concluir hoje" e "Feita hoje" na diária.
  - [ ] A tarefa tem detalhe com "Editar", "Mais ações" com "Excluir" e a visão geral em cartões.
  - [ ] O formulário segue a grade da base, com datas no calendário próprio e a repetição em grupo segmentado.
  - [ ] A recorrência oferece a regra completa pelo editor da base, o mesmo dos lembretes e do Financeiro, com o resumo da regra da base, sem cópia local.
  - [ ] Tarefas têm etiquetas, e a lista filtra por etiqueta.
  - [ ] O botão "Relatórios" da lista abre "Tarefas concluídas e abertas".
  - [ ] Telas acessíveis, com estados vazio, carregando e erro, em 360 px e desktop, nos dois temas.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ocorrências das recorrentes a partir de hoje e semana para a frente; pontuais vencidas abertas; testes e critério novos |
| 2 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004 e os componentes da TASK-05; PD-04: CompleteButton success só com o check nas listas e na aba Ocorrências, com nome Concluir hoje: título, e botão com texto no detalhe, no lugar da caixa de seleção; PD-33: Concluir hoje e Reabrir hoje na listagem e no detalhe, selos Aberta hoje e Feita hoje; PD-32: aba Ocorrências com hoje e os seis dias seguintes e reversão de occurrence_in_past; PD-14 e PD-59: detalhe /tasks/$taskId com Editar, Mais ações com Excluir e visão geral em cartões Tarefa, Anotações e Registro, com extra_tabs; PD-62, PD-57 e PD-19: FormGrid, FormActions, repetição e visibilidade em FormSegmented, frequência em FormSelect, datas em FormDate, hora em FormTime e coluna centralizada; Verificação sem controles nativos; evidência tasks-pd-tests.txt, Concluída quando, Detalhes técnicos e card atualizados; linha test -e da pasta da feature removida da Baseline, recusada pela validação |
| 3 | 2026-10-30 | agente | Etiquetas da tarefa no FormTags (TagField da base), em pills na linha e no cartão Registro, e filtro tag na lista e no useTasks, com testes dec006 (DEC-006, PD-11); recorrência com a regra completa e o mesmo editor dos lembretes e do Financeiro, resumo da regra no subtítulo e no cartão Tarefa, Concluir hoje só com ocorrência hoje, testes dec006 offers the full recurrence rule e dec006 summarizes the full rule in the overview (DEC-006); botão Relatórios na lista com tasks-done, lib/task-reports.ts e teste pd61 (PD-61); Ler, Mudar, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 4 | 2026-10-30 | agente | Nomes do contrato da TASK-09 ajustada (DEC-006): campo labels no lugar de tags e filtro label no lugar de tag, na URL, no useTasks, no formulário, nos testes dec006 e nos Detalhes técnicos; limites de 20 etiquetas de até 50 caracteres sem repetidas no zod, com o teste dec006 refuses more than 20 labels or a label longer than 50 characters inside the form |
| 5 | 2026-10-30 | agente | DEC-008: components/recurrence-fields.tsx removido de Mudar; passo 5 usa FormRecurrence da base com o horário (opcional pelo zod da feature) e summarizeRule(rule, locale) para os resumos da regra; formulário (passo 10) e detalhe (passo 9) apontam para os componentes da base; resumos da regra fora do i18n da feature (passo 2); Ler com a API da TASK-05, DEC-008 e TASK-22/TASK-25 no mesmo editor; Verificação com grep que rejeita a cópia local e exige FormRecurrence e summarizeRule; testes da tela mantidos; Concluída quando, Detalhes técnicos e card atualizados |
