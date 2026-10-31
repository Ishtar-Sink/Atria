---
id: TASK-27
spec: SPEC-001
title: "Telas do Diário"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-44, RF-45, RF-46, CT-27]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: 08f2c85921943623723d5ec01c5bcaf3faa2112619bf1cf75f291ced7aad92c3
adjustments: 5
adjusted_at: 2026-10-31T11:42:47Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 58bdf3d8de66e1383d65b95a20a97f9defe4cc1ca7313ca82e5867787557be91
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T11:42:47Z
model: sonnet
---

# TASK-27: Telas do Diário

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-44 a RF-46, CT-27, RN-13, RNF-03, RNF-06, RNF-08 a RNF-10 e decisões 6, 13 e 28.
- `vostok/rules/project/frontend.md`: layout, estados de listagem, filtros na URL, tom calmo, `Intl` e Optimistic UI.
- `vostok/rules/project/architecture.md`: [project/architecture-07] e [project/architecture-10] (criar e editar em rota própria).
- `vostok/rules/project/code-style.md`: componentes sem regra de negócio, só tokens do tema.
- `vostok/rules/project/testing.md`: Vitest, Testing Library, axe e testes determinísticos.
- `vostok/rules/project/language.md`: textos em arquivo de tradução.
- `vostok/rules/project/naming-convention.md`: arquivos em `kebab-case`, chaves de objetos em `snake_case`.
- `vostok/rules/project/security.md`: [project/security-15] (conteúdo do diário sanitizado ao renderizar).
- `prototype/atria-prototype.html`: telas do Diário validadas no protótipo (referência de layout e interação); pelas decisões do protótipo, o seletor de emoções do formulário (`f.t === 'emotions'`: `.emo-grid`, `.emo`, `.emo-chip` e `.emo-int`, a intensidade de 1 a 5 em pontos liberada ao marcar), o campo de data e hora (`f.t === 'datetime-local'`: `.dt-field`, `data-dt-time`), o template `#entity-detail` com "Voltar", "Editar" e "Mais ações", a visão geral da entrada em `overviewHTML` (`k === 'journal'`: cartões "Entrada", "Emoções" e "Registro") e a grade `.screen-form .form`, com `fieldset[data-field="emotions"]` na linha inteira; para o botão "Relatórios" do módulo, a constante `REPORTS` (relatório `journal-emo`, módulo `journal`, filtros de período e de emoção) e `repsOf`.
- `docs/decisoes-do-prototipo.md`: linhas PD-11, PD-14, PD-19, PD-55, PD-57, PD-59, PD-61 e PD-62 e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa; PD-11 não se aplica: entradas do diário não têm etiquetas.
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004`: DEC-002 (as decisões do protótipo valem já, também nas telas); DEC-003 e DEC-004 não mudam o contexto journal.
- `vostok/work/tasks/SPEC-001/TASK-05.md`: componentes da base: `PageHeader` com "Voltar" e ações, `MenuButton`, `SelectField`, `SegmentedField`, `DateTimeField` (data no calendário próprio e hora em 24 h, valor `YYYY-MM-DDTHH:mm`), `PeriodField` e `resolvePeriod` de `packages/ui/src/period-field/` (seletor de período com os presets configuráveis e o intervalo personalizado no calendário, PD-55, PD-57, PD-61), `FormGrid`, `FormActions` e as ligações `FormSegmented` e `FormDateTime` de `apps/web/src/shared/forms/form-fields.tsx`.
- `vostok/work/tasks/SPEC-001/TASK-17.md`: o relatório `journal-emo`, do módulo `journal`, com os filtros de período e de emoção.
- `vostok/work/tasks/SPEC-001/TASK-12.md`: passo 10, `CreateJournalEntryRequest` (`occurred_at`, `text`, `emotions: [{ emotion_id, intensity? }]`, `visibility?`), `JournalEntryListQuery` (`from`, `to`, `emotion_id`) e a intensidade de 1 a 5, opcional.
- `apps/web/src/app`: só leitura, para ver o layout, o roteador raiz e como a TASK-35 registra `routes.tsx` e `nav.ts`.
- `apps/web/src/shared`: cliente da API, mutação otimista, formatação com `Intl`, i18n comum e tipo do item de navegação.
- `packages/ui`: componentes genéricos (página, cabeçalho, lista, formulário, estados vazio, carregando e erro, diálogo de confirmação).
- `packages/theme`: tokens do tema claro e escuro.
- `packages/contracts`: tipos gerados de `/journal-entries` e `/emotions`.
- `apps/web/scripts/evidence-shots.mjs`: molde das evidências visuais automáticas (TASK-05): Vite numa porta livre, Chromium do `@playwright/test`, temas claro e escuro, 1440 e 360 px, `check()` com `ok`/`FALHA`, prancha por `sheet()` e código de saída 1 em falha.

### Mudar

- `apps/web/src/features/journal/routes.tsx` (criar): rotas `/journal`, `/journal/new`, `/journal/$entryId`, `/journal/$entryId/edit` e `/journal/emotions`, exportadas por `createJournalRoutes(parent_route)` para a TASK-35 registrar.
- `apps/web/src/features/journal/nav.ts` (criar): item "Diário" da sidebar, exportado como `journalNavItem`.
- `apps/web/src/features/journal/i18n/pt-br.json` (criar): textos da feature.
- `apps/web/src/features/journal/journal-list-page.tsx` (criar): lista de entradas agrupadas por dia, com filtros (período no `PeriodField`), busca, modos de visualização, estados e o botão "Relatórios" (PD-61).
- `apps/web/src/features/journal/journal-reports.ts` (criar): relatórios do módulo, com o caminho `/reports/journal-emo?from_module=journal` (PD-61).
- `apps/web/src/features/journal/journal-reports.test.ts` (criar): teste do caminho do relatório (PD-61).
- `apps/web/src/features/journal/journal-entry-page.tsx` (criar): tela da entrada com o cabeçalho, "Editar" e "Excluir" dentro de "Mais ações" (PD-14), a visão geral em cartões e as abas extras recebidas por `extra_tabs`.
- `apps/web/src/features/journal/journal-entry-overview.tsx` (criar): visão geral da entrada em cartões, com "Entrada" (texto sanitizado), "Emoções" e "Registro" (PD-59).
- `apps/web/src/features/journal/journal-entry-page.test.tsx` (criar): testes da tela da entrada (PD-14, PD-59).
- `apps/web/src/features/journal/journal-entry-form-page.tsx` (criar): criação e edição da entrada em rota própria (RF-44, RF-45).
- `apps/web/src/features/journal/emotion-picker.tsx` (criar): seleção de uma ou mais emoções em chips numa grade, com a intensidade de 1 a 5 em pontos liberada ao marcar, opcional (RF-45, PD-62).
- `apps/web/src/features/journal/emotions-page.tsx` (criar): edição da lista de emoções do usuário (RF-46).
- `apps/web/src/features/journal/use-journal-entries.ts` (criar): leitura da lista com filtros, busca e cursor vindos da URL.
- `apps/web/src/features/journal/use-journal-entry.ts` (criar): leitura de uma entrada.
- `apps/web/src/features/journal/use-journal-entry-mutations.ts` (criar): criar, editar e excluir entradas com Optimistic UI.
- `apps/web/src/features/journal/use-emotions.ts` (criar): leitura e mutações otimistas da lista de emoções.
- `apps/web/src/features/journal/journal-list-page.test.tsx` (criar): testes da lista.
- `apps/web/src/features/journal/journal-entry-form-page.test.tsx` (criar): testes do formulário.
- `apps/web/src/features/journal/emotion-picker.test.tsx` (criar): testes da seleção de emoções.
- `apps/web/src/features/journal/emotions-page.test.tsx` (criar): testes da lista de emoções.
- `apps/web/src/features/journal/use-journal-entry-mutations.test.tsx` (criar): testes da interface otimista.
- `apps/web/src/features/journal/journal.e2e.ts` (criar): fluxo ponta a ponta do CT-27, rodado só na TASK-35.
- `apps/web/src/features/journal/evidence/harness.tsx` (criar): página de evidência que monta `createJournalRoutes` num roteador em memória do TanStack Router, com os providers do app (tema, TanStack Query, i18n, preferências) e dentro do layout do app; não é importada pelo app nem por `apps/web/src/app` (nada muda em `apps/web/src/app`) e por isso fica fora do build de produção; só tokens do tema; passa no typecheck e no lint.
- `apps/web/scripts/evidence-journal.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-journal.mjs themes-widths|states-focus`), em Node sem dependências novas, no molde de `apps/web/scripts/evidence-shots.mjs` (código próprio, sem importar o da TASK-05): sobe o Vite numa porta livre por `createServer` da API do Vite com um plugin que serve uma página HTML virtual carregando o `harness.tsx` (encerra no fim, KNW-006), simula a API com `context.route('/api/**')` e fixtures em memória no próprio script (entradas, emoções, respostas lentas para o carregando, lista vazia e `problem+json` para o erro), captura nos temas claro e escuro, em 1440 px e em 360 px, confere o estado no DOM antes de cada captura (tema aplicado, sem rolagem horizontal, sem erro de JS, axe sem violações, inclusive `color-contrast`, e as verificações de cada estado) e imprime `ok` ou `FALHA` por verificação, o caminho do PNG e a última linha `ok  0 falha(s)`; sai com código diferente de 0 se algo falhar; as pranchas vão para `vostok/work/tasks/SPEC-001/evidence/TASK-27/`.

### Passos

1. Ler os arquivos de "Ler" e anotar os nomes exportados por `apps/web/src/shared` (cliente da API, hook de mutação otimista, formatadores `Intl`, i18n), `packages/ui` e `packages/contracts` (tipos de `/journal-entries` e `/emotions`). Usar sempre esses nomes; nenhum tipo da API é escrito à mão ([project/api-02]).
2. Criar `apps/web/src/features/journal/i18n/pt-br.json` com as chaves em `snake_case` sob `journal`: `nav`, `list.title`, `list.subtitle`, `list.empty_title`, `list.empty_text` (convite calmo para a primeira entrada), `list.loading`, `list.error`, `list.search_label`, `list.filter_emotion`, `list.filter_period`, `list.period_this_month`, `list.period_last_month`, `list.period_last_30_days`, `list.period_this_year`, `list.period_all` (e os demais rótulos que o `labels` do `PeriodField` pede), `list.reports`, `reports.journal_emo` ("Emoções no período"), `list.view_list`, `list.view_timeline`, `form.title_new`, `form.title_edit`, `form.date`, `form.time`, `form.text`, `form.emotions`, `form.intensity`, `form.intensity_none`, `form.save`, `form.saved_failed`, `form.text_required`, `entry.edit`, `entry.delete`, `entry.delete_confirm`, `emotions.title`, `emotions.subtitle`, `emotions.add`, `emotions.rename`, `emotions.remove`, `emotions.remove_confirm`, `emotions.empty_text`, `emotions.system.joy`, `emotions.system.sadness`, `emotions.system.anger`, `emotions.system.fear`, `emotions.system.anxiety`, `emotions.system.calm`, `emotions.system.gratitude` (nomes das emoções padrão) e `undo_notice` (aviso de que o servidor recusou e a mudança foi desfeita).
3. Escrever os testes antes do código, com o cliente da API simulado e o relógio fixo ([project/testing-07]):
   - `use-journal-entry-mutations.test.tsx`: `adds the entry to the list before the server answers`, `rolls back and shows the undo notice when the server rejects` (RNF-09).
   - `journal-entry-form-page.test.tsx`: `creates an entry with date, time, text and two emotions`, `allows a second entry on the same day`, `shows the validation error inside the form with role alert`, `edits an existing entry`, `has no axe violations`, `pd62 lays the form in the grid with text, emotions and visibility on the full row` (os três com `data-span="full"`, a visibilidade como `radiogroup`, nenhum `<select>`, `type="date"`, `type="time"` nem `type="datetime-local"` nativo, e "Cancelar" antes de "Salvar"), `pd57 picks the date in the custom calendar and types 2130 as 21:30` (envia `occurred_at` do dia escolhido às 21:30 no fuso do usuário) e `pd19 centers the header and the form in the form column`.
   - `emotion-picker.test.tsx`: `selects more than one emotion`, `shows default emotions translated by system key`, `shows the user name of a renamed default emotion`, `keeps intensity optional`, `is operable by keyboard only`, `does not use the danger color for any emotion`, `pd62 shows the emotions as chips in a grid` (cada emoção é um chip com o nome e o `aria-pressed`, ou a caixa de marcar do chip, dentro de um `fieldset` com a legenda "Emoções"), `pd62 enables the intensity from 1 to 5 only after the emotion is marked` (o `radiogroup` "Intensidade de <emoção>" tem cinco opções "1 de 5" a "5 de 5", desabilitadas com a emoção desmarcada; as setas mudam a intensidade; desmarcar a emoção tira a emoção e a intensidade do valor) e `pd62 sends the emotion without intensity when no dot is chosen`.
   - `journal-entry-page.test.tsx`: `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações` (nenhum botão "Excluir" fora do menu), `deletes the entry after confirmation from Mais ações`, `pd59 shows the overview in cards with Entrada, Emoções and Registro` (o cartão "Emoções" na lateral com "Ansiedade · 4/5", ou só o nome sem intensidade, e "Nenhuma." sem emoções; o "Registro" com Quando, Visibilidade, Criado em e Atualizado em) e `has no axe violations`.
   - `emotions-page.test.tsx`: `adds a new emotion that appears in the picker`, `renames and removes an emotion with confirmation`, `has no axe violations`.
   - `journal-list-page.test.tsx`: `groups entries by day with Intl date and time in the user timezone`, `exposes the Filtros, Busca and Visualização controls by accessible name`, `reads search, filters and view mode from the URL`, `shows the empty state with explanatory text`, `shows the loading state`, `shows the error state`, `renders entry text sanitized`, `has no axe violations`, `pd55 filters the period with the PeriodField and sends from and to` (o `PeriodField` lista só "Este mês", "Mês passado", "Últimos 30 dias", "Este ano" e "Qualquer período"; escolher "Mês passado" com o relógio fixo grava `?period=last_month` na URL e envia `from` e `to` do mês anterior; "Qualquer período" envia sem `from` e `to`) e `pd61 lists the journal report in the Relatórios menu` (abre o menu e vê "Emoções no período" com `href="/reports/journal-emo?from_module=journal"`).
   - `journal-reports.test.ts`: `builds the module report path` (PD-61).
4. Rodar `pnpm --filter @atria/web test -- src/features/journal` e confirmar que os testes falham por falta da implementação.
5. Implementar os hooks: `use-journal-entries.ts` (TanStack Query, chave com os parâmetros da URL, paginação por cursor), `use-journal-entry.ts`, `use-journal-entry-mutations.ts` (com o hook de mutação otimista de `apps/web/src/shared`: aplica na hora, desfaz e mostra `undo_notice` na recusa) e `use-emotions.ts` (lista e criar, renomear e remover, também otimistas). Toda regra fica nos hooks ([project/code-style-09]).
6. Criar em `use-emotions.ts` a função `emotionLabel(emotion, t)`: com `name` preenchido, devolve `name` (emoção criada ou padrão renomeada pela pessoa); com `name` nulo, devolve a tradução de `journal.emotions.system.<system_key>` (`joy`, `sadness`, `anger`, `fear`, `anxiety`, `calm`, `gratitude`, vindos do servidor pela TASK-12). Toda tela que mostra uma emoção (seletor, entrada, lista, filtro e tela de emoções) usa só essa função; renomear uma emoção padrão grava `name` e mantém o `system_key`.
7. Implementar `emotion-picker.tsx` como no protótipo (PD-62): `fieldset` com a legenda "Emoções" e a dica "Marque o que você sentiu e, se quiser, a intensidade, de 1 a 5."; as emoções em chips numa grade (`grid-template-columns: repeat(auto-fill, minmax(calc(var(--space) * 45), 1fr))`, 180 px); cada chip com o nome (`emotionLabel`) e o botão alternável com `aria-pressed` (ou a caixa de marcar do chip), borda `--border-strong` desmarcado e borda `--primary` com fundo `--primary-soft` marcado; ao lado do nome, a intensidade de 1 a 5 em pontos, um `radiogroup` "Intensidade de <emoção>" com cinco rádios visualmente escondidos ("1 de 5" a "5 de 5", pontos `--border-strong` e `--primary` até o escolhido), desabilitado e com opacidade reduzida enquanto a emoção não está marcada; nenhum ponto vem escolhido ao marcar, e sem ponto a emoção vai sem `intensity` (RF-45, intensidade opcional no contrato da TASK-12); desmarcar tira a emoção e a intensidade. Cores só de tokens, sem o token de perigo ([project/frontend-14]); animações com `--motion-*`.
8. Implementar `journal-entry-form-page.tsx` com `react-hook-form` e `zod` (texto obrigatório, data e hora preenchidas com o momento atual no fuso do usuário), erros no próprio formulário com `role="alert"`, com a base da TASK-05 (PD-19, PD-57, PD-62): o `PageHeader` com "Voltar" e o formulário numa coluna centralizada na largura do `FormGrid`; a data e hora num único `FormDateTime` (data no calendário próprio e hora em 24 h, que aceita "930", "9:30" ou "09:30"), convertido para `occurred_at` em RFC 3339 com o fuso do usuário; texto, emoções (`emotion-picker.tsx`) e visibilidade (`FormSegmented`, "Pessoal" e "Compartilhada") com `data-span="full"`; e o `FormActions` com "Cancelar" (`ghost`, volta à entrada na edição e à lista na criação) e "Salvar". Implementar `journal-entry-page.tsx` e `journal-entry-overview.tsx`: cabeçalho com "Voltar", eyebrow "Diário · Entrada", título (primeira linha do texto) e subtítulo (data e hora por `Intl`) e, nas ações (PD-14), "Editar" com o ícone de lápis e o `MenuButton` "⋯ Mais ações" (`aria-label="Mais ações"`) com "Excluir" em tom `danger`, que pede confirmação e volta à lista; a aba Visão geral seguida das abas recebidas pela propriedade `extra_tabs` (`{ id, label, render }[]`), para a TASK-35 montar Conexões sem esta feature importar outras; visão geral (PD-59) com o cartão "Entrada" na zona principal (texto renderizado pelo sanitizador de `apps/web/src/shared`; se ele não existir, como texto puro, sem HTML) e, na lateral, o cartão "Emoções" (chips "<emoção> · <n>/5", ou só o nome sem intensidade, ou "Nenhuma.") e o cartão "Registro" (Quando, Visibilidade, Criado em e Atualizado em, por `Intl`); uma coluna abaixo de 960 px.
9. Implementar `journal-reports.ts` (PD-61): `JOURNAL_REPORTS = [{ id: 'journal-emo', title_key: 'journal.reports.journal_emo' }]` (o único relatório do módulo `journal` no catálogo da TASK-17 e no `REPORTS` do protótipo) e `journalReportHref(id)` que devolve `/reports/<id>?from_module=journal`, no padrão dos relatórios emitidos pelos módulos. Implementar `journal-list-page.tsx` com cabeçalho (`page-heading` e subtítulo) com "Nova entrada" (primário) e "Relatórios", um `MenuButton` da TASK-05 com um item por relatório de `JOURNAL_REPORTS` ("Emoções no período", link para `/reports/journal-emo?from_module=journal`), como o botão "Relatórios" do módulo no protótipo (PD-61); busca, filtros por emoção (no `SelectField` da TASK-05, PD-62) e período no `PeriodField` de `@atria/ui` (PD-55, PD-57), com `placement="toolbar"`, `presets={['this_month', 'last_month', 'last_30_days', 'this_year', 'all']}` (sem "Próximos 30 dias": o diário só tem o que já passou), `allow_custom`, o `today` do relógio injetável e o `locale` do usuário, valor padrão `{ preset: 'all' }`; o valor vai para a URL (`?period=&from=&to=`, `from` e `to` só no personalizado) e o hook envia `from` e `to` resolvidos por `resolvePeriod` no fuso do usuário, ou nenhum dos dois em "Qualquer período"; modos lista e linha do tempo, tudo na URL ([project/frontend-13]), entradas agrupadas por dia com data e hora formatadas por `Intl`, e os estados vazio, carregando e erro. Os três controles da listagem têm os nomes acessíveis exatos "Filtros", "Busca" e "Visualização" (`aria-label` ou rótulo vindo das chaves `filters_label`, `search_label` e `view_label` da tradução), usados pelos e2e da TASK-35. Implementar `emotions-page.tsx` com o diálogo de confirmação de `packages/ui` para remover.
10. Criar `routes.tsx` com `createJournalRoutes(parent_route)` (sem modal: criar e editar têm rota própria) e `nav.ts` com `journalNavItem` (rótulo `journal.nav`, destino `/journal`, ícone SVG inline com `aria-hidden="true"`).
11. Criar `journal.e2e.ts` (Playwright) com o CT-27: duas entradas no mesmo dia com emoções e intensidade, criação de uma emoção nova e sua presença na lista, em 360 px e desktop, com axe. Não rodar: ele roda na TASK-35.
12. Rodar a Verificação até passar sem nenhum warning de lint.
13. Criar `apps/web/src/features/journal/evidence/harness.tsx` e `apps/web/scripts/evidence-journal.mjs` (veja "Mudar") e rodar `node apps/web/scripts/evidence-journal.mjs themes-widths` e `node apps/web/scripts/evidence-journal.mjs states-focus`. Corrigir o código da tarefa a cada linha `FALHA` e conferir as pranchas `journal-themes-widths.png` e `journal-states-focus.png` abrindo-as.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
pnpm --filter @atria/web test -- src/features/journal
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
test -f apps/web/src/features/journal/journal.e2e.ts
# Nenhum controle nativo que a base da TASK-05 substitui (PD-57, PD-62)
! grep -rnE '<select|type="(date|time|datetime-local)"' apps/web/src/features/journal --include=*.tsx
# Período pelo PeriodField da base (PD-55, PD-57)
grep -q 'PeriodField' apps/web/src/features/journal/journal-list-page.tsx
# Evidências visuais automáticas
test -f apps/web/src/features/journal/evidence/harness.tsx
test -f apps/web/scripts/evidence-journal.mjs
node --check apps/web/scripts/evidence-journal.mjs
```

