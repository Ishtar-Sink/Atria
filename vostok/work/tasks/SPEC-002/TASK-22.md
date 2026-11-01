---
id: TASK-22
spec: SPEC-002
title: "Levantamento das ações demoradas"
profile: padrao
persona: arquiteto
depends_on: [TASK-04]
wave: 3
covers: [RF-24, CT-23]
type: tarefa
labels: [SPEC-002, padrao]
status: done
content_hash: 45feb225ce09a8456171c0063fd6f4703ccad9beb0b117a408ab8aafe0efee78
adjustments: 1
adjusted_at: 2026-11-01T12:22:21Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: 38da3b0275839d5e7990ca23146f0bb1fb3ff4df34812e54e008be944e1dd868
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T12:22:21Z
---

# TASK-22: Levantamento das ações demoradas

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Acervo e leitor: o `Button` com `loading` só desabilita), RF-24, RF-25, RF-26, CT-23, CT-24, CA-12, o "Fluxo principal" e a decisão 14 (inferência F, "Carregando, progresso e aviso; levantamento primeiro") do "Registro de decisões".
- `vostok/work/tasks/SPEC-002/`: as tarefas que aplicam o padrão nas outras telas (TASK-04 botão carregando, TASK-16 aviso ao salvar com Repetir, TASK-21 envio com progresso, TASK-23 primeira página do PDF, TASK-24 diálogos, TASK-28 aviso ao salvar tarefa); ler o título e o "Resumo executivo" de cada uma.
- `vostok/work/tasks/SPEC-002/TASK-04.md` e `packages/ui/src/button/button.tsx`: o `Button` com `loading`, indicador visível, `aria-busy` e segundo clique ignorado (RF-25).
- `vostok/rules/project/frontend.md`: [project/frontend-09], [project/frontend-12], [project/frontend-14] e [project/frontend-18].
- `vostok/rules/project/language.md`: [project/language-01], [project/language-02] e [project/language-06].
- `vostok/rules/project/code-style.md`: [project/code-style-09].
- `apps/web/src/features/reports/report-page.tsx`: `ReportActions` (exportar PDF), `ReportView` e `ResultArea` (gerar e mostrar o resultado).
- `apps/web/src/features/reports/use-file-download.ts`: `useFileDownload`, usado também por `apps/web/src/features/reports/exports-page.tsx`.
- `apps/web/src/features/reports/report-filters.tsx` (botão "Gerar relatório" com `loading`): só leitura.
- `apps/web/src/features/reports/report-page.test.tsx` (fn `stubServer`, testes `exports the pdf with the period and the filters`, `shows the loading state while exporting`, `shows the error inside the page with role alert when the export fails` e `shows the loading state while the report loads`) e `apps/web/src/features/reports/exports-page.test.tsx`.
- `apps/web/src/features/reports/i18n/pt-br.json`: chaves `reports.export_*`, `reports.loading` e `reports.exports.*`.
- `apps/web/src/shared/toast/toast-store.ts`: `pushToast` com `tone: 'success'`.
- `apps/web/src/features/reports/evidence/harness.tsx`: página de evidência das rotas de Relatórios (só leitura).
- `apps/web/scripts/evidence-reports.mjs`: molde do script de evidência; ler por trecho: `startVite`, a API simulada, `openPage`, `baseChecks`, `gotoApp` e `sheet`.
- `docs/decisoes-do-prototipo.md` e `docs/glossario.md`: molde de documento do projeto (título, introdução curta e tabelas) e os nomes das telas em pt-br.

### Mudar

