---
id: TASK-05
spec: SPEC-002
title: "Período e etiquetas na @atria/ui"
profile: padrao
persona: ui-ux-designer
depends_on: []
wave: 1
covers: [RF-04, RF-23, CT-22]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: d889b30781062830582267789cbf62bf0f0e6a8b9352d1e496d028b95d3677cb
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: bcaca0dc637b7c184cfaa7a60eeb155190de6b202bf866df43d53d140ed0da6b
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-05: Período e etiquetas na @atria/ui

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Componentes compartilhados: `PeriodField` sempre com rótulo e `TagField` com 4 px), RF-04, RF-23, CT-04, CT-22 e o contrato `PeriodFieldProps` (`label_visible`) em "Contratos e interfaces".
- `vostok/rules/project/frontend.md` ([project/frontend-02], [project/frontend-10]), `code-style.md` ([project/code-style-10]) e `testing.md` ([project/testing-04], [project/testing-10]).
- `prototype/atria-prototype.html` (mais de 400 linhas): linha 836 (o `.range-trigger` do cabeçalho do Financeiro, sem rótulo, ao lado de Novo registro), linhas 411 (`.btn`, 36 px) e 501 (`.range-trigger`), linhas 431-437 (`.field` com `gap: var(--s1)` e `.field-hint`), linhas 533-537 (`.tag-pills` com `gap: var(--s1)` e `margin: var(--s2) 0 0`), linha 1323 (fn `tagPill`) e linha 1384 (ordem campo, etiquetas, ajuda e erro).
- `packages/ui/src/period-field/period-field.tsx`, `period-field.module.css` e `period-field.test.tsx`.
- `packages/ui/src/tag-field/tag-field.tsx`, `tag-field.module.css` e `tag-field.test.tsx`.
- `packages/ui/src/page-header/page-header.tsx` e `packages/ui/src/button/button.tsx`: cabeçalho e botões ao lado do período.
- `apps/web/scripts/evidence-auth.mjs` (fn `freePort`, `virtualPage`, `startVite` e o bloco `principal`) e `apps/web/src/features/auth/evidence/harness.tsx`: molde do script e do harness de print, sem importar código deles.

### Mudar

- `packages/ui/src/period-field/period-field.tsx` (alterar): `label_visible`, com o rótulo só para leitor de tela no cabeçalho (RF-04).
- `packages/ui/src/period-field/period-field.module.css` (alterar): rótulo visualmente oculto e botão na altura dos botões ao lado (RF-04).
- `packages/ui/src/period-field/period-field.test.tsx` (alterar): testes do rótulo oculto.
- `packages/ui/src/tag-field/tag-field.module.css` (alterar): espaçamento do protótipo entre campo, etiquetas e ajuda (RF-23, CT-22).
- `packages/ui/src/tag-field/tag-field.test.tsx` (alterar): teste do espaçamento.
- `apps/web/scripts/evidence-fields.mjs` (criar): script de print do harness dos campos.
- `apps/web/src/app/dev/fields-harness.tsx` (criar): página de evidência do período no cabeçalho e do campo de etiquetas, nos temas claro e escuro.

### Passos

1. Leia os arquivos de "Ler". Rode o bloco de "Verificação" e confirme que ele falha.
2. Altere `period-field.test.tsx` acrescentando, e confirme que falham:
   - `hides the label visually but keeps it as the accessible name` (RF-04): com `label="Período"` e `label_visible={false}`, `getByRole('button', { name: /Período/ })` acha o botão (o nome é rótulo + valor), e o elemento do rótulo tem a classe `srOnly`.
   - `shows the label by default`: sem `label_visible`, o rótulo não tem `srOnly`.
   - `has no axe violations with the hidden label`.
   - `hides the label with the visually-hidden pattern and keeps the trigger 40 px tall`: lê `period-field.module.css` com `readFileSync(new URL('./period-field.module.css', import.meta.url), 'utf8')` e confere o bloco `.srOnly` com `position: absolute`, `width: 1px`, `height: 1px`, `overflow: hidden` e `clip-path: inset(50%)`, e o `.control` com `min-height: calc(var(--space) * 10)` e `box-sizing: border-box`.