### Evidências

- `journal-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/journal --reporter=verbose`
  - Prova: os testes de componente e de hook do Diário passam, cobrindo entradas, emoções, intensidade, estados, axe e interface otimista (RF-44, RF-45, RF-46, CT-27, RNF-06, RNF-09).
  - Trecho: os arquivos `journal-entry-form-page.test.tsx`, `emotion-picker.test.tsx`, `emotions-page.test.tsx`, `journal-list-page.test.tsx` e `use-journal-entry-mutations.test.tsx` marcados como aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `journal-pd-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/journal --reporter=verbose -t "pd[0-9]"`
  - Prova: as telas seguem as decisões do protótipo: emoções em chips com a intensidade de 1 a 5 liberada ao marcar, data no calendário próprio com a hora em 24 h, formulário na grade numa coluna centralizada, cabeçalho da entrada com "Excluir" no "Mais ações", visão geral em cartões, período no `PeriodField` e o relatório do módulo (DEC-002, PD-14, PD-19, PD-55, PD-57, PD-59, PD-61, PD-62).
  - Trecho: as linhas `✓` de `pd55 filters the period with the PeriodField and sends from and to`, `pd61 lists the journal report in the Relatórios menu`, `pd62 shows the emotions as chips in a grid`, `pd62 enables the intensity from 1 to 5 only after the emotion is marked`, `pd62 sends the emotion without intensity when no dot is chosen`, `pd62 lays the form in the grid with text, emotions and visibility on the full row`, `pd57 picks the date in the custom calendar and types 2130 as 21:30`, `pd19 centers the header and the form in the form column`, `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações` e `pd59 shows the overview in cards with Entrada, Emoções and Registro`.
  - Falha: `FAIL`, `×` em algum desses testes ou nenhum teste encontrado com o filtro.
