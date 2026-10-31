---
id: TASK-21
spec: SPEC-001
title: "Dashboard"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-22, RF-23, CT-16]
type: historia
labels: [SPEC-001, padrao]
status: approved
content_hash: 2509f5b1e57a79482c521a36265f2fcccb954129d1d3d7291d48e942f9ff5367
adjustments: 2
adjusted_at: 2026-10-30T21:54:59Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 2509f5b1e57a79482c521a36265f2fcccb954129d1d3d7291d48e942f9ff5367
attempts: 0
tests_result: null
regression_result: null
evidence_result: null
updated_at: 2026-10-30T21:54:59Z
---

# TASK-21: Dashboard

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-22, RF-23, CT-16, decisões 21 e 59 e os recursos `/accounts`, `/transactions`, `/tasks`, `/reminders`, `/books` e `/journal-entries` em "Contratos e interfaces")
- `prototype/atria-prototype.html` (Dashboard validado no protótipo: `greeting`, `BLOCKS`, `renderDashboard`, `blockHTML`, `dashTasks`, `dashReminders`, `dashUpcoming`, `dashJournal`, `dashMoney`, `dashReading`, `isMasked`, `DO['block-mask']`, `DASH_LIMIT`, `DASH_TODAY_LIMIT`, `PERIOD_OF_DAY` e as classes `.dash`, `.dash-zone`, `.dash-hello`, `.dash-done` e `.dash-more`)
- `docs/decisoes-do-prototipo.md` (PD-04, PD-15, PD-16, PD-25 a PD-31, PD-33, PD-34 e PD-51, e a seção "Decisões resolvidas em 30/10 (DEC-002)"): fonte das zonas, da saudação, dos blocos, dos limites, do olho e das mensagens, que valem sobre a spec. A PD-31 (bloco Metas) segue em aberto e não é aplicada.
- `docs/estudos/dashboard.md` (recomendação das duas zonas, da ordem dos blocos e das regras de exibição)
- `vostok/memory/decisions.md` (só pela consulta `vostok memory search decision DEC-002 DEC-003 DEC-004`: protótipo vale para o servidor, ocorrência aberta e previsão virtual, período livre do resumo)
- `vostok/work/tasks/SPEC-001/TASK-07.md` (passos 4 e 8: `GET /financial-summaries?from=&to=` com `balance` e `totals`, e `GET /transactions` com `from`, `to`, `kind`, `settled`, `limit` e os itens virtuais `open`, `overdue` e `forecast` das recorrentes, sem `id` e com `recurrence_id`)
- `vostok/work/tasks/SPEC-001/TASK-09.md` (passo 8: `GET /tasks`, `GET /tasks/occurrences?from=&to=`, `POST /tasks/{id}/completion` com `occurrence_date` e `DELETE /tasks/{id}/completion`)
- `vostok/work/tasks/SPEC-001/TASK-10.md` (passo 8: `GET /reminders/upcoming?from=&to=`, até 31 dias)
- `vostok/work/tasks/SPEC-001/TASK-12.md` (listagem de `/journal-entries` com o texto e as emoções)
- `vostok/work/tasks/SPEC-001/TASK-13.md` (`GET /books?reading_status=reading` e `progress_percent`, PD-35)
- `vostok/work/tasks/SPEC-001/TASK-22.md` (seção "Rotas" dos Detalhes técnicos: destinos dos links do Financeiro, inclusive `/finance/recurring-transactions/$recurrenceId` e o período `?period=` da aba Saídas)
- `vostok/work/tasks/SPEC-001/TASK-33.md` (passo 5: ids dos blocos `today`, `reminders`, `upcoming`, `journal`, `balance` e `reading` e a chave `atria.dashboard.hidden_blocks.<userId>` gravada em Configurações › Dashboard, PD-30)
- `vostok/work/tasks/SPEC-001/TASK-05.md` (passo 10: `PageHeader`, `Button` com a variação `success` e `IconButton`)
- `apps/web/src/app` (só leitura: layout e roteador raiz)
- `vostok/work/tasks/SPEC-001/TASK-06.md` (passo 8: `GET /me` com o id e o nome e `GET /me/preferences` com moeda, idioma e fuso)
- `apps/web/src/shared` (cliente da API, interface otimista e aviso de recusa, `Intl` com moeda e fuso do usuário, i18n comum, acesso protegido ao `localStorage` e helpers de teste com axe e relógio fixo)
- `packages/ui` (cartão, `PageHeader`, `Button` `success`, `IconButton`, barra de progresso, estados vazio, carregando e erro)
- `packages/theme` (tokens e temas claro e escuro)
- `packages/contracts` (tipos gerados das listagens de contas, movimentações, tarefas e ocorrências, lembretes, livros e entradas do diário)
- `vostok/rules/project/frontend.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`

### Mudar

