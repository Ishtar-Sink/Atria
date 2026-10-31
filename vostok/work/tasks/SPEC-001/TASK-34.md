---
id: TASK-34
spec: SPEC-001
title: "Telas de Relatórios"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-61, RF-62, RF-63, CT-33, CT-34]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: bf566d517b1abbe64c1ff5ca62cf2509e9aea2c4e000d4bec85c552f5e65aa19
adjustments: 4
adjusted_at: 2026-10-31T09:48:26Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 7d80a4c09c75babab7bc5f1b9470d772c937551a1c730186d8f9413a3b62878f
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T09:48:26Z
model: sonnet
---

# TASK-34: Telas de Relatórios

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-61, RF-62, RF-63, CT-33, CT-34, `/reports/{report}?from=&to=&format=html|pdf`, `/exports?format=json|csv`, fluxo principal (passo 11), RNF-02, RNF-06, RNF-08 a RNF-10 e decisões 14 e 43.
- `docs/decisoes-do-prototipo.md`: as linhas PD-55, PD-57 e PD-61 e a seção "Decisões resolvidas em 30/10 (DEC-002)": fonte das divergências com a spec, que valem sobre ela.
- `vostok/memory/decisions.md`: DEC-002 e DEC-004 (os nove relatórios, os filtros por entidade, o período só em cinco e o "Qualquer período" sem datas), consultadas com `vostok memory search decision DEC-002 DEC-004`.
- `vostok/work/tasks/SPEC-001/TASK-05.md`: passo 10 (`PeriodField` com `resolvePeriod`, `PeriodPreset` com `all`, `presets`, `allow_custom`, `placement: 'form'`, `labels` e `name`; `SelectField`; `PageHeader`; `Button`) e as ligações `FormSelect` e `FormPeriod` de `apps/web/src/shared/forms`.
- `vostok/work/tasks/SPEC-001/TASK-17.md`: passos 3 e 14 (ids, módulos e filtros do catálogo, `GET /reports`, `GET /reports/{report}` com `from` e `to` opcionais e independentes, o "Qualquer período" quando faltam, `any_period` e o `period` resolvido no modelo, os filtros `account_id`, `category_id`, `book_id`, `emotion_id`, `goal_id`, `project_id`, `type` e `goal_status`, `format` e o modelo em JSON sem `format`, e os erros `report_not_found`, `report_period_invalid` e `report_filter_invalid`).
- `prototype/atria-prototype.html`: as constantes `REPORTS`, `REP_ENTITY` e `RANGE_PRESETS` e as funções `renderReports`, `repHref`, `repFilterHTML`, `repResult`, `moduleReportsButton` e `finRange` (catálogo, cartão "Filtros", "Gerar relatório", resultado, "Exportar PDF" e a emissão pelo detalhe com `period: 'all'` e `run: '1'`).
- `vostok/rules/project/frontend.md`: [project/frontend-07], [project/frontend-12], [project/frontend-13], [project/frontend-16] e estados.
- `vostok/rules/project/security.md`: [project/security-11] (`frame-ancestors 'none'`) e [project/security-16] (exportação em formato aberto).
- `vostok/rules/project/architecture.md`: [project/architecture-07] e [project/architecture-10].
- `vostok/rules/project/code-style.md`: componentes sem regra de negócio, só tokens do tema.
- `vostok/rules/project/testing.md`: Vitest, Testing Library, axe e testes determinísticos.
- `vostok/rules/project/language.md`: textos em arquivo de tradução.
- `vostok/rules/project/naming-convention.md`: arquivos em `kebab-case`, chaves de objetos em `snake_case`.
- `apps/web/src/app`: só leitura, para ver o layout e como a TASK-35 registra `routes.tsx` e `nav.ts`.
- `apps/web/src/shared`: cliente da API, formatação com `Intl`, i18n comum, fuso do usuário, botão "Voltar" e tipo do item de navegação.
- `packages/ui`: página, cartões, `PageHeader`, `SelectField`, `PeriodField`, botões, estados e aviso.
- `packages/theme`: tokens do tema.
- `packages/contracts`: tipos gerados de `GET /reports`, de `GET /reports/{report}` (ids, parâmetros e o modelo de cada relatório), de `/exports` e das listagens usadas pelos filtros (contas, categorias, livros, emoções do diário, metas e projetos).
- `apps/web/scripts/evidence-shots.mjs`: molde das evidências visuais (TASK-05): Vite numa porta livre, Chromium do `@playwright/test`, temas claro e escuro, 1440 e 360 px, `check()` com `ok`/`FALHA`, prancha `sheet()` e código de saída 1 em falha.

### Mudar

