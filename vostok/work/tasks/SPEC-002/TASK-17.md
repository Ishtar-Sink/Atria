---
id: TASK-17
spec: SPEC-002
title: "Painel e listas do Financeiro"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-03, TASK-05, TASK-10, TASK-16]
wave: 5
covers: [RF-04, RF-05, RF-09, RF-10, RF-15, CT-04, CT-08, CT-09, CT-14]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: a96accd5638e4a9e3fd362b55a42047958d8bdff175887bb5b11ae8af9e5e5f3
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 5756cfea51dc8085fb89c4d99bbd39c7c8d83af68cba6768fea80d708ce396e1
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-17: Painel e listas do Financeiro

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md` (Estado atual "Componentes compartilhados", "Painéis (Bugs 10 e 11)" e "Financeiro"; RF-04, RF-05, RF-09, RF-10, RF-15; CT-04, CT-08, CT-09, CT-14; RNF-06; decisões 2 e 4, respostas 2A e 4A)
- `vostok/work/tasks/SPEC-002/TASK-03.md` (ícones da `@atria/ui` e o `ViewSwitcher` só com ícone; a TASK-03 já passou `ListIcon` e `GridIcon` em `list-toolbar.tsx`)
- `vostok/work/tasks/SPEC-002/TASK-05.md` (`PeriodField` com `label_visible={false}`: rótulo só para leitor de tela, alinhado aos botões)
- `vostok/work/tasks/SPEC-002/TASK-10.md` (o campo `upcoming_bills` do resumo passa a trazer entradas e saídas dos próximos 30 dias; cada item tem `kind`)
- `vostok/work/tasks/SPEC-002/TASK-08.md` (o padrão de linhas pareadas do dashboard: células com `data-zone`, `data-row` e `data-alone`)
- `vostok/work/tasks/SPEC-002/TASK-16.md` (textos novos no mesmo `i18n/pt-br.json` e a evidência `formulario` no mesmo script)
- `prototype/atria-prototype.html` (linha 836: cabeçalho do Financeiro com o botão de período ao lado de Relatórios e Novo registro; regras `.filters`, `.seg` e `.dash`)
- `docs/decisoes-do-prototipo.md` (PD-55 e PD-57: período; PD-58: painel em duas zonas, com a exceção da resposta 2A)
- `apps/web/src/features/finance/components/finance-shell.tsx` (fn `FinanceShell`, `PeriodField` perto da linha 200)
- `apps/web/src/features/finance/components/list-toolbar.tsx` (fn `ListToolbar`)
- `apps/web/src/features/finance/components/finance.module.css` (regras `.srOnly`, linhas 3 a 12, e `.filters` e `.filters > *`, linhas 75 a 84)
- `apps/web/src/features/finance/components/panel-charts.tsx` (tabelas acessíveis nas linhas 58 e 146)
- `apps/web/src/features/finance/screens/finance-panel-screen.tsx` (fns `Upcoming` e `FinancePanelScreen`, linhas 229 a 374)
- `apps/web/src/features/finance/screens/finance-panel-screen.module.css`
- `apps/web/src/features/finance/screens/finance-panel-screen.test.tsx` (testes `shows balance, cards, upcoming bills and savings and losses`, `shows the panel empty, loading and error states` e `keeps the two zones in one column below 960 px`)
- `apps/web/src/features/finance/components/components.test.tsx` (teste `shows bars and columns with values in text`)
- `apps/web/src/features/finance/screens/transactions-screens.test.tsx` (bloco `incomes and expenses`: a barra de busca, filtros e visualização)
- `apps/web/src/features/reports/report-result.tsx` (tabelas acessíveis nas linhas 70 e 146) e `apps/web/src/features/reports/report-page.test.tsx`
- `apps/web/src/features/reports/reports.module.css` (só leitura: classe `visuallyHidden`)
- `apps/web/src/features/finance/i18n/pt-br.json` (chaves `panel.upcoming*`, `kind.*` e `transactions.no_description_*`)
- `apps/web/scripts/evidence-finance.mjs` (constante `OUT`, cenário `Painel`, fns `summary`, `seed`, `openPage`, `runScenarios`, `EVIDENCES`; a evidência `formulario` da TASK-16)
- `vostok/rules/project/frontend.md` ([project/frontend-08], [project/frontend-12], [project/frontend-14], [project/frontend-17])

### Mudar

- `apps/web/src/features/finance/components/finance-shell.tsx` (alterar): `PeriodField` do cabeçalho sem rótulo visível, alinhado a Relatórios e Novo registro (RF-04).
- `apps/web/src/features/finance/components/list-toolbar.tsx` (alterar): o grupo de filtros com classe própria, para a largura mínima valer só nos campos e não esticar o seletor de visualização (RF-05).
- `apps/web/src/features/finance/components/finance.module.css` (alterar): tirar a largura mínima de `.filters > *`, limitando-a à busca e aos campos de filtro (RF-05).
- `apps/web/src/features/finance/components/panel-charts.tsx` (alterar): a tabela acessível dos gráficos dentro de um contêiner invisível, sem o `caption` escapar no Firefox (RF-10).
- `apps/web/src/features/finance/screens/finance-panel-screen.tsx` (alterar): cards em linhas pareadas e o bloco "Próximas movimentações" com entradas e saídas (RF-09, RF-15).
- `apps/web/src/features/finance/screens/finance-panel-screen.module.css` (alterar): grade de linhas pareadas, como no dashboard (RF-09).
- `apps/web/src/features/finance/screens/finance-panel-screen.test.tsx` (alterar): testes das linhas pareadas, com e sem Cartões, e das Próximas movimentações.
- `apps/web/src/features/finance/components/components.test.tsx` (alterar): teste da tabela acessível dentro do contêiner invisível.
- `apps/web/src/features/finance/screens/transactions-screens.test.tsx` (alterar): teste do seletor de visualização sem largura sobrando e do período sem rótulo visível.
- `apps/web/src/features/reports/report-result.tsx` (alterar): a mesma correção da tabela acessível dos gráficos dos relatórios (RF-10).
- `apps/web/src/features/reports/report-page.test.tsx` (alterar): teste da tabela acessível do relatório dentro do contêiner invisível.
- `apps/web/src/features/finance/i18n/pt-br.json` (alterar): "Próximas movimentações" e os textos do bloco (Bug 12).
- `apps/web/scripts/evidence-finance.mjs` (alterar): grava em `$VOSTOK_EVIDENCE` (padrão `vostok/work/tasks/SPEC-002/evidence/TASK-17`) e ganha a evidência `painel`, em Chromium e Firefox.

### Passos

1. Leia os arquivos de "Ler". Anote: o nome da prop do `PeriodField` para esconder o rótulo (`label_visible`, TASK-05); que `list-toolbar.tsx` já tem `ListIcon` e `GridIcon` (TASK-03); que a TASK-10 manteve o campo `upcoming_bills`, agora com entradas e saídas, e cada item tem `kind`; e o padrão de células da TASK-08 em `apps/web/src/features/dashboard/components/dashboard.module.css`.
2. Escreva os testes antes do código:
   - `transactions-screens.test.tsx`, bloco `incomes and expenses`: `keeps the view switcher only as wide as its options` (o `group` "Visualização" não está dentro do `group` "Filtros" e o CSS de `finance.module.css` não tem a regra `.filters > *`, lido com `readFileSync` como em `finance-panel-screen.test.tsx`) e `shows the period without a visible label in the header` (o botão de período tem nome acessível com "Período" e nenhum texto visível "Período" fora do nome: o rótulo está num elemento com a classe de leitor de tela do `PeriodField`);
   - `components.test.tsx`: `keeps the chart table inside a visually hidden container` (para "Saídas por categoria" e "Previsto e realizado no período", a `table` não tem classe e o pai tem a classe `srOnly`; o `caption` está dentro da tabela; o nome acessível da tabela continua);
   - `report-page.test.tsx`: `keeps the report chart table inside a visually hidden container` (o mesmo para a tabela do gráfico do relatório, com a classe `visuallyHidden` no pai);
   - `finance-panel-screen.test.tsx`: apague `keeps the two zones in one column below 960 px` e escreva `pairs the panel cards in rows` (sem cartões de crédito: as linhas 1, 2 e 3 têm "Fechamento" e "Saldo", "Para onde foi" e "Próximas movimentações", "Previsto x realizado" e "Economias e perdas"), `pairs the panel cards in rows with the cards block` (com cartões: "Para onde foi" e "Cartões" na linha 2, "Previsto x realizado" e "Próximas movimentações" na 3 e "Economias e perdas" sozinho na 4, com `data-alone`) e `keeps one column below 960 px with the main zone first` (ordem do DOM: as três células `main` antes das `side`; CSS com `.zones { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) }`, `.cell > *` com `flex: 1 1 auto` e, em `@media (max-width: 960px)`, uma coluna); ajuste `shows balance, cards, upcoming bills and savings and losses` (mesmo nome) para o título "Próximas movimentações" e escreva `lists upcoming incomes and expenses for the next 30 days` (um item `kind: 'income'` e um `kind: 'expense'` em `upcoming_bills`: cada um mostra a descrição, a data e "Entrada" ou "Saída"; o valor da entrada tem a classe `positive`; os links "Ver entradas" e "Ver saídas" vão para `/finance/income?period=next_30_days` e `/finance/expenses?period=next_30_days`; vazio mostra "Nenhuma movimentação prevista nos próximos 30 dias.") (CT-14).
   Rode `pnpm --filter @atria/web exec vitest run src/features/finance src/features/reports` e confirme que os novos falham.
3. `finance-shell.tsx`: no `PeriodField` do cabeçalho, acrescente `label_visible={false}` (o `label` continua, para o nome acessível). Não mude mais nada no cabeçalho.
4. `list-toolbar.tsx`: troque `className={styles.filters}` do `div role="group"` dos filtros por `className={styles.filterFields}`; o `div` externo continua com `styles.filters`. `finance.module.css`: apague a regra `.filters > *` (linhas 82 a 84) e acrescente `.filterFields { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--s3); }` e `.filters > [role='search'], .filterFields > * { min-width: calc(var(--space) * 40); }`. O `ViewSwitcher` fica só com a largura das opções.
5. `panel-charts.tsx`: nas duas tabelas, troque `<table className={styles.srOnly}>…</table>` por `<div className={styles.srOnly}><table>…</table></div>`. Em `report-result.tsx`, o mesmo com `styles.visuallyHidden` nas duas tabelas. Assim o `caption` fica dentro do contêiner recortado, que o Firefox não deixa escapar.
6. `i18n/pt-br.json` do Financeiro: `"panel.upcoming": "Próximas movimentações"`, `"panel.upcoming_empty": "Nenhuma movimentação prevista nos próximos 30 dias."`; troque `"panel.upcoming_all"` por `"panel.upcoming_all_income": "Ver entradas"` e `"panel.upcoming_all_expense": "Ver saídas"` (confira com `grep -rn "upcoming_all" apps/web/src` que nada mais usa a chave antiga).
7. `finance-panel-screen.tsx`, fn `Upcoming`: troque `bills` por `items` (mesmo `summary.upcoming_bills`); cada item mostra a descrição ou `t(`finance.transactions.no_description_${item.kind}`)`, e na linha de baixo `${t(`finance.kind.${item.kind}`)} · ${date}` (ou o texto de atrasada, como hoje); o valor da entrada leva `className={styles.positive}` e o da saída fica sem classe (sem vermelho, [project/frontend-14]). No lugar do link único, um `<p className={styles.more}>` com os dois links `Link to="/finance/income" search={{ period: 'next_30_days' }}` ("Ver entradas") e `Link to="/finance/expenses" search={{ period: 'next_30_days' }}` ("Ver saídas"), separados por `gap` (use `.more` com `display: flex; gap: var(--s3)` no CSS do painel).
8. `finance-panel-screen.tsx`, fn `FinancePanelScreen`: crie no arquivo `function panelCells(main: readonly Block[], side: readonly Block[])`, com `type Block = { id: string; node: ReactNode }`, que devolve as células como a `dashboardCells` da TASK-08 (linha pelo índice na zona, `alone` sem par, zona principal primeiro). A zona principal é `[Closing, WhereItWent, ExpectedVsSettled]` e a lateral `[Balance, Cards (só com cartões), Upcoming, Savings]`. Renderize `<section className={styles.zones} aria-label={t('finance.tabs.panel')}>` com uma `<div className={styles.cell} data-zone=… data-row=… {...(alone ? { 'data-alone': '' } : {})}>` por célula. Faça o mesmo no estado de erro, com os seis `failed(...)`.
9. `finance-panel-screen.module.css`: troque `.zones`, `.zone` e `.zone > :last-child` por `.zones { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--s5); align-items: stretch; }`, `.cell { display: flex; min-width: 0; }`, `.cell > * { flex: 1 1 auto; min-width: 0; }`, `.cell[data-zone='main'] { grid-column: 1; }`, `.cell[data-zone='side'] { grid-column: 2; }`, `.cell[data-alone] { grid-column: 1 / -1; }`, `.cell[data-row='1']` a `.cell[data-row='4']` com `grid-row` de 1 a 4, e no `@media (max-width: 960px)` existente `.zones { grid-template-columns: minmax(0, 1fr); }` e `.cell[data-zone], .cell[data-row] { grid-column: 1; grid-row: auto; }`. Só tokens do tema. Rode os testes do passo 2 até passarem.
10. `apps/web/scripts/evidence-finance.mjs`:
    - troque o padrão de `OUT` para `vostok/work/tasks/SPEC-002/evidence/TASK-17` (mantendo `process.env.VOSTOK_EVIDENCE ??` da TASK-16) e atualize o comentário do topo;
    - na fixture `summary()`, acrescente a `upcoming_bills` uma entrada recorrente prevista para daqui a 7 dias do relógio fixo (`kind: 'income'`, descrição "Salário", `status: 'forecast'`, com a forma dos itens que já existem);
    - acrescente cenários com `group: 'painel'` em `/finance`: `Painel com Cartões` e `Painel sem Cartões` (`world` sem `credit_cards`), `combos: ALL`, que conferem em desktop `cards pareados com topos e bases alinhados` (para cada `data-row` com duas células, `top` e `bottom` dos dois cards com diferença de até 1 px) e em 360 px `uma coluna com a zona principal primeiro`; `Próximas movimentações` (o bloco com o título "Próximas movimentações" lista "Salário" com "Entrada" e uma saída com "Saída"); `período no cabeçalho` (o botão de período sem texto "Período" visível, com nome acessível com "Período", e com `top` e `bottom` iguais aos do botão "Relatórios", até 1 px); e `lista sem largura sobrando` em `/finance/expenses` (a largura do `group` "Visualização" é a soma dos botões mais as bordas, até 4 px de folga, e cada botão tem `title` e um `svg`);
    - acrescente `tabela dos gráficos sem texto solto`, que confere que todo `caption` da página tem `getBoundingClientRect()` com largura e altura de até 1 px e não aparece no `elementFromPoint` do centro do card;
    - registre em `EVIDENCES` a chave `painel`: roda `scenarios.filter((sc) => sc.group === 'painel')` no Chromium e, num segundo navegador `firefox` (de `@playwright/test`), roda só `Painel com Cartões` e `tabela dos gráficos sem texto solto` em desktop nos dois temas, com o rótulo `· Firefox` no `tag`, e grava `finance-painel.png`; atualize a mensagem de uso para "Use telas, formulario ou painel".
11. Instale o Firefox do Playwright, se ainda não houver: `pnpm --filter @atria/web exec playwright install firefox` (a TASK-06 também usa esse navegador).
12. Rode o bloco de "Verificação" e corrija até passar sem warnings. Depois rode `node apps/web/scripts/evidence-finance.mjs painel` e `node apps/web/scripts/evidence-finance.mjs telas`, corrija o código da tarefa a cada linha `FALHA` até a última linha ser `ok  0 falha(s)` e abra a prancha `finance-painel.png` para conferir as linhas pareadas, o período e as Próximas movimentações nos dois temas e larguras.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance src/features/reports --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep -v 'keeps the two zones in one column below 960 px' | sort`
- `pnpm --filter @atria/web exec vitest run src/features/finance/screens/finance-panel-screen.test.tsx --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep 'keeps the two zones in one column below 960 px'` (muda): o teste das zonas empilhadas é trocado pelos testes das linhas pareadas (resposta 2A).
- `pnpm --filter @atria/web exec eslint src/features/finance src/features/reports --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance src/features/reports scripts/evidence-finance.mjs 2>&1 | tail -1`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`

### Verificação

```bash
# Testes do Financeiro e dos relatórios (Vitest + Testing Library + axe)
# evidência: painel-testes.txt
pnpm --filter @atria/web exec vitest run src/features/finance src/features/reports --reporter=verbose
# Lint, formatação e tipos sem nenhum erro ou warning
pnpm --filter @atria/web exec eslint src/features/finance src/features/reports --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/finance src/features/reports scripts/evidence-finance.mjs
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-finance.mjs
# Nenhuma cor literal nos CSS do Financeiro
! grep -nE '#[0-9a-fA-F]{3,6}\b|rgba?\(' apps/web/src/features/finance/components/finance.module.css apps/web/src/features/finance/screens/finance-panel-screen.module.css
```

### Evidências

- `painel-testes.txt` (automática, da verificação)
  - Prova: período sem rótulo visível, seletor sem largura sobrando, cards do painel em linhas pareadas com e sem Cartões, tabela dos gráficos dentro do contêiner invisível e Próximas movimentações com entradas e saídas (RF-04, RF-05, RF-09, RF-10, RF-15, CT-04, CT-08, CT-09, CT-14).
  - Trecho: as linhas `✓` de `keeps the view switcher only as wide as its options`, `shows the period without a visible label in the header`, `keeps the chart table inside a visually hidden container`, `keeps the report chart table inside a visually hidden container`, `pairs the panel cards in rows`, `pairs the panel cards in rows with the cards block`, `keeps one column below 960 px with the main zone first`, `lists upcoming incomes and expenses for the next 30 days` e `shows balance, cards, upcoming bills and savings and losses`, e o resumo sem falhas.
  - Falha: `FAIL`, `×` em algum teste ou um desses nomes ausente.
- `finance-painel.png` (print): `node apps/web/scripts/evidence-finance.mjs painel`
  - Prova: no Financeiro montado com a API simulada, os cards do painel lado a lado com a mesma altura, com e sem Cartões, o período alinhado aos botões sem rótulo visível, o seletor só com ícones e sem largura sobrando, as Próximas movimentações com a entrada recorrente e nenhum texto solto dos gráficos no Chromium e no Firefox, nos dois temas (RF-04, RF-05, RF-09, RF-10, RF-15, CT-04, CT-08, CT-09, CT-14, RNF-02, RNF-06).
  - Trecho: as linhas `ok ... cards pareados com topos e bases alinhados`, `ok ... período no cabeçalho`, `ok ... lista sem largura sobrando`, `ok ... Próximas movimentações`, `ok ... tabela dos gráficos sem texto solto · Firefox` e `ok ... axe sem violações`, a linha `png:` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (caption visível no Firefox, cards da mesma linha com alturas diferentes, período fora do alinhamento), `Executable doesn't exist` do Firefox, a ausência da linha `png:` ou código de saída diferente de 0.