- `apps/web/src/features/dashboard/routes.tsx` (criar): rota `/` do Dashboard, exportada por `createDashboardRoutes` para a TASK-35 registrar.
- `apps/web/src/features/dashboard/nav.ts` (criar): item "Início" da sidebar.
- `apps/web/src/features/dashboard/i18n/pt-br.json` (criar): textos da saudação, dos blocos e das mensagens.
- `apps/web/src/features/dashboard/blocks.ts` (criar): lista fixa dos blocos com id, zona e se é sensível (`today`, `reminders` e `upcoming` na principal; `journal`, `balance` e `reading` na lateral), com os ids da TASK-33 (PD-25, PD-27, PD-30).
- `apps/web/src/features/dashboard/hooks/use-hidden-blocks.ts` (criar): leitura dos blocos ocultos gravados por Configurações › Dashboard, na chave do navegador da TASK-33 (RF-23, PD-30).
- `apps/web/src/features/dashboard/hooks/use-hidden-blocks.test.tsx` (criar): testes da leitura, dos ids desconhecidos e do navegador sem armazenamento (CT-16).
- `apps/web/src/features/dashboard/hooks/use-masked-blocks.ts` (criar): blocos sensíveis com o conteúdo escondido pelo olho, guardados no navegador por usuário (PD-15).
- `apps/web/src/features/dashboard/hooks/use-masked-blocks.test.tsx` (criar): testes de esconder, mostrar e lembrar depois de recarregar (PD-15).
- `apps/web/src/features/dashboard/hooks/use-dashboard-data.ts` (criar): uma consulta por bloco, com "hoje", os próximos 7 dias, o mês atual e o mês seguinte calculados a partir do relógio injetado e do fuso do usuário, e a conclusão de tarefa de hoje (PD-27, PD-28, PD-29, PD-33).
- `apps/web/src/features/dashboard/hooks/use-dashboard-data.test.tsx` (criar): testes das consultas com relógio fixo, das tarefas de hoje com as vencidas, da conclusão, dos lembretes por período do dia e do bloco Dinheiro (RF-22, PD-27, PD-28, PD-29, PD-33, PD-51).
- `apps/web/src/features/dashboard/components/dashboard-block.tsx` (criar): cartão comum dos blocos, com título, o olho nos sensíveis e os estados carregando, vazio e erro (PD-15, PD-16).
- `apps/web/src/features/dashboard/components/calm-message.tsx` (criar): mensagem de estado calma, em itálico e texto secundário, sem fundo (PD-16).
- `apps/web/src/features/dashboard/components/greeting-card.tsx` (criar): saudação com o primeiro nome, a data longa, "Como foi o seu dia?" e "Escrever no diário" (PD-26).
- `apps/web/src/features/dashboard/components/complete-task-button.tsx` (criar): botão só com o ícone de check, na variação `success`, com o nome da ação (PD-04, PD-33).
- `apps/web/src/features/dashboard/components/components.test.tsx` (criar): testes da saudação, do botão de concluir, do olho e das mensagens (PD-04, PD-15, PD-16, PD-26).
- `apps/web/src/features/dashboard/screens/dashboard-screen.tsx` (criar): tela do Dashboard com a saudação e as duas zonas de blocos (PD-25 a PD-28, PD-34).
- `apps/web/src/features/dashboard/screens/dashboard-screen.test.tsx` (criar): testes das zonas, dos blocos, dos limites, dos estados de cada bloco, do bloco oculto, do olho e do axe (CT-16).
- `apps/web/src/features/dashboard/dashboard.e2e.ts` (criar): fluxos ponta a ponta do dashboard, do bloco oculto em Configurações e do olho, rodados na TASK-35.

### Passos