3. Altere `tag-field.test.tsx` acrescentando `uses the prototype spacing between field, pills and help` (RF-23, CT-22), que lê `tag-field.module.css` com `readFileSync` e confere o bloco `.pills` com `gap: var(--s1)` e `margin: var(--s2) 0 0`, o `.root` com `gap: var(--s1)` e o `.help` com `margin: 0`. Confirme que falha.
4. Em `period-field.tsx`: acrescente `/** false: rótulo só para leitor de tela, como no cabeçalho de página (RF-04). */ label_visible?: boolean;` em `PeriodFieldProps`, com padrão `true` na desestruturação; o `span` do rótulo recebe `className={label_visible ? styles.label : styles.srOnly}`. O `aria-labelledby` do botão continua apontando para o rótulo e o valor.
5. Em `period-field.module.css`: acrescente `.srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }` (fora do fluxo, ele não abre o `gap` da coluna) e, no `.control`, `box-sizing: border-box;` para a altura de 40 px ser a mesma do `Button` ao lado (`min-height: calc(var(--space) * 10)`). Não mude o restante.
6. Em `tag-field.module.css`, como o `.tag-pills` do protótipo: `.pills { gap: var(--s1); margin: var(--s2) 0 0; }` (no lugar de `gap: calc(var(--space) * 2)` e `margin: 0`) e `.root { gap: var(--s1); }` (no lugar de `var(--space)`, mesmo valor, escrito com o token do protótipo). O `.help` continua com `margin: 0`. Comentário: campo, etiquetas 12 px abaixo (4 do `gap` mais 8 da margem) e ajuda 4 px abaixo, como no protótipo (Bug 19).
7. Rode `pnpm --filter @atria/ui exec vitest run src/period-field src/tag-field` e `pnpm --filter @atria/ui typecheck` até passarem.
8. Crie `apps/web/src/app/dev/fields-harness.tsx` (não importado pelo app): importa `../global.css` e, de `@atria/ui`, `PageHeader`, `PeriodField`, `Button`, `TagField`, `FormGrid` e `TextField`; monta com `createRoot` em `#root` dois painéis lado a lado (`display: 'grid'`, `gridTemplateColumns: '1fr 1fr'`), `data-theme="light"` e `data-theme="dark"`, com `background: 'var(--bg)'`, `color: 'var(--text)'` e `padding: 'var(--s6)'` (só tokens). Em cada painel:
   - um `PageHeader` `title="Financeiro"`, `eyebrow="Dinheiro"`, `subtitle="Contas, movimentações, faturas e um painel do mês."` com as ações `PeriodField` (`label="Período"`, `label_visible={false}`, `placement="toolbar"`, `today="2026-11-01"`, `locale="pt-BR"` e os rótulos de "Este mês" etc.), `Button` `Relatórios` e `Button variant="primary"` `Novo registro`;
   - um formulário com `TextField` `Título` e `TagField` `Etiquetas` com `value={['casa', 'mercado', 'mensal']}`, `help="Enter ou vírgula adiciona a etiqueta."`, `list_label="Etiquetas adicionadas"` e `remove_label={(tag) => \`Remover ${tag}\`}`.
   Depois de `document.fonts.ready`, num `useEffect`, publique em `window.__atria_fields_evidence` (declarado com `declare global` no próprio arquivo) e marque `document.documentElement.dataset['evidenceReady'] = 'true'` com as conferências `{ name, ok, detail }`, por tema:
   - `período alinhado aos botões ao lado (<tema>)`: topo e base do botão do período iguais aos de `Relatórios` e de `Novo registro`, com tolerância de 0,5 px (`detail` com os valores);
   - `rótulo do período invisível e no nome acessível (<tema>)`: o rótulo com largura de até 1 px e o `aria-labelledby` do botão citando o id dele, de texto `Período`;
   - `etiquetas 12 px abaixo do campo (<tema>)`: topo da lista menos a base do `input` = 12;
   - `4 px entre etiquetas (<tema>)`: entre a direita da primeira pill e a esquerda da segunda;
   - `ajuda 4 px abaixo das etiquetas (<tema>)`: topo da ajuda menos a base da lista = 4.