### Concluída quando

- [x] O botão de período fica alinhado a Relatórios e Novo registro, sem rótulo visível e com nome acessível (RF-04, CT-04).

  > Como comprovar: em `painel-testes.txt`, ver aprovado `shows the period without a visible label in the header`; em `finance-painel.png`, a linha `período no cabeçalho` com `ok`.

- [x] O seletor de visualização das listas do Financeiro mostra só os ícones e ocupa só a largura das opções (RF-05).

  > Como comprovar: em `painel-testes.txt`, ver aprovado `keeps the view switcher only as wide as its options`; em `finance-painel.png`, a linha `lista sem largura sobrando` com `ok`.

- [x] Os cards do painel ficam em linhas pareadas, com a mesma altura e topos e bases alinhados, com e sem o card de Cartões (RF-09, CT-08).

  > Como comprovar: em `painel-testes.txt`, ver aprovados `pairs the panel cards in rows`, `pairs the panel cards in rows with the cards block` e `keeps one column below 960 px with the main zone first`; em `finance-painel.png`, a linha `cards pareados com topos e bases alinhados` com `ok` nos cenários com e sem Cartões.

- [x] A tabela acessível dos gráficos fica invisível em todos os navegadores, sem texto solto no card, no painel e nos relatórios (RF-10, CT-09).

  > Como comprovar: em `painel-testes.txt`, ver aprovados `keeps the chart table inside a visually hidden container` e `keeps the report chart table inside a visually hidden container`; em `finance-painel.png`, a linha `tabela dos gráficos sem texto solto · Firefox` com `ok`.