1. Leia os arquivos de "Ler" e anote: os nomes do cliente da API, do helper de mutação otimista e do aviso de recusa, da formatação `Intl` de moeda, data e hora no fuso do usuário, do acesso protegido ao `localStorage` e do relógio injetável em `apps/web/src/shared`, e que o id e o nome do usuário vêm de `GET /api/v1/me` e a moeda, o idioma e o fuso de `GET /api/v1/me/preferences`. Use esses nomes nos passos seguintes, sem criar equivalentes. O dashboard não tem botão "Ocultar" nem painel para escolher blocos: a escolha fica em Configurações › Dashboard, da TASK-33 (PD-30).
2. Crie `apps/web/src/features/dashboard/i18n/pt-br.json` com chaves em `snake_case` (`title`, `eyebrow`, `subtitle`, `greeting`, um grupo por bloco, `mask`, `all_hidden` e `error_retry`), em tom calmo e sem contadores de urgência, com os textos do protótipo: cabeçalho eyebrow "Visão geral", título "Dashboard" e subtítulo "O que importa hoje, num só lugar."; saudação "Bom dia", "Boa tarde" e "Boa noite", com ", {primeiro nome}" quando há nome, "Como foi o seu dia?" e "Escrever no diário" (PD-26); blocos "Tarefas de hoje", "Lembretes de hoje", "Próximos dias", "Diário", "Dinheiro" e "Leituras" (PD-27); tarefas "Tudo feito por hoje. Aproveite o resto do dia.", "Nenhuma tarefa para hoje. Aproveite." e "Ver todas ({n} tarefa hoje)" / "Ver todas ({n} tarefas hoje)" (PD-28); lembretes "Manhã", "Tarde", "Noite", "Nenhum lembrete para hoje." e "Ver todos ({n} lembrete hoje)" / "Ver todos ({n} lembretes hoje)"; próximos dias "Semana tranquila: nada previsto nos próximos 7 dias." e "Ver os próximos 30 dias"; diário "Nenhuma entrada ainda.", "Escrever a primeira", "Abrir entrada" e "Entrada oculta. Use o olho para mostrar."; leituras "Nenhuma leitura em andamento."; Dinheiro os textos da PD-29 do passo 8; olho "Esconder as informações de {bloco}" e "Mostrar as informações de {bloco}" (PD-15); botão de concluir "Concluir: {título}" e "Concluir hoje: {título}" (PD-04, PD-33); todos ocultos "Todos os blocos estão ocultos" e "Escolha os blocos em Configurações › Dashboard." (PD-30).
3. Crie `apps/web/src/features/dashboard/blocks.ts` com `DASHBOARD_BLOCKS`, a lista imutável `{ id, zone, sensitive }` na ordem do protótipo: `today` (`main`), `reminders` (`main`), `upcoming` (`main`), `journal` (`side`, sensível), `balance` (`side`, sensível) e `reading` (`side`), o tipo `DashboardBlockId` e as constantes `DASH_TODAY_LIMIT = 3` (tarefas e lembretes) e `DASH_LIMIT = 5` (próximos dias e contas do Dinheiro) (PD-27). Os ids são os da TASK-33, que grava os ocultos. O bloco "Metas" não entra: depende da PD-31, em aberto.
4. Escreva `hooks/use-hidden-blocks.test.tsx` e depois `use-hidden-blocks.ts` (RF-23, PD-30): `useHiddenBlocks(userId)` só lê, pelo acesso protegido de `apps/web/src/shared`, a lista JSON de ids ocultos na chave `atria.dashboard.hidden_blocks.<userId>`, gravada por Configurações › Dashboard (TASK-33), e devolve `hidden` e `isHidden(id)`; relê no evento `storage` da janela (outra aba mudou a escolha); ids desconhecidos e JSON inválido são descartados; sem acesso ao `localStorage` (exceção), todos os blocos aparecem. Testes `reads the hidden blocks saved by the dashboard settings`, `keeps a hidden block hidden after remount`, `ignores unknown ids and invalid json from storage` e `shows every block when storage throws`.
5. Escreva `hooks/use-masked-blocks.test.tsx` e depois `use-masked-blocks.ts` (PD-15): `useMaskedBlocks(userId)` devolve `isMasked(id)` e `toggleMask(id)`, só para os blocos `sensitive` (`journal` e `balance`), guardando a lista na chave `atria.dashboard.masked_blocks.<userId>` pelo acesso protegido; sem nada gravado, nada fica escondido; a escolha vale até ser trocada de novo; sem acesso ao `localStorage`, a mudança vale só na sessão. Testes `masks a sensitive block and remembers it after remount`, `shows a masked block again`, `ignores blocks that are not sensitive` e `keeps working when storage throws`.
6. Escreva `hooks/use-dashboard-data.test.tsx` com o relógio fixo em `2026-11-05T15:00:00Z` e fuso `America/Sao_Paulo` (12:00 local), e depois `use-dashboard-data.ts`, com um hook por bloco usando `useQuery` e `enabled: false` para bloco oculto (não busca o que não aparece):
   - `useTodayTasks` (PD-28, PD-33, PD-34): `GET /api/v1/tasks/occurrences?from=<hoje>&to=<hoje>` (as pontuais com vencimento hoje e a ocorrência de hoje das recorrentes, com `completed`) e `GET /api/v1/tasks?status=open&due_to=<ontem>` (as pontuais vencidas e não concluídas). Devolve `items`, os não concluídos em ordem (vencidas primeiro, por data, depois as de hoje), e `total_today`, todas as de hoje mais as vencidas, inclusive as já concluídas hoje (o número do "Ver todas"). `useCompleteTask()` envia `POST /api/v1/tasks/{id}/completion`, com `occurrence_date` igual a hoje na recorrente e sem corpo na pontual, de forma otimista: o item some de `items` na hora e `total_today` não muda; se o servidor recusar, o item volta e o aviso de recusa aparece.
   - `useTodayReminders` (PD-27): `GET /api/v1/reminders/upcoming?from=<início de hoje>&to=<fim de hoje>` em UTC, a partir do dia no fuso do usuário; devolve os lembretes ordenados pela hora local, agrupados em `morning` (antes de 12 h), `afternoon` (12 h a 18 h) e `night` (18 h em diante), e o total do dia.
   - `useUpcomingDays` (PD-27, PD-51): `GET /api/v1/transactions?settled=false&from=<amanhã>&to=<hoje+7>` (as gravadas não liquidadas e as ocorrências virtuais das recorrentes, status `open`, `overdue` ou `forecast`, sem `id` e com `recurrence_id`) e `GET /api/v1/reminders/upcoming?from=<início de amanhã>&to=<fim de hoje+7>`; junta os dois por data, até `DASH_LIMIT` itens, e agrupa por dia. Cada movimentação leva a `/finance/transactions/<id>` quando tem `id` e a `/finance/recurring-transactions/<recurrence_id>` quando é virtual (rotas da TASK-22); cada lembrete, a `/reminders/<id>`. A chave da lista é o `id`, ou `recurrence_id` com `occurrence_date`.
   - `useMoneyBlock` (bloco `balance`, PD-29): lê o resumo do Financeiro da TASK-07, sem somar saldos no cliente (RN-01). `GET /api/v1/financial-summaries?from=<1º dia do mês atual>&to=<último dia do mês atual>` dá o saldo total (`balance.current`), o saldo de cada conta (`balance.accounts`) e o que ainda falta no mês (para entradas e saídas, `totals.<tipo>.forecast` menos `totals.<tipo>.realized`, em centavos inteiros, sem ponto flutuante). `GET /api/v1/financial-summaries?from=<1º dia do mês seguinte>&to=<último dia do mês seguinte>` dá a previsão do mês seguinte (`totals.income.forecast`, `totals.expense.forecast` e `totals.surplus.forecast`), que inclui as previsões das recorrentes (PD-51, DEC-003). `GET /api/v1/transactions?kind=expense&settled=false&from=<1º dia do mês seguinte>&to=<último dia do mês seguinte>&limit=5` dá até 5 contas do mês seguinte, com as previsões virtuais, e o cursor diz se há mais.
   - `useLastJournalEntry`: `GET /api/v1/journal-entries?limit=1` (a mais recente), com a data e hora, o texto e as emoções.
   - `useReadingNow`: `GET /api/v1/books?reading_status=reading&limit=3`, com o título e o `progress_percent` (PD-35).
   - Testes `asks for today tasks with the overdue ones in the user timezone`, `counts the tasks of the day including the completed ones`, `completes a task optimistically and removes it from the block`, `sends today as the occurrence date of a daily task`, `brings the task back and warns when the completion is refused`, `groups today reminders into morning, afternoon and night`, `joins upcoming transactions and reminders of the next seven days up to five`, `links forecast items to their recurrence`, `reads the money block from the financial summary` (pede o mês atual e o seguinte, com as datas no fuso do usuário, e não soma saldos no cliente), `asks for the next month bills with the recurring forecasts` e `does not fetch hidden blocks`.