- `journal-files.txt` (automática): `find apps/web/src/features/journal -type f | sort`
  - Prova: a feature tem rotas, item de menu, traduções, telas, hooks, testes e o e2e do CT-27.
  - Trecho: `routes.tsx`, `nav.ts`, `i18n/pt-br.json` e `journal.e2e.ts` na lista.
  - Falha: `No such file or directory` ou algum desses arquivos ausente.
- `journal-themes-widths.txt` (automática): `node apps/web/scripts/evidence-journal.mjs themes-widths`
  - Prova: identidade visual nos dois temas e layout funcional a partir de 360 px, medidos no DOM e fotografados: a lista com o `PeriodField` aberto e com o menu "Relatórios" aberto, o formulário com as emoções em chips, duas marcadas com a intensidade e o calendário da data aberto, e a tela da entrada com a visão geral em cartões e o "Mais ações" aberto (RNF-08, RNF-10).
  - Trecho: uma linha `ok` por verificação, como `ok ... tema claro aplicado`, `ok ... tema escuro aplicado`, `ok ... PeriodField aberto · 5 presets`, `ok ... menu Relatórios aberto · item "Emoções no período"`, `ok ... duas emoções marcadas com intensidade`, `ok ... calendário da data dentro da janela`, `ok ... cartões Entrada, Emoções e Registro`, `ok ... Mais ações aberto · item "Excluir"`, `ok ... nenhuma emoção com a cor de perigo`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclusive color-contrast)` em cada captura; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-27/journal-themes-widths.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (texto cortado, rolagem horizontal em 360 px, contraste baixo no tema escuro, emoção com a cor de perigo), a ausência da linha `png:`, código de saída diferente de 0 ou a prancha sem algum dos estados.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-27/journal-themes-widths.png`, a prancha com as capturas rotuladas da lista (PeriodField aberto e menu "Relatórios" aberto), do formulário (emoções em chips, duas marcadas com intensidade, calendário aberto) e da entrada (cartões e "Mais ações" aberto), nos temas claro e escuro, em 360 px e em 1440 px.