- [x] O painel mostra "Próximas movimentações" com entradas e saídas previstas para os próximos 30 dias (RF-15, CT-14).

  > Como comprovar: em `painel-testes.txt`, ver aprovado `lists upcoming incomes and expenses for the next 30 days`; em `finance-painel.png`, a linha `Próximas movimentações` com `ok` e "Salário" listado como entrada.

- [x] As telas seguem acessíveis nos dois temas e em 360 px, e lint, formatação e tipos passam sem warning (RNF-03).

  > Como comprovar: em `finance-painel.png`, a última linha `ok  0 falha(s)`; o bloco de "Verificação" termina sem erro.

## Descrição

### Resumo executivo

Ajusta o painel e as listas do Financeiro: o período fica alinhado aos botões do cabeçalho, o seletor de visualização mostra só ícones e os cards do painel ficam alinhados em linhas.
O painel passa a mostrar "Próximas movimentações", com as entradas e as saídas previstas dos próximos 30 dias, e os gráficos deixam de mostrar texto solto no Firefox.
Perfil padrão, risco baixo: muda a tela do painel e das listas, sobre dados que o servidor já entrega.
Depende dos ícones, do período, das próximas movimentações no servidor e do formulário (TASK-03, TASK-05, TASK-10 e TASK-16); é a última tarefa do Financeiro.