7. Escreva `components/components.test.tsx` e depois os componentes:
   - `calm-message.tsx` (PD-16): `<p>` em itálico (`font-style: italic`), cor `--text-muted`, sem fundo nem borda, usado em todas as mensagens de estado dos blocos (vazio e "Tudo feito por hoje.").
   - `dashboard-block.tsx` (PD-15, PD-16): `<section aria-labelledby>` com o cartão de `@atria/ui`, título em `h2` e, nos blocos `sensitive`, o `IconButton` do olho à direita do título, com `aria-pressed` (escondido), o nome "Esconder as informações de {bloco}" ou "Mostrar as informações de {bloco}" e o ícone de olho ou de olho riscado (SVG com `aria-hidden="true"`); estado carregando (esqueleto de `@atria/ui` com `aria-busy="true"`), vazio com a `calm-message` do bloco e erro com o botão "Tentar de novo" que chama `refetch`. Sem botão "Ocultar" (PD-30).
   - `greeting-card.tsx` (PD-26): cartão `aria-label="Saudação"` com "Bom dia" (antes de 12 h), "Boa tarde" (12 h a 18 h) ou "Boa noite" (18 h em diante), pela hora no fuso do usuário e o relógio injetável, seguido de ", {primeiro nome}" (primeira palavra do `name` de `GET /me`, omitida sem nome); a data longa por `Intl` (`weekday: 'long', day: 'numeric', month: 'long'`); e, à direita, "Como foi o seu dia?" com o botão primário "Escrever no diário" para `/journal/new` (uma coluna abaixo de 480 px).
   - `complete-task-button.tsx` (PD-04, PD-33): `Button` de `@atria/ui` na variação `success`, só com o ícone de check (SVG com `aria-hidden="true"`), área mínima de 36 px, `aria-label` e `title` "Concluir: {título}" na pontual e "Concluir hoje: {título}" na ocorrência de hoje da recorrente.
   - Testes `greets by the time of day with the first name and the long date`, `opens a new journal entry from the greeting`, `names the complete button with the action and the title`, `uses the success variant with only the check icon`, `toggles the eye of a sensitive block with aria-pressed`, `has no hide button on the blocks` e `shows state messages in italic muted text without background`.