- `apps/web/src/features/reports/routes.tsx` (criar): rotas `/reports`, `/reports/$report` e `/reports/exports`, exportadas por `createReportsRoutes(parent_route)`.
- `apps/web/src/features/reports/nav.ts` (criar): item "Relatórios" da sidebar, exportado como `reportsNavItem`.
- `apps/web/src/features/reports/i18n/pt-br.json` (criar): textos da feature.
- `apps/web/src/features/reports/reports-list-page.tsx` (criar): catálogo dos nove relatórios agrupados por módulo (RF-61, PD-61).
- `apps/web/src/features/reports/report-page.tsx` (criar): página do relatório com o cabeçalho, o cartão "Filtros", "Gerar relatório", o resultado, "Exportar PDF" e a versão interativa em nova aba (RF-61, RF-62, PD-61).
- `apps/web/src/features/reports/report-filters.tsx` (criar): cartão "Filtros" com o `PeriodField` da TASK-05, nos relatórios que têm período, e os filtros de cada relatório no `SelectField` (PD-55, PD-57, PD-61, PD-62).
- `apps/web/src/features/reports/report-result.tsx` (criar): resultado de cada um dos nove relatórios, a partir do modelo em JSON da TASK-17.
- `apps/web/src/features/reports/exports-page.tsx` (criar): exportação de todos os dados do usuário em JSON e CSV (RF-63).
- `apps/web/src/features/reports/report-catalog.ts` (criar): os nove relatórios do catálogo da TASK-17, com módulo, filtros e chaves de tradução.
- `apps/web/src/features/reports/use-report-search.ts` (criar): leitura, validação e gravação na URL do período, dos filtros (`account_id`, `category_id`, `book_id`, `emotion`, `goal_id`, `project_id`, `type` e `goal_status`), de `from_module` e de `run`, com o período de quem chega por uma entidade.
- `apps/web/src/features/reports/use-report-search.test.ts` (criar): testes da leitura dos filtros pela URL, do período padrão e dos parâmetros da API.
- `apps/web/src/features/reports/use-report-result.ts` (criar): consulta do modelo do relatório em JSON, só depois de gerar.
- `apps/web/src/features/reports/use-filter-options.ts` (criar): opções dos seletores de filtro (contas, categorias de saída, livros, emoções, metas e projetos).
- `apps/web/src/features/reports/use-file-download.ts` (criar): download de PDF, JSON e CSV com estados carregando e erro.
- `apps/web/src/features/reports/reports-list-page.test.tsx` (criar): testes do catálogo.
- `apps/web/src/features/reports/report-page.test.tsx` (criar): testes do relatório, dos filtros e do resultado.
- `apps/web/src/features/reports/exports-page.test.tsx` (criar): testes da exportação.
- `apps/web/src/features/reports/reports.e2e.ts` (criar): fluxos ponta a ponta dos CT-33 e CT-34, rodados só na TASK-35.
- `apps/web/src/features/reports/evidence/harness.tsx` (criar): página de evidência que monta `createReportsRoutes` num roteador em memória do TanStack Router, com os providers do app (tema, TanStack Query, i18n, preferências) e dentro do layout do app; não é importada pelo app nem por `apps/web/src/app` (nada muda em `apps/web/src/app`) e por isso fica fora do build de produção; só tokens do tema (a Verificação de cor literal continua valendo); passa no typecheck e no lint.
- `apps/web/scripts/evidence-reports.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-reports.mjs temas|estados`), em Node sem dependências novas, no molde de `apps/web/scripts/evidence-shots.mjs` (código próprio, sem importar o da TASK-05): sobe o Vite numa porta livre por `createServer` da API do Vite com um plugin que serve uma página HTML virtual carregando o `harness.tsx` (encerra no fim, KNW-006), simula a API com `context.route('/api/**')` e fixtures em memória no próprio script (`GET /reports/{report}` com o modelo em JSON, as listagens dos filtros, `format=pdf` e `/exports` lentos para o carregando, e `problem+json` para os erros, inclusive `report_filter_invalid`), captura nos temas claro e escuro, em 1440 px e em 360 px, confere o estado no DOM antes de cada captura (tema aplicado, sem rolagem horizontal, sem erro de JS, axe sem violações incluindo `color-contrast`, e as verificações de cada estado), imprime `ok` ou `FALHA` por verificação, o caminho do PNG e a última linha `ok  0 falha(s)`, e sai com código diferente de 0 se algo falhar; as pranchas vão para `vostok/work/tasks/SPEC-001/evidence/TASK-34/`.

### Passos

1. Ler os arquivos de "Ler" e anotar os nomes exportados por `apps/web/src/shared`, `packages/ui` e `packages/contracts` (ids aceitos em `{report}`, os parâmetros `from`, `to`, `account_id`, `category_id`, `book_id`, `type`, `emotion_id`, `goal_id`, `goal_status`, `project_id` e `format`, o modelo em JSON de cada relatório, com `any_period` e o `period` resolvido, o `format` de `/exports` e as listagens de contas, categorias, livros, emoções, metas e projetos). O período é o `PeriodField` de `@atria/ui` (TASK-05) e os filtros são o `SelectField`, sem seletor de período nem calendário próprios da feature e sem `<select>` nativo (PD-55, PD-57, PD-62).
2. Criar `report-catalog.ts` com a constante `REPORT_CATALOG`, os nove relatórios da TASK-17 nesta ordem, uma entrada por linha, cada um com `id`, `module`, `filters` e as chaves de título e descrição (PD-61, DEC-002, DEC-004):

   | id | módulo | filtros |
   |---|---|---|
   | `fin-flow` | `finance` | `period`, `account` |
   | `fin-cat` | `finance` | `period`, `account`, `category` |
   | `fin-diff` | `finance` | `period`, `account` |
   | `read-pages` | `library` | `period`, `book` |
   | `lib-status` | `library` | `type` |
   | `journal-emo` | `journal` | `period`, `emotion` |
   | `goals-progress` | `goals` | `goal`, `goal_status` |
   | `tasks-done` | `tasks` | nenhum |
   | `proj-cards` | `projects` | `project` |

   O tipo `ReportId` vem de `@atria/contracts`, para o typecheck acusar um id fora do contrato. Exporte também `reportHref(id, params)`, que monta `/reports/<id>?<params>`: é o endereço usado pelo menu "Relatórios" de cada módulo (`?from_module=<módulo>`) e pelo "Mais ações" das entidades (`?<filtro>=<id>&period=all&run=1`, ex.: `/reports/fin-cat?category_id=<id>&period=all&run=1`, como o `repHref` do protótipo), que ficam nas tarefas de cada tela. As chaves de filtro na URL são `account_id`, `category_id`, `book_id`, `emotion`, `goal_id`, `project_id`, `type` e `goal_status`.