### Detalhes técnicos

**Abordagem.** O cabeçalho usa o `PeriodField` com `label_visible={false}` (TASK-05). Na barra das listas, a largura mínima passa a valer só para a busca e os campos de filtro, e o seletor da TASK-03 fica com a largura das opções. O painel ganha a grade de linhas pareadas da TASK-08 (células com `data-zone`, `data-row` e `data-alone`). As tabelas acessíveis dos gráficos, no painel e nos relatórios, passam a ficar dentro de um `div` recortado. O bloco "Próximas contas" vira "Próximas movimentações" e mostra o tipo de cada item, sobre o mesmo campo `upcoming_bills`, que a TASK-10 passou a encher com entradas e saídas.

**Causa confirmada.** A regra `.filters > *` dava largura mínima ao seletor; o painel empilhava os cards por coluna e só o último crescia (PD-58); no Firefox, o `caption` de uma `table` com a classe de leitor de tela escapa do recorte; "Próximas contas" só trazia saídas (Estado atual).

**Componentes.** `finance-shell.tsx`, `list-toolbar.tsx`, `finance.module.css`, `panel-charts.tsx`, `finance-panel-screen.tsx` e o CSS dele, `report-result.tsx`, `i18n/pt-br.json` do Financeiro, os testes vizinhos e o script `evidence-finance.mjs`.