- `journal-states-focus.txt` (automática): `node apps/web/scripts/evidence-journal.mjs states-focus`
  - Prova: todos os estados da lista e o foco por teclado, com a API simulada (lista vazia, resposta lenta e `problem+json`) ([project/frontend-10], [project/frontend-12], RNF-06).
  - Trecho: `ok ... estado vazio · texto explicativo visível`, `ok ... estado carregando · indicador visível`, `ok ... estado de erro · mensagem visível`, `ok ... formulário navegado por Tab · contorno de foco visível (≥ 2 px)`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclusive color-contrast)`; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-27/journal-states-focus.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (estado sem texto, foco invisível ou controle que não recebe foco), a ausência da linha `png:`, código de saída diferente de 0 ou a prancha sem algum dos estados.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-27/journal-states-focus.png`, a prancha com a lista nos estados vazio, carregando e erro e o formulário com o anel de foco no controle ativo, nos temas claro e escuro, em 360 px e em 1440 px.

### Concluída quando

- [x] Dá para registrar várias entradas no mesmo dia, cada uma com data, hora e texto, em rota própria (RF-44, CT-27).

  > Como comprovar: na saída `journal-tests.txt`, ver aprovados os casos `creates an entry with date, time, text and two emotions` e `allows a second entry on the same day`.