8. Escreva `screens/dashboard-screen.test.tsx` e depois `dashboard-screen.tsx`:
   - Cabeçalho: `PageHeader` com eyebrow "Visão geral", título "Dashboard" (`page-heading`) e o subtítulo; logo abaixo, o `greeting-card` na largura toda (PD-26).
   - Zonas (PD-25): grade `grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr)` com o espaço do tema, cada zona uma pilha (`flex-direction: column`) de cartões, com os blocos visíveis da zona na ordem de `DASHBOARD_BLOCKS`; as zonas se esticam até a mesma altura e o último cartão de cada uma cresce (`flex: 1`), para as colunas terminarem juntas; abaixo de 960 px, uma coluna, com a principal primeiro. Zona sem blocos visíveis não aparece; a outra ocupa a largura toda.
   - "Tarefas de hoje" (PD-28, PD-33, PD-34, PD-04): até `DASH_TODAY_LIMIT` itens de `useTodayTasks`, cada um com o título como link para `/tasks/<task_id>`, a data "Era para {data}" nas vencidas (texto neutro, sem vermelho) e o `complete-task-button`, que conclui e tira o item do bloco; com itens, "Ver todas ({total_today} tarefas hoje)" para `/tasks`; sem itens e com `total_today` maior que zero, "Tudo feito por hoje. Aproveite o resto do dia." com o mesmo link; sem nenhuma, "Nenhuma tarefa para hoje. Aproveite.".
   - "Lembretes de hoje" (PD-27, PD-34): bloco separado das tarefas, sem botão de concluir; até `DASH_TODAY_LIMIT` lembretes, agrupados sob os títulos `h3` "Manhã", "Tarde" e "Noite" (só os grupos com itens), cada um com a hora por `Intl` em 24 h e o título como link; "Ver todos ({n} lembretes hoje)" para `/reminders`; vazio "Nenhum lembrete para hoje.".
   - "Próximos dias" (PD-27, PD-51): até `DASH_LIMIT` itens de `useUpcomingDays`, agrupados sob a data por `Intl`, com as movimentações (valor por `Intl`, sem destaque) e os lembretes no mesmo formato de linha; "Ver os próximos 30 dias" para `/finance/expenses?period=next_30_days`; vazio "Semana tranquila: nada previsto nos próximos 7 dias.".
   - "Diário" (PD-15, PD-27): a data e a hora da última entrada por `Intl`, a primeira linha do texto até 160 caracteres, as emoções em chips e "Abrir entrada" para `/journal/<id>`; escondido pelo olho, a data e "Entrada oculta. Use o olho para mostrar." no lugar do texto e das emoções, com o mesmo link; vazio "Nenhuma entrada ainda." com "Escrever a primeira" para `/journal/new`.
   - "Dinheiro" (PD-29, PD-15): o saldo total em tamanho normal (não em destaque), a linha "Até o fim do mês: entradas {valor} · saídas {valor}" ou "Nada mais previsto para este mês." quando as duas são zero, a seção "Previsão de {mês seguinte por extenso}" com Entradas, Contas e Sobra e até 5 contas com data e valor (ou "Nenhuma conta prevista ainda."), "Ver todas as contas de {mês}" para `/finance/expenses?period=custom&from=<1º dia>&to=<último dia>` quando há mais, e o "Saldo por conta" recolhido num `<details>`, cada conta com link para `/finance/accounts/<id>`. Escondido pelo olho, cada valor vira o símbolo da moeda seguido de "•••••" (o símbolo por `Intl.NumberFormat(...).formatToParts`), sem mudar a estrutura do bloco.
   - "Leituras": até 3 livros em leitura, cada um com o título como link para `/library/books/<id>` e a barra de progresso (`role="progressbar"`, `aria-valuenow` e `aria-label` "Progresso de {título}") com o percentual em texto; vazio "Nenhuma leitura em andamento.".
   - Todos os blocos ocultos em Configurações: no lugar das zonas, o estado vazio "Todos os blocos estão ocultos" com "Escolha os blocos em Configurações › Dashboard." e o link para `/settings/dashboard` (PD-30).
   - Valores em moeda, datas e horas com `Intl` no locale e no fuso do usuário. Pendências e atrasos usam tokens neutros, nunca vermelho ([project/frontend-14]).
   - Testes `shows the greeting and the two zones with the blocks in order`, `keeps the zones in one column below 960 px with the main zone first`, `grows the last card of each zone so the columns end together`, `shows at most three tasks and three reminders`, `shows all done for today with the count of the day`, `shows tasks and reminders in separate blocks`, `completes a task from the dashboard with the check button`, `shows the money block with the month left and the next month forecast`, `masks the money values and the journal text with the eye and keeps it after reload`, `shows each block empty, loading and error on its own`, `keeps a block hidden in settings hidden after reload`, `shows the all hidden state with the link to the dashboard settings`, `navigates every block and control by keyboard` e `has no axe violations`.