3. Criar `i18n/pt-br.json` com chaves em `snake_case` sob `reports`: `nav`, `title` ("Relatórios"), `eyebrow` ("Enxergar"), `subtitle` ("Escolha um relatório, ajuste os filtros e gere. Cada módulo também emite os seus."), `module.<módulo>` (Financeiro, Acervo, Diário, Metas, Tarefas e Projetos), `report.<id>.title` e `report.<id>.description` para cada um dos nove, com os textos do `REPORTS` do protótipo, `filters.title` ("Filtros"), `filters.none` ("Este relatório não tem filtros."), `filters.period`, `filters.account` ("Conta", "Todas as contas"), `filters.category` ("Categoria", "Todas as categorias"), `filters.book` ("Livro", "Todos os livros"), `filters.type` ("Tipo", "Todos os tipos", Livros, Artigos e Vídeos), `filters.emotion` ("Emoção", "Todas as emoções"), `filters.goal` ("Meta", "Todas as metas"), `filters.goal_status` ("Status", "Todos os status" e os quatro status da meta da TASK-08: `planned` "Planejada", `in_progress` "Em andamento", `completed` "Concluída" e `abandoned` "Abandonada"; não os `active`, `paused` e `done` do protótipo), `filters.project` ("Projeto", "Todos os projetos"), `period.<preset>` e os demais `labels` do `PeriodField` (Este mês, Mês passado, Próximos 30 dias, Últimos 30 dias, Este ano, Qualquer período, "Escolher período", "Personalizado", "Aplicar", "Escolha o primeiro dia.", "escolha o último dia" e "Escolha o primeiro dia no calendário."), `period.any_resolved` ("Qualquer período · {de} – {até}"), `generate` ("Gerar relatório"), `not_generated` ("Escolha os filtros" / "O relatório aparece aqui depois de gerado."), `no_data` ("Sem dados neste período."), `tasks_done_note` ("Tarefas diárias não guardam histórico, por isso ficam fora deste relatório."), `open_html` ("Abrir em nova aba"), `open_html_hint`, `export_pdf` ("Exportar PDF"), `exporting`, `export_failed`, `filter_invalid`, `exports.title`, `exports.subtitle`, `exports.json`, `exports.csv`, `exports.hint` (diz que traz só os dados da própria pessoa), `loading` e `error`.
4. Escrever os testes antes do código, com o cliente da API simulado e o relógio fixo ([project/testing-07]):
   - `use-report-search.test.ts`: `reads every filter from the url`, `keeps only the filters accepted by the report`, `defaults to this month in the user timezone`, `opens with any period when it comes from an entity`, `sends no from and to for any period`, `sends from and to of the preset in the user timezone`, `maps the emotion filter to emotion_id`, `accepts only the goal statuses of the contract` (`planned`, `in_progress`, `completed` e `abandoned`; `active` é descartado) e `drops from_module and run from the api params`.
   - `reports-list-page.test.tsx`: `lists the nine reports grouped by module`, `links each report to its page` e `has no axe violations`.
   - `report-page.test.tsx`: `shows the period only in the five period reports`, `shows the filters of each report`, `shows only expense categories in the category filter`, `shows the result only after generating`, `keeps the period and the filters in the URL`, `opens filtered and generated from an entity link`, `generates on load when the url has run`, `offers any period in the period field`, `shows any period with the resolved dates in the result`, `uses the custom select for the filters`, `goes back to the module it came from`, `renders the result of each report`, `exports the pdf with the period and the filters`, `opens the interactive html report in a new tab with the filters`, `shows the loading state while exporting`, `shows the error inside the page with role alert when the export fails`, `shows a refused filter inside the filters card` e `has no axe violations`.
   - `exports-page.test.tsx`: `downloads all user data as json`, `downloads all user data as csv`, `shows the loading state while exporting`, `shows the error state when the export fails` e `has no axe violations`.