- `docs/acoes-demoradas.md` (criar): levantamento das ações demoradas do app, com o padrão aplicado a cada uma e a tarefa que o aplica (RF-24, CT-23).
- `apps/web/src/features/reports/report-page.tsx` (alterar): padrão de carregando nos relatórios: resultado marcado como ocupado enquanto gera e aviso de sucesso ao exportar o PDF (RF-24).
- `apps/web/src/features/reports/use-file-download.ts` (alterar): `download` devolve se o arquivo foi salvo e mostra o aviso de sucesso, o que vale também para "Exportar meus dados"; entra além do componente do plano porque a lógica do download fica no hook ([project/code-style-09]).
- `apps/web/src/features/reports/i18n/pt-br.json` (alterar): textos dos avisos de sucesso e do rótulo da área do resultado.
- `apps/web/src/features/reports/report-page.test.tsx` (alterar): testes do aviso de sucesso e do resultado ocupado.
- `apps/web/src/features/reports/exports-page.test.tsx` (alterar): teste do aviso de sucesso ao exportar os dados.
- `apps/web/scripts/evidence-report-loading.mjs` (criar): print da página de relatório gerando, exportando, com o aviso de sucesso e com o erro, gravado no caminho recebido como argumento.

### Passos

1. Fazer o levantamento, sem mudar código: listar as ações que esperam o servidor por mais que um instante com `grep -rn 'loading={' apps/web/src --include='*.tsx' | grep -v '\.test\.'`, `grep -rln 'useFileDownload\|uploadRaw\|loadPdf' apps/web/src | grep -v '\.test\.'` e `grep -rn 'isFetchingNextPage' apps/web/src --include='*.tsx' | grep -v '\.test\.'`, e conferir no código de cada uma o que ela mostra hoje (botão em carregando, `LoadingState`, barra, aviso de sucesso, erro com `role="alert"` ou toast). Partir desta lista, conferindo cada item no código: salvar os formulários (`FormActions` com `loading`); salvar movimentação com Repetir; liquidar movimentação e desfazer a liquidação; salvar tarefa; enviar capa ou miniatura; enviar PDF; abrir o PDF no leitor; registrar a sessão de leitura; gerar relatório; exportar o PDF do relatório; exportar meus dados (JSON e CSV); carregar mais nas listas paginadas; entrar, cadastrar, segundo fator e redefinir senha; salvar as Configurações da instância; criar convite; excluir raia com cartões.
2. Criar `docs/acoes-demoradas.md`, em pt-br, no molde de `docs/decisoes-do-prototipo.md`:
   - Título `# Ações demoradas do Atria` e uma introdução de até 3 linhas: levantamento do Bug 20 da SPEC-002 (RF-24, inferência F), data e o método (os comandos do passo 1).
   - `## Padrão`: tabela `| Situação | Padrão |` com: espera curta sem medida (botão em carregando com indicador visível e `aria-busy`, segundo clique ignorado, `Button` da `@atria/ui`, TASK-04); conteúdo que carrega (`LoadingState` no lugar do conteúdo e a área com `aria-busy`); envio de arquivo (barra de progresso, TASK-21); fim de uma ação cujo resultado não aparece na tela (aviso de sucesso por toast); falha (mensagem com `role="alert"` no formulário ou toast de erro, e o botão volta a aceitar a ação).
   - `## Levantamento`: tabela `| Ação | Tela | Por que demora | Carregando | Progresso | Aviso de sucesso | Erro | Onde é aplicado |`, uma linha por ação do passo 1; em "Onde é aplicado", a tarefa da SPEC-002 que aplica o padrão (TASK-04, TASK-16, TASK-21, TASK-22, TASK-23, TASK-24 ou TASK-28) ou "já atende" quando o código já segue o padrão; nas colunas de padrão, "sim", "não se aplica" ou o que falta.
   - `## Fora desta spec`: as ações do levantamento que nenhuma tarefa da SPEC-002 cobre e ainda não seguem o padrão, cada uma com o que falta, para entrar por ajuste da spec; se não houver, a frase "Nenhuma: todas as ações levantadas são cobertas pela SPEC-002."
   - Nomes das telas como aparecem no app (glossário), sem caminhos de arquivo nas tabelas.