**Decisões.**
- Linhas pareadas como no dashboard (resposta 2A); com Cartões, a zona lateral tem quatro cards e "Economias e perdas" ocupa sozinho a última linha. Descartado: juntar Saldo e Cartões num card, que mudaria o conteúdo dos blocos.
- Tabela dentro de um contêiner recortado, sem mudar `.srOnly` nem `visuallyHidden`. Descartado: `display: none` na tabela, que a tiraria também do leitor de tela.
- Dois links no bloco (Ver entradas e Ver saídas), porque as listas de entradas e saídas são abas separadas. Descartado: o link único para Saídas, que esconderia as entradas.
- Valor da entrada em verde (`positive`) e o da saída sem cor, sem vermelho para pendência comum ([project/frontend-14]).
- O período padrão do painel continua "Este mês": as Próximas movimentações cobrem os 30 dias seguintes em qualquer período.

**Evidências visuais.** O script `apps/web/scripts/evidence-finance.mjs` ganha a evidência `painel`, que roda no Chromium e repete no Firefox o painel e a verificação do `caption` (RNF-06), com o Firefox do Playwright instalado no passo 11.

**Riscos.** O download do Firefox do Playwright precisa de rede. Se a TASK-05 der outro nome à prop do rótulo, use o do `PeriodFieldProps` exportado. No baseline, o print roda com o script da TASK-16, que não conhece `painel` e sai com código 2.