9. Crie `apps/web/scripts/evidence-fields.mjs`, em Node sem dependência nova (`@playwright/test`, `@axe-core/playwright` e `vite`, já do `apps/web`), no molde de `evidence-auth.mjs`, com código próprio (a TASK-03 cria um script parecido na mesma onda, sem dependência entre as duas). Uso: `node apps/web/scripts/evidence-fields.mjs <png>` (sem o argumento, imprime o uso e sai com 2). Ele sobe o Vite (`createServer({ root: WEB, logLevel: 'error', plugins: [páginaVirtual], server: { port: <porta livre>, strictPort: true, host: '127.0.0.1', proxy: {} } })`) com a página virtual `/__evidence-fields` que carrega `/src/app/dev/fields-harness.tsx` por `server.transformIndexHtml`; abre o Chromium em 1440 × 900; registra `pageerror`; espera `html[data-evidence-ready="true"]` por até 15 s; imprime `ok    <nome>` ou `FALHA <nome> · <detalhe>` de cada conferência de `window.__atria_fields_evidence`; confere `sem erro de JavaScript` e `axe sem violações` (`new AxeBuilder({ page }).analyze()`); cria a pasta do PNG, grava `page.screenshot({ path: png, fullPage: true, animations: 'disabled' })`, imprime `png: <caminho>` e termina com `ok  0 falha(s)` ou `FALHA  N falha(s)`, saindo com 1 se algo falhou; fecha o navegador e o Vite num `finally`.
10. Rode `node apps/web/scripts/evidence-fields.mjs /tmp/atria-periodo-e-etiquetas.png` até a última linha ser `ok  0 falha(s)`, corrigindo o código da tarefa a cada `FALHA`, e abra o PNG.
11. Rode o lint e o Prettier dos arquivos de "Mudar" e o bloco de "Verificação" até terminar sem erro.

### Baseline

- `pnpm --filter @atria/ui exec vitest run src/period-field src/tag-field --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/ui typecheck`
- `pnpm --filter @atria/ui exec eslint src/period-field src/tag-field --max-warnings 0`
- `pnpm --filter @atria/ui exec prettier --check src/period-field src/tag-field`
- `pnpm --filter @atria/web exec vitest run src/shared/forms src/features/finance/screens/finance-panel-screen src/features/notes/screens --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`

### Verificação

```bash
# evidência: ui-tests.txt
pnpm --filter @atria/ui exec vitest run src/period-field src/tag-field --reporter=verbose
pnpm --filter @atria/ui typecheck
pnpm --filter @atria/ui exec eslint src/period-field src/tag-field --max-warnings 0
pnpm --filter @atria/ui exec prettier --check src/period-field src/tag-field
pnpm --filter @atria/web exec vitest run src/shared/forms src/features/finance/screens/finance-panel-screen src/features/notes/screens
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/app/dev/fields-harness.tsx --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/app/dev/fields-harness.tsx scripts/evidence-fields.mjs
node --check apps/web/scripts/evidence-fields.mjs
```

Resultado esperado: código 0; no primeiro comando, as linhas `✓` de `period-field.test.tsx` e `tag-field.test.tsx` e nenhuma `×`.

### Evidências

- `ui-tests.txt` (automática, da verificação)
  - Prova: o período no cabeçalho esconde o rótulo só da vista e o mantém no nome acessível, e o campo de etiquetas tem o espaçamento do protótipo (RF-04, RF-23, CT-22).
  - Trecho: `✓ src/period-field/period-field.test.tsx > PeriodField > hides the label visually but keeps it as the accessible name`, `has no axe violations with the hidden label` e `✓ src/tag-field/tag-field.test.tsx > TagField > uses the prototype spacing between field, pills and help`.
  - Falha: uma linha `×`, `FAIL` ou `No test files found`.
- `periodo-e-etiquetas.png` (print): `node apps/web/scripts/evidence-fields.mjs "$VOSTOK_EVIDENCE/periodo-e-etiquetas.png"`
  - Prova: no navegador, o botão de período fica alinhado a Relatórios e Novo registro sem rótulo visível, e as etiquetas e a ajuda têm o espaçamento do protótipo, nos temas claro e escuro (RF-04, RF-23, CT-22).
  - Trecho: na imagem, o cabeçalho "Financeiro" com Este mês, Relatórios e Novo registro na mesma linha e altura, e o campo Etiquetas com as três pills abaixo e a ajuda; na saída, `ok    período alinhado aos botões ao lado (claro)`, `ok    etiquetas 12 px abaixo do campo (claro)`, `ok    ajuda 4 px abaixo das etiquetas (escuro)`, `ok    axe sem violações` e a última `ok  0 falha(s)`.
  - Falha: o rótulo "Período" visível ou o botão mais baixo que os outros, pills coladas no campo, uma linha `FALHA` ou a última linha `FALHA  N falha(s)`.
  - Requer: `apps/web/scripts/evidence-fields.mjs`, `apps/web/src/app/dev/fields-harness.tsx`