3. Acrescentar em `apps/web/src/features/reports/i18n/pt-br.json`: `export_done` ("PDF do relatório baixado."), `download_done` ("Arquivo baixado.") e `result_label` ("Resultado do relatório").
4. Escrever os testes antes do código:
   - `report-page.test.tsx`: acrescentar `shows a success notice after the pdf is exported` (depois de "Exportar PDF", o toast "PDF do relatório baixado." aparece e nenhum `alert` de erro), `does not show the success notice when the export fails` (`file_mode: 'error'`) e `marks the result as busy while the report is generated` (a região "Resultado do relatório" com `aria-busy="true"` enquanto a resposta do relatório não chega e sem ele depois); não renomear os testes existentes.
   - `exports-page.test.tsx`: acrescentar `shows a success notice after the export` (toast "Arquivo baixado." depois de "Exportar JSON").
5. Rodar `pnpm --filter @atria/web exec vitest run src/features/reports` e confirmar que os testes novos falham por falta da implementação.
6. Alterar `use-file-download.ts`: `DownloadRequest` ganha `success_key?: string`; `download` passa a devolver `Promise<boolean>`: `true` depois de `save(...)`, quando chama `pushToast({ tone: 'success', message_key: success_key ?? 'reports.download_done' })`, e `false` no `catch`, sem aviso de sucesso; o estado de erro e o `is_loading` continuam iguais.
7. Alterar `report-page.tsx`: em `ReportActions`, passar `success_key: 'reports.export_done'` ao `download`; o botão "Exportar PDF" continua com `loading={is_loading}` (indicador da TASK-04); em `ResultArea`, envolver o conteúdo gerado (estado de carregando, erro e resultado, quando `search.run`) num `<section aria-label={t('reports.result_label')} aria-busy={result.isFetching || undefined}>`; o estado "não gerado" fica fora dessa região. Não mexer em `report-filters.tsx`: o "Gerar relatório" já recebe `loading={result.isFetching}`.
8. Rodar `pnpm --filter @atria/web exec vitest run src/features/reports` até passar; depois `pnpm --filter @atria/web typecheck`, o ESLint e o Prettier da Verificação, sem nenhum warning.
9. Criar `apps/web/scripts/evidence-report-loading.mjs`, em Node sem dependências novas, com código próprio no molde de `apps/web/scripts/evidence-reports.mjs` (sem importá-lo): uso `node apps/web/scripts/evidence-report-loading.mjs <caminho.png>`; sobe o Vite numa porta livre com a página virtual que carrega `src/features/reports/evidence/harness.tsx` e encerra ao fim (KNW-006); simula a API com o relatório `fin-flow` (resposta segurada até o script liberar), o PDF (`format=pdf`, segurado e depois liberado com bytes de PDF, e um caso com 500); temas claro e escuro, em 1280 px e 360 px; em `/reports/fin-flow?run=1`, captura: gerando (região "Resultado do relatório" com `aria-busy="true"`, `LoadingState` visível e "Gerar relatório" com `aria-busy="true"`); exportando ("Exportando…" com `aria-busy="true"` e o indicador visível do botão); exportado (toast "PDF do relatório baixado."); e falha (mensagem com `role="alert"` e o botão "Exportar PDF" de novo disponível). Confere o tema, a falta de rolagem horizontal, a falta de erro de JS e o axe sem violações (inclui `color-contrast`); imprime `ok` ou `FALHA` por verificação, monta a prancha rotulada no caminho do argumento, imprime `png: <caminho> (N capturas)` e a última linha `ok  0 falha(s)`, e sai com código 1 se algo falhar.
10. Rodar o comando de print de "Evidências" com `VOSTOK_EVIDENCE` apontando para uma pasta temporária, corrigir o código da tarefa a cada `FALHA` e abrir a prancha para conferir.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/reports --reporter=verbose 2>/dev/null | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/reports --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/reports`

### Verificação

```bash
# evidência: reports-loading-tests.txt
pnpm --filter @atria/web exec vitest run src/features/reports --reporter=verbose
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/reports --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/reports scripts/evidence-report-loading.mjs
node --check apps/web/scripts/evidence-report-loading.mjs
test -s docs/acoes-demoradas.md
```

### Evidências

- `acoes-demoradas.diff` (diff): `docs/acoes-demoradas.md`
  - Prova: o levantamento das ações demoradas está registrado, com o padrão de cada uma e a tarefa que o aplica, e o que fica fora da spec (RF-24, CT-23).
  - Trecho: as seções `## Padrão`, `## Levantamento` (uma linha por ação, com "Onde é aplicado" preenchido) e `## Fora desta spec`.
  - Falha: diff vazio, tabela sem a coluna "Onde é aplicado" ou ação sem padrão.