5. Rodar `pnpm --filter @atria/web test -- src/features/reports` e confirmar que falham por falta da implementação.
6. Implementar `use-report-search.ts` (PD-55, PD-61, DEC-004): esquema `zod` da busca de `/reports/$report`, que é a fonte de todos os filtros da página, com `period` (`this_month`, `last_month`, `next_30_days`, `last_30_days`, `this_year`, `all` ou `custom`, os valores do `PeriodPreset` da TASK-05), `from` e `to` (`AAAA-MM-DD`, só com `custom`; incompleto ou `from` depois de `to` cai no padrão), os filtros `account_id`, `category_id`, `book_id`, `emotion`, `goal_id` e `project_id` (UUID), `type` (`book`, `article`, `video`), `goal_status` (`planned`, `in_progress`, `completed` ou `abandoned`, os valores da TASK-08), `from_module` (módulo do catálogo) e `run` (`1`); valores inválidos são descartados sem erro. Mantém só os filtros aceitos pelo relatório do catálogo. Sem `period` na URL, o padrão é `all` ("Qualquer período") quando a busca traz um filtro de entidade (`account_id`, `category_id`, `book_id`, `goal_id` ou `project_id`) com `run=1`, como a emissão pelo detalhe no protótipo (`period: 'all'`), e `this_month` nos outros casos. `toPeriodValue(search)` devolve o `PeriodValue` do `PeriodField` e `fromPeriodValue(value)` os parâmetros gravados na URL. `apiParams(report, search)` devolve os parâmetros da API: nos cinco relatórios com `period`, `from` e `to` pelo `resolvePeriod` de `@atria/ui` com "hoje" no fuso do usuário, e nenhum dos dois em `all` (a TASK-17 vai do primeiro registro até hoje); os filtros com os nomes da TASK-17 (`emotion` vira `emotion_id`); sem `from_module` e `run`.
   Implementar `use-report-result.ts` (`useQuery` de `GET /api/v1/reports/{report}?<apiParams>` sem `format`, que devolve o modelo em JSON da TASK-17, com `enabled` só quando `run=1`) e `use-filter-options.ts` (uma consulta por filtro aceito pelo relatório, só enquanto o filtro aparece: contas, categorias com `kind=expense`, livros, emoções do diário, metas e projetos, pelas listagens de `@atria/contracts`).
   Implementar `use-file-download.ts` (busca o arquivo pelo cliente da API como `Blob`, cria a URL do objeto, dispara o download com o nome vindo de `Content-Disposition` e expõe `is_loading` e `error`).
7. Implementar `report-filters.tsx`: cartão "Filtros" (`<section aria-labelledby>`) com um formulário: só nos relatórios com `period`, o `PeriodField` de `@atria/ui` com `placement="form"`, os seis presets na ordem padrão (inclusive "Qualquer período", que a TASK-17 aceita), `allow_custom`, `value={toPeriodValue(search)}`, "hoje" no fuso do usuário, o `locale` e os `labels` do i18n; um `SelectField` (por `FormSelect`) por filtro aceito, na ordem do catálogo, com a opção "Todos" vazia e as opções de `use-filter-options` (categorias só de saída; `type` com Livros, Artigos e Vídeos; `goal_status` com os quatro status da TASK-08), "Este relatório não tem filtros." quando não há nenhum, e o botão primário "Gerar relatório", que grava o período (`fromPeriodValue`), os filtros e `run=1` na URL. Os campos começam com os valores da URL. A recusa `report_filter_invalid` ou `report_period_invalid` aparece dentro do cartão, em `role="alert"`.
   Implementar `report-result.tsx`: um bloco por relatório, a partir do modelo em JSON, com cartões e barras horizontais com o valor também em texto e uma tabela para leitor de tela (`<caption>` e `<th scope>`), valores e datas por `Intl`: `fin-flow` (entradas e saídas por mês), `fin-cat` (gastos por categoria, do maior ao menor), `fin-diff` (economias e ganhos em `success` e perdas em `warning`, nunca `danger`), `read-pages` (páginas lidas por livro), `lib-status` (livros, artigos e vídeos por status, só o tipo filtrado quando há `type`), `journal-emo` (entradas no período, emoções mais frequentes e intensidade média), `goals-progress` (progresso por meta e metas por status), `tasks-done` (pontuais concluídas e abertas, com a nota de que as diárias ficam fora) e `proj-cards` (cartões por projeto, quando nenhum projeto é filtrado, e por raia); sem dados, "Sem dados neste período.". Nos relatórios de período, o resultado mostra o período resolvido do modelo, e com `any_period` o texto "Qualquer período · {de} – {até}" com as datas por `Intl`.
   Implementar `report-page.tsx` (PD-61): cabeçalho com "Voltar" (para `/<from_module>` quando a busca tem `from_module`, senão o "Voltar" de `apps/web/src/shared`, com `/reports` como destino sem histórico), eyebrow "Relatórios · {módulo}", o título e a descrição do relatório; depois de gerar (`run=1`), as ações "Abrir em nova aba" (link para `/api/v1/reports/{report}?<apiParams>&format=html` com `target="_blank"` e `rel="noopener"`, a versão interativa do servidor) e "Exportar PDF" (baixa `format=pdf` com os mesmos parâmetros por `use-file-download`, com os estados carregando e erro em `role="alert"`). Abaixo, o cartão "Filtros" e, antes de gerar, o estado "Escolha os filtros"; depois, o resultado com os estados carregando e erro com "Tentar de novo". Toda a página lê o estado pela URL: um link com filtros e `run=1` (de um módulo ou de uma entidade, ex.: `?book_id=<id>&period=all&run=1`) abre com os filtros escolhidos no cartão e o relatório já gerado, sem clique; um link de entidade sem `period` abre em "Qualquer período". Id fora do catálogo ou `report_not_found` mostra a página de rota inexistente.