### Concluída quando

- [x] No cabeçalho, o `PeriodField` mostra só o botão de período, alinhado aos botões ao lado, com o rótulo lido pelo leitor de tela (RF-04).

  > Como comprovar: no `periodo-e-etiquetas.png`, ver o botão do período na linha de Relatórios e Novo registro, sem "Período" escrito; em `ui-tests.txt`, ver `✓` em `hides the label visually but keeps it as the accessible name`.

- [x] Fora do cabeçalho, o `PeriodField` continua com o rótulo visível.

  > Como comprovar: em `ui-tests.txt`, ver `✓` em `shows the label by default` e nos casos antigos do `PeriodField`.

- [x] O `TagField` tem o espaçamento do protótipo: etiquetas 12 px abaixo do campo, 4 px entre elas e a ajuda 4 px abaixo (RF-23, CT-22).

  > Como comprovar: na saída do print, ver as linhas `ok` das três medidas nos dois temas; na imagem, conferir as pills soltas do campo.

- [x] Testes, lint e checagem de tipos passam, sem violação de acessibilidade.

  > Como comprovar: rodar o bloco de "Verificação" e ver código 0.

## Descrição

### Resumo executivo

Dois ajustes finos em campos usados em várias telas: o seletor de período do cabeçalho deixa de mostrar o rótulo "Período" e fica alinhado aos botões ao lado, e o campo de etiquetas ganha o respiro do protótipo entre o campo, as etiquetas e o texto de ajuda.
Perfil padrão: mudança visual em componentes compartilhados, sem mudar as telas.
Não depende de outra tarefa e libera a TASK-17, que aplica o período sem rótulo no Financeiro.

### Detalhes técnicos

**Abordagem.** O `PeriodField` ganha `label_visible` (padrão `true`): com `false`, o rótulo vira `.srOnly` (padrão visualmente oculto, fora do fluxo), continua no `aria-labelledby` do botão e não empurra o botão para baixo; o `.control` ganha `box-sizing: border-box` para medir os mesmos 40 px do `Button`. O `TagField` passa a seguir o `.tag-pills` do protótipo: `gap: var(--s1)` e `margin-top: var(--s2)` na lista, `gap: var(--s1)` no campo inteiro. As telas não mudam aqui: o Financeiro passa `label_visible={false}` na TASK-17.

**Evidência visual.** Como nenhuma tela usa o período sem rótulo antes da TASK-17, o print vem de um harness (`apps/web/src/app/dev/fields-harness.tsx`) servido pelo Vite de desenvolvimento por `apps/web/scripts/evidence-fields.mjs`, sem servidor nem banco, que confere as medidas no Chromium antes da captura. O script tem código próprio porque o script genérico da TASK-03 é da mesma onda e as duas tarefas não dependem uma da outra.

**Decisões.**
- Rótulo oculto, no lugar de tirar o `label`: a CT-04 pede o nome acessível. Descartado `aria-label` no botão: perderia o valor do período no nome ("Período Este mês").
- Medidas do protótipo (`.field` e `.tag-pills`). Descartado só aumentar o `gap` do campo: afastaria também o rótulo do `input`, o que o protótipo não faz. As cores das pills não mudam (fora do escopo).
- O chevron do `.range-trigger` do protótipo fica fora: a spec só pede o rótulo e o alinhamento.

**Referências.** RF-04, RF-23, CT-04 (aplicado pela TASK-17), CT-22, DEC-007.

**Arquivos em comum na onda 1.** Nenhum.

### Card

- **Título:** Período e etiquetas na @atria/ui
- **Tipo:** bug
- **Descrição:** `PeriodField` com rótulo só para leitor de tela no cabeçalho, alinhado aos botões, e `TagField` com o espaçamento do protótipo.
- **Critérios de aceite:**
  - [ ] O período do cabeçalho não mostra rótulo e fica alinhado aos botões ao lado.
  - [ ] O rótulo continua no nome acessível.
  - [ ] Etiquetas e ajuda com o espaçamento do protótipo.
  - [ ] Testes, lint e checagem de tipos passam.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 com acréscimo |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | conferência | usuário | print periodo-e-etiquetas.png conferido pelo usuário (sha256 7d07aa81) |
| 7 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-05/ |
| 8 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