- `reports-loading-tests.txt` (automática, da verificação)
  - Prova: os testes de Relatórios passam, com o resultado ocupado enquanto gera, o botão em carregando ao exportar, o aviso de sucesso ao exportar o PDF e os dados, e nenhum aviso de sucesso na falha (RF-24, CT-23).
  - Trecho: `shows a success notice after the pdf is exported`, `does not show the success notice when the export fails`, `marks the result as busy while the report is generated` e `shows a success notice after the export` aprovados, e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `report-loading.png` (print): `node apps/web/scripts/evidence-report-loading.mjs "$VOSTOK_EVIDENCE/report-loading.png"`
  - Requer: `apps/web/scripts/evidence-report-loading.mjs`
  - Prova: a página de relatório segue o padrão do levantamento: gerando com o resultado ocupado e o botão em carregando, exportando com o indicador visível, o aviso de sucesso e o erro no fim, nos dois temas e nas duas larguras (RF-24, CT-23).
  - Trecho: linhas `ok` de "resultado com aria-busy", "Gerar relatório em carregando", "Exportando… com aria-busy", "aviso PDF do relatório baixado.", "erro com role alert" e "axe sem violações (inclui color-contrast)", a linha `png:` e a última `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA`, a falta da linha `png:` ou código de saída diferente de 0.

### Concluída quando

- [x] O levantamento das ações demoradas está registrado em `docs/acoes-demoradas.md`, com o padrão aplicado a cada ação, a tarefa que o aplica e o que fica fora da spec (RF-24, CT-23).

  > Como comprovar: abrir o diff `acoes-demoradas.diff` e ver as seções "Padrão", "Levantamento" e "Fora desta spec", com uma linha por ação e a coluna "Onde é aplicado" preenchida em todas.

- [x] Na página de relatório, gerar mostra o resultado ocupado e o botão em carregando, e exportar o PDF mostra o botão em carregando e, no fim, o aviso de sucesso ou o erro (RF-24, CT-23).

  > Como comprovar: em `reports-loading-tests.txt`, ver aprovados `marks the result as busy while the report is generated`, `shows a success notice after the pdf is exported`, `does not show the success notice when the export fails` e os testes existentes de carregando e erro; na prancha `report-loading.png`, ver os quatro estados.

- [x] "Exportar meus dados" também avisa quando o arquivo foi baixado (RF-24).

  > Como comprovar: ver aprovado `shows a success notice after the export` em `reports-loading-tests.txt`.

- [x] A página de relatório não tem violações no axe nos dois temas e a partir de 360 px (RNF-03).

  > Como comprovar: ver aprovado `has no axe violations` em `report-page.test.tsx`; na prancha, só linhas `ok` e a última `ok  0 falha(s)`.

- [x] Testes, typecheck, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a Verificação e ver que termina sem erro.

## Descrição

### Resumo executivo

Registra num documento todas as ações do Atria que fazem a pessoa esperar (envios, relatórios, exportações e salvamentos), com o retorno visual que cada uma deve dar e a tarefa que cuida dele.
Aplica esse padrão na página de relatório: o resultado aparece como ocupado enquanto gera, e exportar mostra o carregando e avisa quando o arquivo foi baixado.
Dá a base para conferir que nenhuma ação demorada fica sem retorno, como o usuário relatou.
Perfil padrão, risco baixo; depende do botão com carregando visível e não bloqueia outras tarefas.