9. Crie `apps/web/src/features/dashboard/nav.ts` exportando `dashboardNav` com `path: '/'`, `label_key: 'dashboard.nav.title'` e o ícone SVG, no formato de item de navegação de `apps/web/src/shared`.
10. Crie `apps/web/src/features/dashboard/routes.tsx` exportando `createDashboardRoutes(parent: AnyRoute)` com a rota `/`. Não altere `apps/web/src/app`.
11. Crie `apps/web/src/features/dashboard/dashboard.e2e.ts` com `dashboard shows data from every module`, `block hidden in the dashboard settings stays hidden after reload`, `completing a task removes it from today` e `eye hides the money values after reload`, em 360 px e desktop, com axe. Não rode: os e2e rodam na TASK-35.
12. Rode o bloco de "Verificação" e corrija até passar sem warnings.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# Testes de componente e de hook da feature (Vitest + Testing Library + axe)
pnpm --filter @atria/web test -- src/features/dashboard
# Tipos e lint sem nenhum erro ou warning
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
# e2e escrito (roda na TASK-35)
test -s apps/web/src/features/dashboard/dashboard.e2e.ts
# Nenhuma cor literal fora dos tokens do tema
! grep -rnE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(' apps/web/src/features/dashboard --include=*.tsx --include=*.ts --include=*.css
# Sem painel de blocos nem botão de ocultar no dashboard (PD-30)
! test -e apps/web/src/features/dashboard/components/block-visibility-panel.tsx
! grep -rnE 'hide\(|Personalizar|Ocultar' apps/web/src/features/dashboard --include=*.tsx --include=*.ts --include=*.json
# Mesma chave dos blocos ocultos que Configurações grava (TASK-33)
grep -q 'atria.dashboard.hidden_blocks' apps/web/src/features/dashboard/hooks/use-hidden-blocks.ts
```

### Evidências

- `dashboard-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/dashboard --reporter=verbose`
  - Prova: a saudação, as duas zonas, os blocos com os limites, as tarefas de hoje com as vencidas e a conclusão pelo check, os lembretes por período do dia, os próximos dias, o bloco Dinheiro lido do resumo do Financeiro, o olho dos blocos sensíveis, as mensagens calmas, os estados de cada bloco e o bloco oculto em Configurações, com axe sem violações (RF-22, RF-23, CT-16, RNF-06, PD-04, PD-15, PD-16, PD-25 a PD-30, PD-33, PD-34, PD-51).
  - Trecho: as linhas `✓` de `shows the greeting and the two zones with the blocks in order`, `grows the last card of each zone so the columns end together`, `shows at most three tasks and three reminders`, `shows all done for today with the count of the day`, `completes a task from the dashboard with the check button`, `groups today reminders into morning, afternoon and night`, `reads the money block from the financial summary`, `masks the money values and the journal text with the eye and keeps it after reload`, `keeps a block hidden in settings hidden after reload`, `has no hide button on the blocks`, `shows state messages in italic muted text without background`, `shows each block empty, loading and error on its own` e `has no axe violations`, e o resumo sem falhas.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `dashboard-e2e-specs.txt` (automática): `grep -n "test(" apps/web/src/features/dashboard/dashboard.e2e.ts`
  - Prova: os fluxos ponta a ponta de CT-16, da conclusão de tarefa e do olho estão escritos para a TASK-35.
  - Trecho: as linhas com `dashboard shows data from every module`, `block hidden in the dashboard settings stays hidden after reload`, `completing a task removes it from today` e `eye hides the money values after reload`.
  - Falha: `No such file or directory` ou saída vazia.
- `dashboard-telas.png` (manual): prints do Dashboard com dados (saudação, as duas zonas terminando juntas, "Tarefas de hoje" com uma vencida e o check, "Lembretes de hoje" em Manhã, Tarde e Noite, "Próximos dias" com uma previsão de recorrente, o Diário e o Dinheiro com a previsão do mês seguinte), com "Tudo feito por hoje.", com o Dinheiro e o Diário escondidos pelo olho, com um bloco oculto em Configurações, com todos os blocos ocultos e com um bloco em cada estado (vazio, carregando e erro), nos temas claro e escuro, em 360 px, em menos de 960 px e em desktop, mais um print com o foco visível pelo teclado no check de uma tarefa. Capture com `pnpm --filter @atria/web dev`, montando localmente as rotas de `createDashboardRoutes` sem salvar mudança em `apps/web/src/app`.
  - Prova: identidade visual, tom calmo, os dois temas, as larguras, os estados de cada bloco, o olho e o foco por teclado (RNF-06, RNF-08, RNF-10, PD-15, PD-16, PD-25).
  - Trecho: as duas zonas lado a lado no desktop e numa coluna abaixo de 960 px, as mensagens em itálico sem fundo, "•••••" no lugar dos valores, nenhum vermelho em pendências e o anel de foco visível.
  - Falha: rolagem horizontal em 360 px, buraco embaixo de uma das zonas, contador de urgência ou vermelho em pendência, mensagem com fundo colorido, bloco sem estado ou foco invisível.

### Concluída quando

- [ ] O Dashboard abre com a saudação pela hora do dia, o primeiro nome, a data longa e "Escrever no diário", e mostra as duas zonas: na principal, "Tarefas de hoje", "Lembretes de hoje" e "Próximos dias"; na lateral, Diário, Dinheiro e Leituras; numa coluna abaixo de 960 px, com as colunas terminando juntas (RF-22, CT-16, PD-25, PD-26, PD-27).

  > Como comprovar: em `dashboard-tests.txt`, ver aprovados `greets by the time of day with the first name and the long date`, `opens a new journal entry from the greeting`, `shows the greeting and the two zones with the blocks in order`, `keeps the zones in one column below 960 px with the main zone first` e `grows the last card of each zone so the columns end together`.

- [ ] "Tarefas de hoje" mostra até 3, com as pontuais vencidas, conclui pelo botão só com o check, tira a concluída do bloco, mostra "Tudo feito por hoje. Aproveite o resto do dia." e "Ver todas ({n} tarefas hoje)"; os lembretes ficam num bloco separado, até 3, em Manhã, Tarde e Noite (PD-04, PD-27, PD-28, PD-33, PD-34).

  > Como comprovar: em `dashboard-tests.txt`, ver aprovados `asks for today tasks with the overdue ones in the user timezone`, `counts the tasks of the day including the completed ones`, `completes a task optimistically and removes it from the block`, `sends today as the occurrence date of a daily task`, `brings the task back and warns when the completion is refused`, `shows at most three tasks and three reminders`, `shows all done for today with the count of the day`, `shows tasks and reminders in separate blocks`, `names the complete button with the action and the title` e `groups today reminders into morning, afternoon and night`.

- [ ] "Próximos dias" junta movimentações e lembretes dos próximos 7 dias, até 5, com as previsões das recorrentes, e o bloco Dinheiro mostra o saldo total, o que falta no mês, a previsão do mês seguinte com até 5 contas e o saldo por conta recolhido, lidos do resumo do Financeiro (PD-27, PD-29, PD-51).

  > Como comprovar: em `dashboard-tests.txt`, ver aprovados `joins upcoming transactions and reminders of the next seven days up to five`, `links forecast items to their recurrence`, `reads the money block from the financial summary`, `asks for the next month bills with the recurring forecasts` e `shows the money block with the month left and the next month forecast`.

- [ ] O olho do Diário e do Dinheiro troca o texto e os valores por "•••••" e a escolha continua depois de recarregar (PD-15).

  > Como comprovar: em `dashboard-tests.txt`, ver aprovados `masks a sensitive block and remembers it after remount`, `toggles the eye of a sensitive block with aria-pressed` e `masks the money values and the journal text with the eye and keeps it after reload`.

- [ ] Os blocos não têm "Ocultar": o dashboard só lê os blocos ocultos em Configurações › Dashboard, o oculto continua oculto depois de recarregar e, com todos ocultos, a tela leva às Configurações (RF-23, CT-16, PD-30).

  > Como comprovar: em `dashboard-tests.txt`, ver aprovados `reads the hidden blocks saved by the dashboard settings`, `keeps a block hidden in settings hidden after reload`, `has no hide button on the blocks` e `shows the all hidden state with the link to the dashboard settings`; a Verificação não acha `block-visibility-panel.tsx` nem "Ocultar" e acha a chave `atria.dashboard.hidden_blocks`.

- [ ] Cada bloco tem os próprios estados vazio com mensagem calma em itálico, carregando e erro com "Tentar de novo", e bloco oculto não busca dados (RF-22, PD-16).

  > Como comprovar: em `dashboard-tests.txt`, ver aprovados `shows each block empty, loading and error on its own`, `shows state messages in italic muted text without background` e `does not fetch hidden blocks`.

- [ ] A tela navega por teclado com foco visível e não tem violações no axe (RNF-06).

  > Como comprovar: em `dashboard-tests.txt`, ver aprovados `navigates every block and control by keyboard` e `has no axe violations`.

- [ ] A tela funciona em 360 px e desktop, nos dois temas, em tom calmo e só com tokens do tema (RNF-08, RNF-10).

  > Como comprovar: abrir os prints de `dashboard-telas.png` e ver as zonas legíveis nas larguras e temas, sem vermelho em pendências; o comando de cor literal da Verificação não encontra nada.

- [ ] Typecheck e lint passam sem warning, e o e2e da feature está escrito para a TASK-35.

  > Como comprovar: rodar o bloco de "Verificação" e ver que termina sem erro; `dashboard-e2e-specs.txt` lista os quatro fluxos.

## Descrição

### Resumo executivo

Entrega o Dashboard geral, a primeira tela depois do login, como no protótipo: uma saudação que convida a escrever no diário e duas zonas, com o que é de hoje (tarefas, lembretes e os próximos dias) na principal e os resumos do diário, do dinheiro e das leituras na lateral.
Poucos itens por bloco, mensagens calmas e um olho que esconde os valores e o texto do diário para usar o app em público; os blocos visíveis são escolhidos em Configurações.
Perfil padrão, risco baixo: só lê dados que os outros módulos já oferecem e conclui tarefas pelo contrato existente.
Depende da base do frontend e dos contratos do servidor; destrava a integração final do frontend.

### Detalhes técnicos

**Abordagem.** Feature isolada em `apps/web/src/features/dashboard`, sem contexto próprio no servidor (decisão 59): cada bloco é uma consulta do TanStack Query aos endpoints dos outros contextos. Blocos são componentes sem regra de negócio; o cálculo das datas, do agrupamento e dos limites fica nos hooks. A feature exporta `createDashboardRoutes` e `dashboardNav`.

**Divergências com a spec planejada.** A spec SPEC-001 está `planned` e não muda. Por decisão do usuário, a tela segue as decisões do protótipo (DEC-002): duas zonas no lugar da grade de blocos de peso igual (PD-25), saudação (PD-26), blocos e limites novos (PD-27, PD-28, PD-34), a escolha dos blocos em Configurações no lugar do menu no próprio dashboard (PD-30), o olho dos dados sensíveis (PD-15), as mensagens calmas (PD-16) e a conclusão de tarefa pelo check (PD-04, PD-33).

**Componentes.** Tela `/` com `PageHeader`, `greeting-card` e seis blocos (`today`, `reminders` e `upcoming` na zona principal; `journal`, `balance` e `reading` na lateral), cartão comum de bloco com o olho e os três estados, `calm-message` e `complete-task-button`.

**Decisões.**
- *Zonas (PD-25):* duas pilhas de cartões (cerca de 2/3 e 1/3), que se esticam até a mesma altura, com o último cartão de cada uma crescendo. Descartada a grade automática de peso igual, que deixava buracos e não dizia o que importa (`docs/estudos/dashboard.md`).
- *Blocos ocultos (RF-23, PD-30):* o dashboard só lê a chave `atria.dashboard.hidden_blocks.<userId>`, que Configurações › Dashboard (TASK-33) grava, com os mesmos ids. Descartados o botão "Ocultar" e o painel "Personalizar" no próprio dashboard, que a PD-30 tirou. A leitura também reage ao evento `storage`, para outra aba. Descartado guardar nas preferências do servidor, porque o contrato de preferências (RF-58) não tem esse campo.
- *Olho (PD-15):* só nos blocos sensíveis (Diário e Dinheiro), na chave `atria.dashboard.masked_blocks.<userId>`, valendo até trocar de novo. Descartado guardar no servidor pelo mesmo motivo. O Diário mostra a primeira linha do texto, como no protótipo, e o olho o esconde; a versão anterior desta tarefa nunca mostrava o texto, o que a PD-15 substitui pela escolha da pessoa.
- *Tarefas de hoje (PD-28, PD-33, PD-04):* `GET /tasks/occurrences` do dia mais as pontuais vencidas de `GET /tasks?status=open&due_to=<ontem>`; a conclusão é otimista, pelo `POST /tasks/{id}/completion` da TASK-09, e o item some do bloco. O botão de concluir é da própria feature, sobre o `Button` `success` de `@atria/ui`, porque o `CompleteButton` da TASK-24 está na mesma onda e as features não dividem arquivos. Descartado reabrir pelo dashboard: a concluída some do bloco, e o "Reabrir hoje" fica na listagem e no detalhe.
- *Tarefas e lembretes separados (PD-34):* blocos diferentes, sem botão de concluir no lembrete, para não confundir o que se conclui com o que só avisa. Descartada a linha do tempo única do estudo.
- *Próximos dias (PD-27, PD-51):* movimentações (com as ocorrências virtuais das recorrentes, que levam à página da recorrente da TASK-22) e lembretes dos próximos 7 dias, até 5 itens. Descartado pedir só as gravadas, que deixaria de fora as contas fixas.
- *Bloco Dinheiro (PD-29):* lido de `GET /financial-summaries` (TASK-07), com o mês atual e o seguinte. Descartado somar o saldo das contas no cliente, porque o servidor já soma e calcula a previsão das recorrentes (RN-01, PD-51).
- *Leituras:* só livros em leitura (`GET /books?reading_status=reading`, PD-35), até 3, com o progresso. O protótipo completa com artigos, mas o contrato da TASK-13 não tem filtro de leitura nos artigos.
- *Metas (PD-31):* fora, enquanto a PD-31 estiver em aberto.
- Cada bloco carrega e falha sozinho; bloco oculto não busca dados (`enabled: false`). "Hoje" e a hora da saudação no fuso do usuário com o relógio injetável ([project/testing-07]).

**Riscos.** Os nomes dos campos de `/tasks/occurrences` (inclusive o título da tarefa), de `/journal-entries` e de `/books` precisam ser conferidos em `@atria/contracts` (TASK-09, TASK-12 e TASK-13). O bloco Dinheiro faz três consultas e "Próximos dias" faz duas; cada bloco carrega junto e mostra um só estado de carregando e de erro. A chave dos blocos ocultos é um contrato com a TASK-33: um id diferente faria o bloco não sumir.

**Referências.** RF-22, RF-23; CT-16; RNF-05, RNF-06, RNF-08, RNF-10; decisões 21 e 59 da spec; DEC-002, DEC-003 e DEC-004; PD-04, PD-15, PD-16, PD-25 a PD-30, PD-33, PD-34, PD-35 e PD-51; [project/frontend-14], [project/frontend-16].

**Arquivos em comum na onda 7.** Nenhum: cada feature só cria arquivos na própria pasta. A chave `atria.dashboard.hidden_blocks.<userId>` é lida aqui e gravada pela TASK-33.

### Card

- **Título:** Dashboard
- **Tipo:** historia
- **Descrição:** Dashboard geral como no protótipo: saudação com o convite ao diário e duas zonas, com tarefas, lembretes e próximos dias na principal e diário, dinheiro e leituras na lateral, poucos itens por bloco, olho nos dados sensíveis e blocos escolhidos em Configurações.
- **Critérios de aceite:**
  - [ ] Saudação e duas zonas com os seis blocos, numa coluna abaixo de 960 px.
  - [ ] Tarefas de hoje (com as vencidas) e lembretes em blocos separados, até 3 cada, com a conclusão pelo check e "Tudo feito por hoje.".
  - [ ] Próximos dias e o bloco Dinheiro com a previsão do mês seguinte e as contas fixas previstas.
  - [ ] O olho esconde os valores do Dinheiro e o texto do Diário, e a escolha é lembrada.
  - [ ] Sem "Ocultar" nos blocos: o bloco oculto em Configurações continua oculto depois de recarregar.
  - [ ] Cada bloco tem estados vazio (com mensagem calma), carregando e erro.
  - [ ] Tela acessível por teclado, sem violações no axe, em 360 px e desktop, nos dois temas.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md (PD-29, PD-51), DEC-002 a DEC-004, TASK-07 e as rotas da TASK-22; bloco Dinheiro lido de /financial-summaries do mês atual e do seguinte, com saldo total, o que falta no mês, a previsão do mês seguinte com até 5 contas e o saldo por conta recolhido, no lugar da soma dos saldos no cliente (PD-29); próximas movimentações com as ocorrências virtuais das recorrentes, que levam à recorrente (PD-51, DEC-003); testes, Concluída quando, Evidências, Detalhes técnicos e card atualizados |
| 2 | 2026-10-30 | agente | Ler com as PDs do dashboard, o estudo, TASK-05, TASK-09, TASK-10, TASK-12, TASK-13 e TASK-33; duas zonas em pilhas que terminam juntas, uma coluna abaixo de 960 px (PD-25); saudação com primeiro nome, data longa e Escrever no diário (PD-26); blocos today, reminders e upcoming na principal e journal, balance e reading na lateral, com os ids da TASK-33, tarefas e lembretes até 3 e próximos dias até 5 (PD-27); tarefas de hoje com as vencidas, concluída some, Tudo feito por hoje e Ver todas com o total do dia (PD-28); sem Ocultar nem painel Personalizar, o dashboard só lê os blocos ocultos de Configurações, com o estado de todos ocultos (PD-30); concluir pelo botão success só com o check e Concluir hoje na diária (PD-04, PD-33); tarefas e lembretes em blocos separados, lembretes em Manhã, Tarde e Noite (PD-34); olho no Diário e no Dinheiro, gravado no navegador (PD-15); mensagens calmas em itálico sem fundo (PD-16); bloco Metas fora pela PD-31 em aberto; linha de Baseline que citava a pasta criada pela tarefa removida; testes, Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