- [x] Cada entrada aceita uma ou mais emoções, com intensidade opcional (RF-45, CT-27).

  > Como comprovar: na saída `journal-tests.txt`, ver aprovados `selects more than one emotion` e `keeps intensity optional`.

- [x] A lista de emoções do usuário pode ser editada, e uma emoção nova aparece na seleção (RF-46, CT-27).

  > Como comprovar: na saída `journal-tests.txt`, ver aprovado `adds a new emotion that appears in the picker`.

- [x] A lista tem busca, filtros e modos de visualização guardados na URL, e mostra os estados vazio, carregando e erro (RF-44).

  > Como comprovar: ver aprovados os casos da `journal-list-page.test.tsx`; em `journal-states-focus.txt`, ver `estado vazio`, `estado carregando` e `estado de erro` com `ok` e `ok  0 falha(s)`, e conferir os estados na prancha `journal-states-focus.png`.

- [x] As mudanças aparecem na hora e são desfeitas com aviso se o servidor recusar (RNF-09).

  > Como comprovar: ver aprovado `rolls back and shows the undo notice when the server rejects` na saída `journal-tests.txt`.

- [x] As telas não têm violações no axe e funcionam só pelo teclado, com foco visível (RNF-06).

  > Como comprovar: ver aprovados os casos `has no axe violations` e `is operable by keyboard only`; em `journal-states-focus.txt`, ver `contorno de foco visível` e `axe sem violações` com `ok` e `ok  0 falha(s)`, e o anel de foco na prancha `journal-states-focus.png`.