### Detalhes técnicos

- **Abordagem:** primeiro o levantamento, por busca no código das ações com `loading`, envio de arquivo, download e paginação, registrado em `docs/acoes-demoradas.md` com o padrão (carregando, progresso, aviso de sucesso, erro) e a tarefa da SPEC-002 que aplica cada um; depois o padrão na página de relatório: região do resultado com `aria-busy` durante a geração e aviso de sucesso por toast no fim do download.
- **Componentes:** `docs/acoes-demoradas.md` (novo), `report-page.tsx`, `use-file-download.ts` e `i18n/pt-br.json` de Relatórios; `Button` com `loading` da TASK-04 e `pushToast` do app, sem mudança neles.
- **Decisões:**
  - O documento fica em `docs/`, em pt-br ([project/language-01], [project/language-02]), ao lado de `decisoes-do-prototipo.md`; descartado registrá-lo só na tarefa, porque o padrão vale para as telas futuras.
  - O aviso de sucesso entra em `useFileDownload`, com a chave opcional `success_key`; descartado tratar em cada tela, que repetiria a lógica (a tela de exportação ganha o aviso sem mudar). Por isso `use-file-download.ts` entra em "Mudar" além do componente do plano.
  - `download` passa a devolver `boolean`; quem já chamava ignorando o retorno continua igual.
  - Sem barra de progresso nos relatórios: o servidor não informa o tamanho da geração; descartada uma barra estimada, que daria um progresso falso.
  - Ações que nenhuma tarefa cobre vão para "Fora desta spec", para ajuste da spec ([approve-plan-05], sem acrescentar escopo aqui).
- **Riscos:** o levantamento depende da busca por padrões de código; o passo 1 traz a lista de partida conferida no planejamento. O toast de sucesso vale para todo download de Relatórios, o que é o comportamento desejado.
- **Referências da spec:** RF-24, CT-23, CA-12, decisão 14 (inferência F); relaciona RF-25 (TASK-04) e RF-26 (TASK-21).
- **Evidências visuais:** um print gerado por `apps/web/scripts/evidence-report-loading.mjs` sobre o harness de Relatórios, conferido pelo usuário na finalização.
- **Arquivos em comum na onda 3:** nenhum.

### Card

- **Título:** Levantamento das ações demoradas
- **Tipo:** tarefa
- **Descrição:** Levantamento registrado das ações demoradas do app, com o padrão de carregando, progresso e aviso de cada uma, e o padrão aplicado à página de relatório e à exportação de dados.
- **Critérios de aceite:**
  - [ ] Documento do levantamento com cada ação, o padrão e a tarefa que o aplica.
  - [ ] Relatório com resultado ocupado ao gerar e botão em carregando ao exportar.
  - [ ] Aviso de sucesso ao exportar o PDF e os dados; erro sem aviso de sucesso.
  - [ ] Sem violações no axe, nos dois temas e a partir de 360 px.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 3 comando(s); códigos de saída: 0, 0, 0 |
| 3 | 2026-11-01 | ajuste | in_progress | ESLint da Verificação sem o script de evidência, que o eslint.config.js do web ignora (o aviso de arquivo ignorado virava erro com --max-warnings 0); o script segue conferido por node --check e Prettier |
| 4 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-11-01 | regressão | passed | 2 comando(s) iguais ao baseline; 1 com acréscimo |
| 6 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 7 | 2026-11-01 | conferência | usuário | print report-loading.png conferido pelo usuário (sha256 6e491f8b) |
| 8 | 2026-11-01 | evidências | passed | 3 evidência(s) em evidence/TASK-22/ |
| 9 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | ESLint da Verificação sem o script de evidência, que o eslint.config.js do web ignora (o aviso de arquivo ignorado virava erro com --max-warnings 0); o script segue conferido por node --check e Prettier |