**Referências.** RF-04, RF-05, RF-09, RF-10, RF-15; CT-04, CT-08, CT-09, CT-14; RNF-02, RNF-06; decisões 2 e 4 (respostas 2A e 4A); PD-55, PD-57, PD-58.

**Arquivos em comum na onda 5.** Nenhum: é a única tarefa da onda. `i18n/pt-br.json` do Financeiro e `evidence-finance.mjs` foram mudados antes pela TASK-16, de que esta depende.

### Card

- **Título:** Painel e listas do Financeiro
- **Tipo:** bug
- **Descrição:** Painel e listas do Financeiro com período alinhado, seletor só com ícones, cards pareados, gráficos sem texto solto e "Próximas movimentações" com entradas e saídas.
- **Critérios de aceite:**
  - [ ] Período alinhado aos botões do cabeçalho, sem rótulo visível.
  - [ ] Seletor de visualização só com ícones e sem largura sobrando.
  - [ ] Cards do painel com a mesma altura em cada linha, com e sem Cartões.
  - [ ] Nenhum texto solto dos gráficos no Firefox e no Chromium.
  - [ ] "Próximas movimentações" com entradas e saídas dos próximos 30 dias.
  - [ ] Telas acessíveis nos dois temas e em 360 px.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-03, TASK-05, TASK-10, TASK-16

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 6 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 com acréscimo; 1 mudança(s) esperada(s) |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | conferência | usuário | print finance-painel.png conferido pelo usuário (sha256 f09a8ea8) |
| 7 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-17/ |
| 8 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