- [x] As telas funcionam nos temas claro e escuro, em 360 px e desktop, sem vermelho para emoções (RNF-08, RNF-10).

  > Como comprovar: em `journal-themes-widths.txt`, ver `tema claro aplicado`, `tema escuro aplicado`, `nenhuma emoção com a cor de perigo` e `sem rolagem horizontal` com `ok` e `ok  0 falha(s)`, e abrir a prancha `journal-themes-widths.png` para ver as capturas legíveis nos dois temas e nas duas larguras.

- [x] As emoções aparecem em chips numa grade, e marcar uma emoção libera a intensidade de 1 a 5 em pontos, que continua opcional (RF-45, PD-62).

  > Como comprovar: em `journal-pd-tests.txt`, ver aprovados `pd62 shows the emotions as chips in a grid`, `pd62 enables the intensity from 1 to 5 only after the emotion is marked` e `pd62 sends the emotion without intensity when no dot is chosen`.

- [x] O formulário usa a base da TASK-05: grade numa coluna centralizada, data no calendário próprio e hora em 24 h, visibilidade em grupo segmentado e as ações à direita (PD-19, PD-57, PD-62).

  > Como comprovar: em `journal-pd-tests.txt`, ver aprovados `pd62 lays the form in the grid with text, emotions and visibility on the full row`, `pd57 picks the date in the custom calendar and types 2130 as 21:30` e `pd19 centers the header and the form in the form column`; o último comando da Verificação não encontra controle nativo.