8. Implementar `reports-list-page.tsx` (PD-61): cabeçalho com eyebrow "Enxergar", título "Relatórios" e o subtítulo, e um cartão por módulo, na ordem do catálogo (Financeiro, Acervo, Diário, Metas, Tarefas e Projetos), com a lista dos relatórios dele: título como link esticado para `/reports/<id>`, a descrição embaixo e o chevron; link "Exportar meus dados" para `/reports/exports`. Implementar `exports-page.tsx` (botões JSON e CSV sobre `/api/v1/exports?format=...`, com os estados carregando e erro).
9. Criar `routes.tsx` com `createReportsRoutes(parent_route)` e os esquemas `zod` da busca, e `nav.ts` com `reportsNavItem` (destino `/reports`, ícone SVG inline com `aria-hidden="true"`). O item "Relatórios" continua na sidebar (PD-61).
10. Criar `reports.e2e.ts` (Playwright) com o CT-33 (cada um dos nove relatórios com os seus filtros, os cinco de período num intervalo, gerar, abrir o HTML, interagir e exportar o PDF, um relatório aberto já filtrado e em "Qualquer período" a partir de um link de entidade e um relatório de período gerado em "Qualquer período") e o CT-34 (exportar JSON e CSV e conferir que trazem só os dados do usuário), em 360 px e desktop, com axe. Não rodar: ele roda na TASK-35.
11. Rodar a Verificação até passar sem nenhum warning de lint.
12. Criar `evidence/harness.tsx` e `apps/web/scripts/evidence-reports.mjs` (veja "Mudar") e rodar `node apps/web/scripts/evidence-reports.mjs temas` e `node apps/web/scripts/evidence-reports.mjs estados`. Corrigir o código da tarefa a cada linha `FALHA` e abrir as pranchas `reports-themes-widths.png` e `reports-states-focus.png` para conferir.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
pnpm --filter @atria/web test -- src/features/reports
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
test -f apps/web/src/features/reports/reports.e2e.ts
# Os nove ids do catálogo da TASK-17 estão no catálogo da tela: esperado 9
test "$(grep -cE "'(fin-flow|fin-cat|fin-diff|read-pages|lib-status|journal-emo|goals-progress|tasks-done|proj-cards)'" apps/web/src/features/reports/report-catalog.ts)" -eq 9
# Nenhuma cor literal fora dos tokens do tema
! grep -rnE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(' apps/web/src/features/reports --include=*.tsx --include=*.ts --include=*.css
# PeriodField da TASK-05, sem seletor de período próprio nem controles nativos (PD-55, PD-57, PD-62)
! test -e apps/web/src/features/reports/period-picker.tsx
grep -q 'PeriodField' apps/web/src/features/reports/report-filters.tsx
! grep -rnE "<select|type=[\"'](date|time|datetime-local)[\"']" apps/web/src/features/reports --include=*.tsx
# Evidências visuais automáticas
test -f apps/web/src/features/reports/evidence/harness.tsx
test -f apps/web/scripts/evidence-reports.mjs
node --check apps/web/scripts/evidence-reports.mjs
```

### Evidências

- `reports-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/reports --reporter=verbose`
  - Prova: os testes de Relatórios passam, cobrindo o catálogo dos nove relatórios por módulo, o cartão "Filtros" com o período só nos cinco de período e os filtros de cada um, o resultado só depois de gerar, a emissão já filtrada a partir de uma entidade, a versão interativa, a exportação em PDF, a exportação JSON e CSV, os estados e o axe (RF-61, RF-62, RF-63, CT-33, CT-34, RNF-06, PD-61).
  - Trecho: as linhas `✓` de `lists the nine reports grouped by module`, `shows the period only in the five period reports`, `shows the filters of each report`, `shows the result only after generating`, `opens filtered and generated from an entity link`, `exports the pdf with the period and the filters`, `offers any period in the period field`, `opens with any period when it comes from an entity`, `reads every filter from the url`, `generates on load when the url has run` e `downloads all user data as csv`, e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `reports-files.txt` (automática): `find apps/web/src/features/reports -type f | sort`
  - Prova: a feature tem rotas, item de menu, traduções, telas, filtros, resultado, hooks, testes e o e2e dos CT-33 e CT-34.
  - Trecho: `routes.tsx`, `nav.ts`, `i18n/pt-br.json`, `report-filters.tsx`, `report-result.tsx` e `reports.e2e.ts` na lista.
  - Falha: `No such file or directory` ou algum desses arquivos ausente.
- `reports-themes-widths.txt` (automática): `node apps/web/scripts/evidence-reports.mjs temas`
  - Prova: identidade visual nos dois temas, o comportamento do protótipo e layout funcional a partir de 360 px, medidos no DOM e fotografados: o catálogo, a página de um relatório de período com o seletor aberto e um intervalo marcado no calendário, a página de um relatório sem período e um resultado gerado com "Exportar PDF" no cabeçalho, em 1440 px e em 360 px, nos temas claro e escuro (RNF-08, RNF-10, PD-61).
  - Trecho: uma linha `ok` por verificação, como `ok ... tema aplicado`, `ok ... catálogo com um cartão por módulo e os nove relatórios`, `ok ... cartão "Filtros" com o período` (relatório de período), `ok ... seletor de período aberto e intervalo marcado no calendário`, `ok ... popover dentro da janela`, `ok ... "Este relatório não tem filtros."` ou o filtro sem período (relatório sem período), `ok ... "Escolha os filtros" antes de gerar`, `ok ... resultado gerado com "Exportar PDF" e "Abrir em nova aba"`, `ok ... sem <select> nativo`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclui color-contrast)` em cada captura; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-34/reports-themes-widths.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (filtros ou calendário cortados em 360 px, resultado antes de gerar, contraste baixo no tema escuro apontado pelo axe), a ausência da linha `png:` ou código de saída diferente de 0 (`Cannot find module` antes da tarefa, porque o script não existe).
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-34/reports-themes-widths.png`, a prancha com as capturas rotuladas: catálogo, relatório de período com o seletor aberto e um intervalo no calendário, relatório sem período e resultado gerado com "Exportar PDF", nos temas claro e escuro, em 1440 px e em 360 px.
- `reports-states-focus.txt` (automática): `node apps/web/scripts/evidence-reports.mjs estados`
  - Prova: os estados de carregando e erro e o foco por teclado ([project/frontend-10], RNF-06).
  - Trecho: `ok ... exportação em PDF: indicador de andamento visível` (resposta lenta), `ok ... exportação em PDF: erro em role="alert" na página`, `ok ... filtro recusado: erro em role="alert" dentro do cartão "Filtros"` (`report_filter_invalid`), `ok ... exportação de dados: indicador de andamento visível`, `ok ... foco visível depois de Tab, inclusive num dia do calendário`, `ok ... contorno de foco visível · ≥ 2px`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclui color-contrast)`; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-34/reports-states-focus.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (exportação sem indicação de andamento, erro sem mensagem ou fora do cartão, foco invisível ou contorno menor que 2 px), a ausência da linha `png:` ou código de saída diferente de 0.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-34/reports-states-focus.png`, a prancha com a exportação em PDF carregando e com erro, um filtro recusado no cartão "Filtros", a exportação de dados carregando e a página do relatório com o foco visível navegando só pelo teclado, inclusive no calendário, nos dois temas.

### Concluída quando

- [x] A página Relatórios lista os nove relatórios agrupados por módulo, cada um com título e descrição, e o item "Relatórios" continua na sidebar (RF-61, PD-61).

  > Como comprovar: na saída `reports-tests.txt`, ver aprovados `lists the nine reports grouped by module` e `links each report to its page`; o comando de contagem da Verificação dá 9.

- [x] Cada relatório abre uma página com o cartão "Filtros", com o período só nos cinco relatórios de período e os filtros do relatório, e o resultado só aparece depois de "Gerar relatório", com período e filtros na URL (RF-61, CT-33, PD-61, DEC-004).

  > Como comprovar: ver aprovados `shows the period only in the five period reports`, `shows the filters of each report`, `shows only expense categories in the category filter`, `shows the result only after generating`, `keeps the period and the filters in the URL`, `renders the result of each report` e `shows a refused filter inside the filters card`.

- [x] Um relatório emitido a partir de um módulo ou de uma entidade abre já filtrado e gerado e volta ao módulo de origem (PD-61).

  > Como comprovar: ver aprovados `opens filtered and generated from an entity link` e `goes back to the module it came from`.

- [x] Cada relatório gerado abre a versão interativa em nova aba e é exportado em PDF com o período e os filtros, com os estados carregando e erro (RF-61, RF-62, CT-33).

  > Como comprovar: ver aprovados `opens the interactive html report in a new tab with the filters`, `exports the pdf with the period and the filters`, `shows the loading state while exporting` e `shows the error inside the page with role alert when the export fails`.

- [x] Todos os dados do usuário são exportados em JSON e CSV (RF-63, CT-34).

  > Como comprovar: ver aprovados `downloads all user data as json` e `downloads all user data as csv`.

- [x] O período é o `PeriodField` da TASK-05, com os presets do Financeiro, inclusive "Qualquer período" sem datas, e o intervalo no calendário próprio; a emissão a partir de uma entidade abre em "Qualquer período", como no protótipo (PD-55, PD-57, DEC-004).

  > Como comprovar: em `reports-tests.txt`, ver aprovados `offers any period in the period field`, `sends no from and to for any period`, `sends from and to of the preset in the user timezone`, `opens with any period when it comes from an entity` e `shows any period with the resolved dates in the result`; a Verificação acha `PeriodField` em `report-filters.tsx` e não acha `period-picker.tsx`.

- [x] A página lê pela URL todos os filtros (`book_id`, `account_id`, `category_id`, `goal_id`, `project_id`, `type`, `goal_status` e `emotion`) e o `run=1`, que gera o relatório ao abrir; os filtros usam o seletor próprio (PD-61, PD-62).

  > Como comprovar: em `reports-tests.txt`, ver aprovados `reads every filter from the url`, `keeps only the filters accepted by the report`, `accepts only the goal statuses of the contract`, `generates on load when the url has run` e `uses the custom select for the filters`; a Verificação não acha `<select` na feature.

- [x] As telas não têm violações no axe, funcionam só pelo teclado e nos dois temas, a partir de 360 px (RNF-06, RNF-08, RNF-10).

  > Como comprovar: ver aprovados os casos `has no axe violations`; em `reports-themes-widths.txt` e `reports-states-focus.txt`, ver só linhas `ok` (tema, sem rolagem horizontal, axe sem violações, estados e contorno de foco) e `ok  0 falha(s)`, e conferir nas pranchas `reports-themes-widths.png` e `reports-states-focus.png` os dois temas, as duas larguras, os estados e o foco.

- [x] Testes, typecheck e lint passam sem warning, e o e2e dos CT-33 e CT-34 está escrito para a TASK-35.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; `reports.e2e.ts` aparece em `reports-files.txt`.

## Descrição

### Resumo executivo

Entrega as telas de Relatórios como no protótipo: um catálogo com os nove relatórios agrupados por módulo, uma página por relatório com os filtros dele e o botão "Gerar relatório", o resultado na própria tela, a versão interativa, o PDF e a exportação de todos os próprios dados em JSON e CSV.
Dá à pessoa uma visão do que viveu ao longo do tempo, inclusive a partir de uma conta, categoria, livro, meta ou projeto, e a liberdade de levar os dados consigo.
Perfil padrão, risco baixo: os relatórios são calculados pelo servidor, e a tela escolhe os filtros, mostra o resultado e baixa os arquivos.
Libera a integração do frontend, que coloca Relatórios no menu e roda o fluxo ponta a ponta.

### Detalhes técnicos

- **Abordagem:** feature React em `apps/web/src/features/reports` com o catálogo, a página de cada relatório (filtros, resultado e exportação) e a tela de exportação. Os relatórios vêm do servidor (TASK-17): o modelo em JSON de `GET /reports/{report}` sem `format` para o resultado na tela, `format=html` para a versão interativa e `format=pdf` para o PDF; a exportação usa `/exports?format=json|csv`.
- **Divergências com a spec planejada:** a spec SPEC-001 está `planned` e não muda. Por decisão do usuário (DEC-002, DEC-004), as telas seguem a PD-61, como a TASK-17 já faz no servidor: nove relatórios, e não seis, cada um com os seus filtros, e período só em cinco deles.
- **Componentes:** catálogo, página do relatório, cartão "Filtros" com o `PeriodField` e o `SelectField` de `@atria/ui`, resultado, tela de exportação, catálogo dos relatórios e hooks da busca, do resultado, das opções dos filtros e do download; usa `@atria/ui`, `@atria/theme`, `@atria/contracts` e `apps/web/src/shared`.
- **Decisão: catálogo e filtros da TASK-17 (PD-61).** `REPORT_CATALOG` repete os ids, módulos e filtros do catálogo do servidor, com o tipo `ReportId` de `@atria/contracts`, para o typecheck acusar uma divergência; os títulos e descrições vêm do arquivo de tradução pelo id ([project/language-06]). Descartado montar a lista a partir de `GET /reports`, que devolve os textos em pt-br do servidor e obrigaria uma consulta antes de mostrar a página.
- **Decisão: resultado na tela, só depois de gerar (PD-61).** A página lê o modelo em JSON e mostra o resultado em cartões, como no protótipo, depois de "Gerar relatório"; a versão HTML do servidor abre em nova aba. Descartados o `iframe` dentro do app, bloqueado pelo `frame-ancestors 'none'` de [project/security-11], e gerar a cada mudança de filtro, que o protótipo trocou pelo botão.
- **Decisão: emissão pelos módulos e pelas entidades por endereço.** A página aceita os filtros, `from_module` e `run=1` na URL; o botão "Relatórios" dos módulos e o "Mais ações" das entidades (conta, categoria, livro, meta e projeto) são das tarefas de cada tela e só montam o link com `reportHref`. Descartado um estado compartilhado entre as features, que criaria arquivo em comum na onda 7.
- **Decisão: "Qualquer período" nos relatórios (DEC-004).** A TASK-17 aceita `from` e `to` opcionais e vai do primeiro registro até hoje quando faltam, então o seletor oferece os seis presets do Financeiro, inclusive "Qualquer período", que não manda datas, e o resultado mostra as datas resolvidas pelo servidor. A emissão a partir de uma entidade abre em "Qualquer período", como o `repHref(r, { [filtro]: id, period: 'all', run: '1' })` do protótipo; os links das outras telas mandam `period=all`, e o padrão vale também para um link de entidade sem `period`. Descartados o "Este mês" na emissão por entidade, que a versão anterior desta tarefa previa por falta de suporte no servidor, e uma data inicial fixa.
- **Decisão: `PeriodField` da TASK-05 (PD-55, PD-57).** O cartão "Filtros" usa o `PeriodField` de `@atria/ui` com `placement="form"` e o `resolvePeriod` dele, o mesmo componente do Financeiro (TASK-22). Descartado o seletor de período próprio da feature, que o primeiro ajuste previa antes da TASK-05 fornecê-lo.
- **Decisão: estado na URL (PD-61, [project/frontend-13]).** Todos os filtros (`account_id`, `category_id`, `book_id`, `emotion`, `goal_id`, `project_id`, `type` e `goal_status`), o período e `run=1` são lidos da URL; `emotion` vira `emotion_id` na API da TASK-17, e `goal_status` aceita só os valores da TASK-08 (`planned`, `in_progress`, `completed` e `abandoned`), não os do protótipo. Filtros em `SelectField`, sem `<select>` nativo (PD-62).
- **Decisão: PDF e exportações como `Blob`.** Baixados pelo cliente da API, para mostrar os estados carregando e erro; descartado o link direto, sem como mostrar a falha. Período e filtros ficam na URL ([project/frontend-13]).
- **Privacidade:** a exportação e os relatórios trazem só os dados da própria pessoa, garantido pelo servidor (RNF-02, [project/security-16]); um filtro com id de outra pessoa sai vazio. A tela só informa isso.
- **Riscos:** exportação grande demorando (mitigado com o estado de andamento); bloqueio da nova aba pelo navegador (mitigado por abrir só a partir do clique da pessoa); o formato do modelo em JSON de cada relatório precisa ser conferido em `@atria/contracts` (TASK-17).
- **Referências da spec:** RF-61, RF-62, RF-63, CT-33, CT-34, decisões 14 e 43, RNF-02, RNF-06, RNF-08 a RNF-10. Decisões da memória: DEC-002 e DEC-004. Decisões do protótipo: PD-55, PD-57, PD-61 e PD-62.
- **Evidências visuais:** as pranchas `reports-themes-widths.png` e `reports-states-focus.png` são geradas por `apps/web/scripts/evidence-reports.mjs`, no molde do `evidence-shots.mjs` da TASK-05: cada evidência é um comando cuja saída (`.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG. Como as rotas das features só são registradas no app pela TASK-35, o script monta a feature por `src/features/reports/evidence/harness.tsx` (as rotas de `createReportsRoutes` num roteador em memória com os providers e o layout do app), servido por uma página virtual do Vite, com a API simulada por fixtures; nada muda em `apps/web/src/app`.
- **Arquivos em comum na onda 7:** nenhum.

### Card

- **Título:** Telas de Relatórios
- **Tipo:** historia
- **Descrição:** Telas de Relatórios como no protótipo: catálogo dos nove relatórios por módulo, página de cada um com os seus filtros e "Gerar relatório", resultado na tela, versão interativa, PDF, emissão já filtrada a partir dos módulos e das entidades, e exportação de todos os dados do usuário em JSON e CSV.
- **Critérios de aceite:**
  - [ ] Os nove relatórios listados por módulo, cada um com a sua página.
  - [ ] Cartão "Filtros" com o período só nos cinco relatórios de período e os filtros de cada um, na URL.
  - [ ] O resultado aparece só depois de gerar, com a versão interativa e a exportação em PDF.
  - [ ] Relatórios emitidos de um módulo ou de uma entidade abrem já filtrados pela URL, e os de entidade em "Qualquer período".
  - [ ] O período usa o seletor da base, com "Qualquer período".
  - [ ] Exportação de todos os dados do usuário em JSON e CSV.
  - [ ] Sem violações no axe, nos dois temas e a partir de 360 px.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 4 | 2026-10-31 | ajuste | in_progress | Evidências manuais reports-themes-widths.png e reports-states-focus.png trocadas por automáticas reports-themes-widths.txt e reports-states-focus.txt geradas por apps/web/scripts/evidence-reports.mjs, com a prancha PNG como Artefato; harness da feature em src/features/reports/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 5 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 6 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 7 | 2026-10-31 | evidências | passed | 4 evidência(s) em evidence/TASK-34/ |
| 8 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md (PD-55, PD-57, PD-61), DEC-002 e DEC-004, TASK-17 e o REPORTS do protótipo; catálogo dos nove relatórios da TASK-17 agrupados por módulo no lugar dos seis (PD-61); página do relatório com cartão Filtros, período só nos cinco de período e os filtros de cada um (conta, categoria de saída, livro, tipo, emoção, meta, status da meta, projeto), Gerar relatório, resultado do JSON só depois de gerar, Exportar PDF e versão interativa em nova aba (PD-61, DEC-004); emissão pelos módulos e entidades por endereço com reportHref, from_module e run=1, sem os menus das outras telas (PD-61); seletor de período com os presets e o calendário do Financeiro, sem Qualquer período (PD-55, PD-57); arquivos report-filters, report-result, use-report-search, use-report-result e use-filter-options em Mudar; testes, Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 2 | 2026-10-30 | agente | Ler com TASK-05 e o contrato de período opcional da TASK-17; PeriodField da TASK-05 no cartão Filtros com os seis presets, inclusive Qualquer período sem from e to, no lugar do period-picker da feature, removido de Mudar com o teste (PD-55, PD-57, DEC-004); emissão por entidade com period=all e padrão Qualquer período em link de entidade sem period, como no protótipo; resultado com o período resolvido e any_period; página lê pela URL account_id, category_id, book_id, emotion, goal_id, project_id, type, goal_status e run=1, com emotion mapeado para emotion_id e teste use-report-search.test.ts (PD-61); goal_status com planned, in_progress, completed e abandoned da TASK-08; filtros no SelectField sem select nativo (PD-62); linha de Baseline que citava a pasta criada pela tarefa removida; testes, Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 3 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 4 | 2026-10-31 | agente | Evidências manuais reports-themes-widths.png e reports-states-focus.png trocadas por automáticas reports-themes-widths.txt e reports-states-focus.txt geradas por apps/web/scripts/evidence-reports.mjs, com a prancha PNG como Artefato; harness da feature em src/features/reports/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