- [x] A tela da entrada tem "Editar" com lápis, "Excluir" em vermelho só dentro de "Mais ações" e a visão geral em cartões, com as emoções num cartão próprio na lateral (PD-14, PD-59).

  > Como comprovar: em `journal-pd-tests.txt`, ver aprovados `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações` e `pd59 shows the overview in cards with Entrada, Emoções and Registro`.

- [x] O filtro de período da lista usa o `PeriodField` da base, com os presets do diário e o intervalo personalizado, enviado como `from` e `to` (PD-55, PD-57).

  > Como comprovar: em `journal-pd-tests.txt`, ver aprovado `pd55 filters the period with the PeriodField and sends from and to`; a Verificação encontra `PeriodField` em `journal-list-page.tsx`.

- [x] O módulo emite o relatório "Emoções no período" pelo botão "Relatórios" do cabeçalho da lista (PD-61).

  > Como comprovar: em `journal-pd-tests.txt`, ver aprovado `pd61 lists the journal report in the Relatórios menu`; em `journal-tests.txt`, `builds the module report path`.

- [x] Testes, typecheck e lint passam sem warning, e o e2e do CT-27 está escrito para a TASK-35.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; o arquivo `journal.e2e.ts` aparece em `journal-files.txt`.

## Descrição

### Resumo executivo

Entrega as telas do Diário: escrever várias entradas por dia, marcar emoções com intensidade e manter a própria lista de emoções, num tom calmo.
É o espaço de registro dos sentimentos do MVP, com resposta imediata na tela e acessível por teclado.
Perfil padrão, risco baixo: as decisões de desenho já estão tomadas e o servidor do Diário já existe.
Libera a integração do frontend, que coloca o Diário no menu e roda o fluxo ponta a ponta.

### Detalhes técnicos

- **Abordagem:** feature React em `apps/web/src/features/journal`, com TanStack Router (rotas próprias para listar, ver, criar, editar e editar emoções), TanStack Query para os dados e `react-hook-form` com `zod` no formulário. Os dados e a lógica ficam em hooks; os componentes só exibem ([project/code-style-09]).
- **Componentes:** lista agrupada por dia, tela da entrada, formulário, seletor de emoções com intensidade e tela de emoções; usa `@atria/ui`, `@atria/theme`, `@atria/contracts` e o cliente da API, a mutação otimista e o `Intl` de `apps/web/src/shared` (TASK-05).
- **Decisões:** criação e edição em rota própria, sem modal ([project/architecture-10]); o modal fica só na confirmação de exclusão. Descartado: editar a entrada na própria lista, que contraria a regra. Emoções como botões alternáveis com `aria-pressed`, descartada a lista de seleção múltipla nativa, pior no celular e no teclado. Nenhuma emoção usa a cor de perigo, descartada a cor por valência, por [project/frontend-14]. A intensidade segue os limites do schema do contrato, sem escala própria no frontend. Seletor de emoções do protótipo (DEC-002, PD-62): chips em grade e a intensidade de 1 a 5 em pontos, liberada ao marcar; nenhum ponto vem escolhido, para a intensidade continuar opcional (RF-45, TASK-12); descartado o padrão 3 do protótipo, que tornaria a intensidade obrigatória na prática. Formulário com a base da TASK-05 (PD-19, PD-57, PD-62): `FormGrid`, `FormActions`, `FormDateTime` e `FormSegmented`; a nota da PD-57 de que data e hora continuariam nativas foi superada pela PD-62 e pelo `DateTimeField` da TASK-05, criado para lembretes e diário. Tela da entrada com "Editar" e "Mais ações" (PD-14) e visão geral em cartões, com as emoções num cartão próprio na lateral (PD-59); descartado o botão "Excluir" visível. Período da lista no `PeriodField` de `@atria/ui` (TASK-05), com os presets do diário (sem "Próximos 30 dias") e "Qualquer período" como padrão, para a lista abrir com todas as entradas (PD-55, PD-57). Relatórios pelo módulo (PD-61): o botão "Relatórios" da lista leva a `/reports/journal-emo?from_module=journal` (TASK-34, sobre o `journal-emo` da TASK-17), no padrão `/reports/<id>?from_module=<módulo>` das outras features; a entrada não emite relatório, porque o `journal-emo` não tem filtro de entrada (não está no `REP_ENTITY` do protótipo). Descartado: levar o período da lista para o relatório, que tem os próprios filtros.
- **Privacidade:** o texto vem descriptografado do servidor (TASK-12) e é renderizado sanitizado ([project/security-15]); nenhum texto vai para logs ou para o armazenamento do navegador.
- **Integração:** `routes.tsx` exporta `createJournalRoutes(parent_route)` e `nav.ts` exporta `journalNavItem`; a TASK-35 registra os dois e monta a aba Conexões na tela da entrada. A feature não altera `apps/web/src/app`.
- **Riscos:** fuso horário na data e hora da entrada (mitigado com `Intl` no fuso do usuário e relógio fixo nos testes); o e2e só roda na TASK-35.
- **Referências da spec:** RF-44, RF-45, RF-46, CT-27, RN-13, RNF-03, RNF-06, RNF-08, RNF-09, RNF-10, decisões 6, 13, 28 e 57; DEC-002; PD-14, PD-19, PD-55, PD-57, PD-59, PD-61 e PD-62 de `docs/decisoes-do-prototipo.md`.
- **Evidências visuais.** As pranchas `journal-themes-widths.png` e `journal-states-focus.png` são geradas por `apps/web/scripts/evidence-journal.mjs`, no molde do `evidence-shots.mjs` da TASK-05: cada evidência é um comando cuja saída (`.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG, e a prancha vai para a pasta de evidências da tarefa. Como as rotas da feature só são registradas no app pela TASK-35, o script sobe o Vite com uma página virtual que carrega `src/features/journal/evidence/harness.tsx`, que monta `createJournalRoutes` num roteador em memória com os providers e o layout do app, sem mudar `apps/web/src/app`; a API é simulada por `context.route('/api/**')` com fixtures no script, e cada captura passa pelo axe (inclusive `color-contrast`).
- **Arquivos em comum na onda 7:** nenhum.

### Card

- **Título:** Telas do Diário
- **Tipo:** historia
- **Descrição:** Telas do Diário para registrar várias entradas por dia, marcar emoções com intensidade opcional e editar a lista de emoções, com interface otimista e acessível.
- **Critérios de aceite:**
  - [ ] Várias entradas no mesmo dia, com data, hora, texto e emoções com intensidade opcional.
  - [ ] Lista de emoções editável, com a emoção nova disponível na hora.
  - [ ] Emoções em chips, com a intensidade de 1 a 5 em pontos liberada ao marcar.
  - [ ] Formulário na grade da base, com a data no calendário próprio, e a entrada com "Mais ações" e a visão geral em cartões.
  - [ ] Lista com busca, filtros (período no seletor de período da base) e visualização na URL e estados vazio, carregando e erro.
  - [ ] O botão "Relatórios" da lista abre "Emoções no período".
  - [ ] Interface otimista, sem violações no axe, nos dois temas e a partir de 360 px.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 4 | 2026-10-31 | ajuste | in_progress | Evidências manuais journal-themes-widths.png e journal-states-focus.png trocadas por automáticas journal-themes-widths.txt e journal-states-focus.txt geradas por apps/web/scripts/evidence-journal.mjs, com a prancha PNG como Artefato; harness da feature em src/features/journal/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 5 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
| 6 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 8 | 2026-10-31 | evidências | passed | 5 evidência(s) em evidence/TASK-27/ |
| 9 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004, TASK-05 (componentes) e TASK-12 (contrato); PD-62: seletor de emoções em chips numa grade com a intensidade de 1 a 5 em pontos liberada ao marcar, opcional, e testes pd62; PD-62, PD-57 e PD-19: FormGrid, FormActions, data e hora em FormDateTime, visibilidade em FormSegmented, coluna centralizada, filtro de emoção no SelectField e período no PeriodPicker; PD-14 e PD-59: tela da entrada com Editar, Mais ações com Excluir e visão geral em cartões Entrada, Emoções e Registro, com extra_tabs, journal-entry-overview.tsx e journal-entry-page.test.tsx; Verificação sem controles nativos; evidência journal-pd-tests.txt, Concluída quando, Detalhes técnicos e card atualizados; linha test -e da pasta da feature removida da Baseline, que a validação recusa |
| 2 | 2026-10-30 | agente | PeriodPicker trocado pelo PeriodField de @atria/ui no filtro de período da lista, com os presets do diário, padrão Qualquer período, from e to por resolvePeriod, teste pd55 e checagem na Verificação (PD-55, PD-57); botão Relatórios na lista com journal-emo, journal-reports.ts e testes pd61 e builds the module report path (PD-61); Ler, Mudar, i18n, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 3 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 4 | 2026-10-31 | agente | Evidências manuais journal-themes-widths.png e journal-states-focus.png trocadas por automáticas journal-themes-widths.txt e journal-states-focus.txt geradas por apps/web/scripts/evidence-journal.mjs, com a prancha PNG como Artefato; harness da feature em src/features/journal/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 5 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
