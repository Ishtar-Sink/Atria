---
id: TASK-03
spec: SPEC-002
title: "Ícones e seletor de visualização na @atria/ui"
profile: padrao
persona: ui-ux-designer
depends_on: []
wave: 1
covers: [RF-05, RF-06, CT-05]
type: tarefa
labels: [SPEC-002, padrao]
status: done
content_hash: e542f438fcde1324b42acff8480a1f2e359735db7eaa97af89ac74c5dad4465b
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 8041de2f7efd4b22b0e91425392ad812ae34463938eaa1bbf3984196f18a8546
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-03: Ícones e seletor de visualização na @atria/ui

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Componentes compartilhados), RF-05, RF-06, CT-05, o contrato `ViewOption` e a lista de ícones em "Contratos e interfaces", e a decisão 11 (inferência C).
- `vostok/rules/project/frontend.md` ([project/frontend-08], [project/frontend-10]), `code-style.md` ([project/code-style-01], [project/code-style-10]), `naming-convention.md` ([project/naming-convention-09]) e `testing.md` ([project/testing-04], [project/testing-10]).
- `prototype/atria-prototype.html` (mais de 400 linhas): linhas 447-449 (`.seg` e `.seg button`), linha 794 (`.seg` em telas estreitas) e o `.seg` das seções `data-module="finance"` (linha 836, ícones Lista e Grade) e `data-module="library"` (linha 842, ícone Estante), com `title` e `sr-only` em cada botão.
- `packages/ui/src/view-switcher/view-switcher.tsx`, `view-switcher.module.css` e `view-switcher.test.tsx`.
- `packages/ui/src/index.ts`.
- `apps/web/src/features/admin/screens/users-screen.tsx` (fn `TableIcon`): traço do ícone de tabela atual.
- `packages/ui/src/period-field/period-field.tsx` (fn `CalendarIcon`): base do ícone Por dia.
- As cinco telas que hoje passam opções sem ícone: `apps/web/src/features/finance/components/list-toolbar.tsx` (o `ViewSwitcher` Lista/Grade), `apps/web/src/features/tasks/screens/tasks-screen.tsx` (Lista/Por dia), `apps/web/src/features/reminders/screens/reminders-screen.tsx` (Lista/Por dia), `apps/web/src/features/journal/journal-list-page.tsx` (Lista/Linha do tempo) e `apps/web/src/features/connections/connections-tab.tsx` (agrupamento `GROUPINGS` com `GROUP_LABELS`).
- `packages/ui/src/segmented-field/segmented-field.tsx`: o seletor segmentado de texto (`fieldset` com `legend` e rádios) que passa a agrupar Conexões (RF-07).
- `apps/web/src/features/connections/connections-tab.test.tsx` (testes `groups by category and by date` e `keeps filter, search and grouping in the url`): hoje clicam botões `Data` e `Sem grupos` do grupo `Visualização`.
- `apps/web/scripts/evidence-auth.mjs` (fn `freePort`, `virtualPage`, `startVite` e o bloco `principal`) e `apps/web/src/features/auth/evidence/harness.tsx`: molde do script e do harness de print, sem importar código deles.

### Mudar

- `packages/ui/src/icons` (criar): pasta dos ícones de visualização compartilhados (RF-06).
- `packages/ui/src/icons/view-icons.tsx` (criar): `ListIcon`, `GridIcon`, `ShelfIcon`, `TableIcon`, `DayIcon` e `TimelineIcon` (RF-06).
- `packages/ui/src/icons/index.ts` (criar): reexporta os ícones e `ViewIconProps`.
- `packages/ui/src/icons/view-icons.test.tsx` (criar): testes dos ícones.
- `packages/ui/src/view-switcher/view-switcher.tsx` (alterar): `icon` obrigatório, ícone direto no botão, com `aria-label` e `title` (RF-05, CT-05).
- `packages/ui/src/view-switcher/view-switcher.module.css` (alterar): ícone centralizado e largura só das opções (RF-05).
- `packages/ui/src/view-switcher/view-switcher.test.tsx` (alterar): testes de RF-05 e CT-05.
- `packages/ui/src/index.ts` (alterar): exporta os ícones de visualização (RF-06).
- `apps/web/src/features/finance/components/list-toolbar.tsx` (alterar): passa `ListIcon` e `GridIcon` ao `ViewSwitcher`, que agora exige ícone (o app continua compilando).
- `apps/web/src/features/tasks/screens/tasks-screen.tsx` (alterar): passa `ListIcon` e `DayIcon` ao `ViewSwitcher`, pelo mesmo motivo.
- `apps/web/src/features/reminders/screens/reminders-screen.tsx` (alterar): passa `ListIcon` e `DayIcon` ao `ViewSwitcher`, pelo mesmo motivo.
- `apps/web/src/features/journal/journal-list-page.tsx` (alterar): passa `ListIcon` e `TimelineIcon` ao `ViewSwitcher`, pelo mesmo motivo.
- `apps/web/src/features/connections/connections-tab.tsx` (alterar): o agrupamento troca o `ViewSwitcher` pelo `SegmentedField` com texto (RF-07), em vez de receber ícones.
- `apps/web/src/features/connections/connections-tab.test.tsx` (alterar): os testes do agrupamento passam a escolher rádios do seletor segmentado.
- `apps/web/scripts/evidence-ui.mjs` (criar): script de print de componentes da `@atria/ui` por harness, reaproveitado pela TASK-04.
- `apps/web/src/app/dev/evidence-checks.ts` (criar): contrato entre o harness e o script (conferências publicadas na página), reaproveitado pela TASK-04.
- `apps/web/src/app/dev/view-switcher-harness.tsx` (criar): página de evidência do seletor e dos seis ícones nos temas claro e escuro.

### Passos

1. Leia os arquivos de "Ler". Rode o bloco de "Verificação" e confirme que ele falha (`src/icons` não existe).
2. Escreva `packages/ui/src/icons/view-icons.test.tsx` (describe `view icons`) e confirme que falha:
   - `it.each` com os seis ícones: `renders %s as a decorative 18 px svg`: o `svg` tem `aria-hidden="true"`, `focusable="false"`, `viewBox="0 0 24 24"`, `width` e `height` `18`, `fill="none"` e `stroke="currentColor"`.
   - `accepts another size`: `<ListIcon size={16} />` tem `width="16"`.
   - `has no axe violations`: os seis dentro de botões com `aria-label`.
3. Altere `view-switcher.test.tsx`: a constante `views` usa `<ListIcon />` e `<GridIcon />` de `../icons`; mantenha os três casos atuais e acrescente, confirmando que falham:
   - `shows only the icon, named by aria-label and title`: o botão `Grade` tem `title="Grade"` e `textContent` vazio.
   - `puts the icon straight in the button, without an inline wrapper`: `button.firstElementChild?.tagName.toLowerCase() === 'svg'`.
   - `requires an icon in every option` (CT-05): `// @ts-expect-error -- opção sem ícone não compila (CT-05)` na linha antes de `const missing: ViewOption = { value: 'list', label: 'Lista' };` e `expect(missing.label).toBe('Lista')`. O `typecheck` da `@atria/ui` comprova: se o ícone voltar a ser opcional, o `@ts-expect-error` sem uso falha.
   - `centers the icon and keeps only the width of the options`: lê o CSS com `readFileSync(new URL('./view-switcher.module.css', import.meta.url), 'utf8')` (a `@atria/ui` não tem os tipos de `?raw`) e confere que o bloco `.root` tem `flex: none` e `width: fit-content` e que existe o bloco `.option svg` com `display: block`.
4. Crie `packages/ui/src/icons/view-icons.tsx`: `export interface ViewIconProps { size?: number }` e uma função interna `ViewIcon({ size = 18, children })` que renderiza `<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">`. Os seis ícones, cada um com um comentário de uso de uma linha:
   - `ListIcon`: `<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />` (Lista, do protótipo).
   - `GridIcon`: quatro `<rect width="7" height="7" rx="1" />` em `x/y` `3/3`, `14/3`, `3/14` e `14/14` (Grade, do protótipo).
   - `ShelfIcon`: `<path d="M4 20h16M6 4v16M10 4v16M14.5 5l3.5 15" />` (Estante, do protótipo).
   - `TableIcon`: `<rect x="3" y="4" width="18" height="16" rx="2" />` e `<path d="M3 10h18M9 4v16" />` (Tabela, o da Administração).
   - `DayIcon`: `<rect x="3" y="4" width="18" height="18" rx="2" />` e `<path d="M16 2v4M8 2v4M3 10h18M8 14h4v4H8z" />` (Por dia).
   - `TimelineIcon`: `<path d="M6 3v18M10 6h10M10 12h10M10 18h7" />` e três `<circle r="1.5" cx="6" />` em `cy` `6`, `12` e `18` (Linha do tempo).
   Crie `packages/ui/src/icons/index.ts` com `export { ListIcon, GridIcon, ShelfIcon, TableIcon, DayIcon, TimelineIcon } from './view-icons';` e `export type { ViewIconProps } from './view-icons';`.
5. Em `view-switcher.tsx`: `ViewOption` passa a `{ value: string; /** Nome acessível e dica do botão. */ label: string; /** Obrigatório: o botão mostra só o ícone (RF-05). */ icon: ReactNode }`; o botão recebe `aria-label={option.label}` e `title={option.label}` e o conteúdo é só `{option.icon}`, sem o `span` nem o texto.
6. Em `view-switcher.module.css`: no `.root`, acrescente `flex: none;` e `width: fit-content;` (comentário: o seletor ocupa só a largura das opções, mesmo numa barra flexível); acrescente `.option svg { display: block; }` (comentário: sem a linha de base do texto em linha, o ícone fica no centro do botão). O restante fica como está (já segue o `.seg` do protótipo: 44 × 40 px, `place-items: center`).
7. Em `packages/ui/src/index.ts`, depois das exportações do `ViewSwitcher`: `export { ListIcon, GridIcon, ShelfIcon, TableIcon, DayIcon, TimelineIcon } from './icons';` e `export type { ViewIconProps } from './icons';`.
8. Rode `pnpm --filter @atria/ui exec vitest run src/icons src/view-switcher` e `pnpm --filter @atria/ui typecheck` até passarem.
9. Atualize as telas do `apps/web` que passam opções sem ícone, para o app continuar compilando, só com a troca abaixo (o resto das telas é das TASK-17, TASK-18, TASK-20 e TASK-28):
   - `features/finance/components/list-toolbar.tsx`: importe `ListIcon` e `GridIcon` de `@atria/ui` e acrescente `icon: <ListIcon />` à opção `list` e `icon: <GridIcon />` à `grid`.
   - `features/tasks/screens/tasks-screen.tsx` e `features/reminders/screens/reminders-screen.tsx`: `icon: <ListIcon />` em `list` e `icon: <DayIcon />` em `day`.
   - `features/journal/journal-list-page.tsx`: `icon: <ListIcon />` em `list` e `icon: <TimelineIcon />` em `timeline`.
   - `features/connections/connections-tab.tsx` (RF-07): troque o `ViewSwitcher` por `<SegmentedField label={t('connections.view_label')} value={grouping} options={GROUPINGS.map((value) => ({ value, label: t(\`connections.${GROUP_LABELS[value]}\`) }))} onChange={...} />`, com o mesmo `onChange` de hoje, e ajuste o import (`SegmentedField` no lugar de `ViewSwitcher`). Não mude o i18n.
   - `features/connections/connections-tab.test.tsx`: nos testes `groups by category and by date` e `keeps filter, search and grouping in the url`, troque `getByRole('button', { name: 'Data' | 'Sem grupos' })` dentro do grupo `Visualização` por `getByRole('radio', { name: ... })`, e `toHaveAttribute('aria-pressed', 'true')` por `toBeChecked()`.
   Mantenha as cópias locais de ícones de Metas, Acervo, Administração, Notas e Projetos: a TASK-18 as troca. Rode `pnpm --filter @atria/web typecheck` e os testes de `src/features/connections src/features/finance/screens src/features/tasks/screens src/features/reminders/screens src/features/journal/journal-list-page` até passarem.
10. Crie `apps/web/src/app/dev/evidence-checks.ts`: `export interface EvidenceCheck { name: string; ok: boolean; detail?: string }`; `declare global { interface Window { __atria_evidence?: EvidenceCheck[] } }`; `export function publishEvidence(checks: EvidenceCheck[]): void` grava `window.__atria_evidence = checks` e `document.documentElement.dataset['evidenceReady'] = 'true'`; `export function near(a: number, b: number, tolerance = 0.5): boolean`. Comentário: só os harness de print carregam este arquivo; o app não o importa.
11. Crie `apps/web/src/app/dev/view-switcher-harness.tsx` (não importado pelo app): importa `../global.css`, `ViewSwitcher`, `TextField` e os seis ícones de `@atria/ui`, e monta com `createRoot` em `#root` dois painéis lado a lado (`display: 'grid'`, `gridTemplateColumns: '1fr 1fr'`), um com `data-theme="light"` e outro com `data-theme="dark"`, cada um com `background: 'var(--bg)'`, `color: 'var(--text)'`, `padding: 'var(--s6)'` e `gap: 'var(--s5)'` (só tokens). Em cada painel: um título `Tema claro` ou `Tema escuro`; uma barra `data-row="toolbar"` (`display: 'flex'`, `alignItems: 'flex-end'`, `gap: 'var(--s3)'`) com um `TextField` `Buscar` num wrapper `flex: '1 1 180px'` e um `ViewSwitcher` Lista/Grade; e uma linha com os pares Lista/Estante, Lista/Tabela, Lista/Por dia e Lista/Linha do tempo, cada um com estado próprio (`useState`) e o segundo marcado. Depois de `document.fonts.ready`, num `useEffect`, chame `publishEvidence` com:
    - por botão de cada `[role="group"]`: `ícone centralizado: <aria-label> (<tema>)`, com `near` entre os centros horizontal e vertical do `svg` e do botão (`getBoundingClientRect`), e o `detail` `dx=… dy=…`;
    - por botão: `só o ícone, com nome e dica: <aria-label> (<tema>)`, quando `title === aria-label` e o `textContent` está vazio;
    - por painel: `seletor da barra ocupa só a largura das opções (<tema>)`, quando a largura do grupo da barra é a soma das larguras dos botões mais 2 px de borda, com tolerância de 1 px.
12. Crie `apps/web/scripts/evidence-ui.mjs`, em Node sem dependência nova (`@playwright/test`, `@axe-core/playwright` e `vite`, já do `apps/web`), no molde de `evidence-auth.mjs` sem importar código dele. Cabeçalho: `// Uso: node apps/web/scripts/evidence-ui.mjs <harness relativo a apps/web> <png> [--width=1280] [--query=chave=valor]`. Ele: confere os argumentos (sem os dois, imprime o uso e sai com 2); sobe o Vite com `createServer({ root: WEB, logLevel: 'error', plugins: [páginaVirtual], server: { port: <porta livre>, strictPort: true, host: '127.0.0.1', proxy: {} } })`, em que a página virtual `/__evidence-ui` serve um HTML com `<html lang="pt-BR" data-theme="light">`, `<div id="root">` e `<script type="module" src="/<harness>">`, passando por `server.transformIndexHtml`; abre o Chromium com a largura pedida (padrão 1280) e altura 900; registra `pageerror`; abre `/__evidence-ui?<query>`; espera `html[data-evidence-ready="true"]` por até 15 s; imprime `ok    <nome>` ou `FALHA <nome> · <detalhe>` para cada item de `window.__atria_evidence`; confere `sem erro de JavaScript` e `axe sem violações` (`new AxeBuilder({ page }).analyze()`, com os ids das violações no detalhe); cria a pasta do PNG (`mkdirSync(dirname(png), { recursive: true })`), grava `page.screenshot({ path: png, fullPage: true, animations: 'disabled' })`, imprime `png: <caminho>` e termina com `ok  0 falha(s)` ou `FALHA  N falha(s)`, saindo com 1 se algo falhou. Fecha o navegador e o Vite num `finally`.
13. Rode `node apps/web/scripts/evidence-ui.mjs src/app/dev/view-switcher-harness.tsx /tmp/atria-visualizacao-icones.png` até a última linha ser `ok  0 falha(s)`, corrigindo o código da tarefa a cada `FALHA`, e abra o PNG.
14. Rode o lint e o Prettier dos arquivos de "Mudar" e o bloco de "Verificação" até terminar sem erro.

### Baseline

- `pnpm --filter @atria/ui exec vitest run src/view-switcher --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/ui typecheck`
- `pnpm --filter @atria/ui exec eslint src/view-switcher src/index.ts --max-warnings 0`
- `pnpm --filter @atria/ui exec prettier --check src/view-switcher src/index.ts`
- `pnpm --filter @atria/web exec vitest run src/features/notes/screens src/features/goals/screens src/features/library/shelf-page src/features/projects/projects-list-page src/features/admin/screens/users-screen src/features/reminders/screens src/features/tasks/screens src/features/journal/journal-list-page src/features/finance/screens/accounts-screens src/features/finance/screens/transactions-screens src/features/connections/connections-tab --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/finance/components/list-toolbar.tsx src/features/tasks/screens/tasks-screen.tsx src/features/reminders/screens/reminders-screen.tsx src/features/journal/journal-list-page.tsx src/features/connections/connections-tab.tsx src/features/connections/connections-tab.test.tsx --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance/components/list-toolbar.tsx src/features/tasks/screens/tasks-screen.tsx src/features/reminders/screens/reminders-screen.tsx src/features/journal/journal-list-page.tsx src/features/connections/connections-tab.tsx src/features/connections/connections-tab.test.tsx`
- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# evidência: ui-tests.txt
pnpm --filter @atria/ui exec vitest run src/icons src/view-switcher --reporter=verbose
pnpm --filter @atria/ui typecheck
pnpm --filter @atria/ui exec eslint src/icons src/view-switcher src/index.ts --max-warnings 0
pnpm --filter @atria/ui exec prettier --check src/icons src/view-switcher src/index.ts
pnpm --filter @atria/web exec vitest run src/features/notes/screens src/features/goals/screens src/features/library/shelf-page src/features/projects/projects-list-page src/features/admin/screens/users-screen src/features/reminders/screens src/features/tasks/screens src/features/journal/journal-list-page src/features/finance/screens/accounts-screens src/features/finance/screens/transactions-screens src/features/connections/connections-tab
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/app/dev/evidence-checks.ts src/app/dev/view-switcher-harness.tsx src/features/finance/components/list-toolbar.tsx src/features/tasks/screens/tasks-screen.tsx src/features/reminders/screens/reminders-screen.tsx src/features/journal/journal-list-page.tsx src/features/connections/connections-tab.tsx src/features/connections/connections-tab.test.tsx --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/app/dev/evidence-checks.ts src/app/dev/view-switcher-harness.tsx scripts/evidence-ui.mjs src/features/finance/components/list-toolbar.tsx src/features/tasks/screens/tasks-screen.tsx src/features/reminders/screens/reminders-screen.tsx src/features/journal/journal-list-page.tsx src/features/connections/connections-tab.tsx src/features/connections/connections-tab.test.tsx
node --check apps/web/scripts/evidence-ui.mjs
```

Resultado esperado: código 0; no primeiro comando, as linhas `✓` de `view-icons.test.tsx` e `view-switcher.test.tsx` e nenhuma `×`. O `pnpm --filter @atria/web typecheck` prova que as telas que passavam opções sem ícone foram atualizadas.

### Evidências

- `ui-tests.txt` (automática, da verificação)
  - Prova: os seis ícones são SVG decorativos, o seletor mostra só o ícone com `aria-label` e `title`, sem `span` em linha, com a largura só das opções, e uma opção sem ícone não compila (RF-05, RF-06, CT-05).
  - Trecho: `✓ src/icons/view-icons.test.tsx > view icons > renders ListIcon as a decorative 18 px svg` (e os outros cinco), `✓ src/view-switcher/view-switcher.test.tsx > ViewSwitcher > shows only the icon, named by aria-label and title`, `puts the icon straight in the button, without an inline wrapper` e `requires an icon in every option`.
  - Falha: uma linha `×`, `FAIL`, `No test files found` ou o `typecheck` com `Unused '@ts-expect-error' directive`.
- `visualizacao-icones.png` (print): `node apps/web/scripts/evidence-ui.mjs src/app/dev/view-switcher-harness.tsx "$VOSTOK_EVIDENCE/visualizacao-icones.png"`
  - Prova: no navegador, o seletor mostra os seis ícones compartilhados centralizados, com dica, nos temas claro e escuro, e não estica numa barra flexível (RF-05, RF-06, CT-05).
  - Trecho: na imagem, os dois painéis com a barra Buscar + Lista/Grade e os pares Estante, Tabela, Por dia e Linha do tempo, o ícone no meio de cada botão e o marcado em `primary-soft`; na saída, as linhas `ok    ícone centralizado: ...`, `ok    seletor da barra ocupa só a largura das opções (claro)`, `ok    axe sem violações` e a última `ok  0 falha(s)`.
  - Falha: um ícone acima do centro, um botão com texto, o seletor esticado até a borda, uma linha `FALHA` ou a última linha `FALHA  N falha(s)`.
  - Requer: `apps/web/scripts/evidence-ui.mjs`, `apps/web/src/app/dev/evidence-checks.ts`, `apps/web/src/app/dev/view-switcher-harness.tsx`, `packages/ui/src/icons/index.ts`

### Concluída quando

- [x] A `@atria/ui` exporta os ícones de visualização Lista, Grade, Estante, Tabela, Por dia e Linha do tempo, como SVG decorativos (RF-06).

  > Como comprovar: em `ui-tests.txt`, ver `✓` nos seis casos `renders ... as a decorative 18 px svg`; no print, ver os seis ícones.

- [x] O `ViewSwitcher` mostra só o ícone, centralizado, com nome acessível e dica, e ocupa só a largura das opções (RF-05, CT-05).

  > Como comprovar: no `visualizacao-icones.png`, conferir os ícones no meio dos botões e o seletor da barra sem esticar; na saída do print, ver `ok    ícone centralizado: ...` em todos os botões e a última linha `ok  0 falha(s)`.

- [x] Uma opção sem ícone não compila (CT-05).

  > Como comprovar: em `ui-tests.txt`, ver `✓ ... requires an icon in every option`, e o `pnpm --filter @atria/ui typecheck` da "Verificação" passar.

- [x] As telas que passavam opções sem ícone usam os ícones compartilhados, e a aba Conexões agrupa com o seletor segmentado de texto, com o app compilando.

  > Como comprovar: rodar o bloco de "Verificação" e ver o `pnpm --filter @atria/web typecheck` e os testes de `connections-tab` passarem; abrir a aba Conexões e ver os rádios de texto do agrupamento.

- [x] Testes, lint e checagem de tipos da `@atria/ui` e do `@atria/web` passam.

  > Como comprovar: rodar o bloco de "Verificação" e ver código 0.

## Descrição

### Resumo executivo

Os botões que trocam o modo de visualização das listagens ficaram desalinhados, com ícones diferentes em cada tela e alguns só com texto. Esta tarefa cria na biblioteca de componentes um conjunto único de ícones e um seletor que exige ícone, centralizado e com dica, como no protótipo.
Perfil padrão: componente compartilhado, com mudança de contrato que as telas adotam nas tarefas seguintes.
Bloqueia a TASK-04 e libera as TASK-17, TASK-18, TASK-20 e TASK-28; já atualiza as telas que ficariam sem compilar.

### Detalhes técnicos

**Abordagem.** Ícones novos em `packages/ui/src/icons` (traços do protótipo para Lista, Grade e Estante; da Administração para Tabela; Por dia e Linha do tempo no mesmo traço de 2 px), exportados pelo `index.ts`. O `ViewSwitcher` passa a exigir `icon`, põe o SVG direto no botão (o `span` em linha deixava o ícone acima do centro pela linha de base do texto) e usa o rótulo como `aria-label` e `title`, como o `.seg` do protótipo. O `.root` ganha `flex: none` e `width: fit-content`. A regra `.filters > *` do Financeiro, que estica o seletor, é da TASK-17.

**Evidência visual.** As telas só passam a usar os ícones compartilhados nas TASK-17, TASK-18, TASK-20 e TASK-28, e o e2e compila o app inteiro; por isso o print vem de um harness (`apps/web/src/app/dev/view-switcher-harness.tsx`) servido pelo Vite de desenvolvimento por `apps/web/scripts/evidence-ui.mjs`, sem servidor nem banco, como nas evidências da SPEC-001. O script é genérico (harness, PNG, largura e query) e o contrato de conferências fica em `evidence-checks.ts`, para a TASK-04 reaproveitar.

**Decisões.**
- `icon: ReactNode` obrigatório, conforme o contrato da spec. Descartado manter opcional com aviso: a CT-05 pede que a opção sem ícone não compile.
- `@ts-expect-error` com descrição no teste para provar a CT-05 pelo `typecheck`. Descartado um teste de compilação separado (`tsd`): dependência nova sem necessidade.
- Leitura do CSS com `readFileSync`: a `@atria/ui` não tem os tipos `vite/client` de `?raw`.

**Telas atualizadas aqui (decisão do Coordenador).** Tornar `icon` obrigatório quebraria a compilação de cinco telas que passam opções sem ícone. Para o `@atria/web` continuar compilando (a onda 1 roda o `typecheck` inteiro em paralelo), esta tarefa faz só a troca mínima nelas: ícones compartilhados em `list-toolbar.tsx`, `tasks-screen.tsx`, `reminders-screen.tsx` e `journal-list-page.tsx`, e o `SegmentedField` com texto no agrupamento de `connections-tab.tsx` (RF-07). O restante dessas telas continua com as TASK-17, TASK-18, TASK-20 e TASK-28, e as cópias locais de ícones de Metas, Acervo, Administração, Notas e Projetos ficam para a TASK-18. Descartado deixar o app sem compilar até a onda 5: o `webServer` do Playwright roda `tsc --noEmit` e todos os e2e parariam.

**Riscos.** O agrupamento de Conexões passa de botões a rádios: os testes da aba são ajustados aqui; o rótulo continua `Visualização`, sem mudar o i18n.

**Referências.** RF-05, RF-06, CT-05, decisão 11 (inferência C), DEC-007.

**Arquivos em comum na onda 1.** Nenhum. As cinco telas acima voltam a ser alteradas pelas TASK-17, TASK-18, TASK-20 e TASK-28 (ondas seguintes, que dependem desta). O `packages/ui/src/index.ts` é alterado de novo pela TASK-04 (onda 2), que depende desta.

### Card

- **Título:** Ícones e seletor de visualização na @atria/ui
- **Tipo:** tarefa
- **Descrição:** Ícones de visualização compartilhados na `@atria/ui` e `ViewSwitcher` com ícone obrigatório, centralizado, com dica e na largura das opções.
- **Critérios de aceite:**
  - [ ] A `@atria/ui` exporta os seis ícones de visualização.
  - [ ] O seletor mostra só o ícone, centralizado, com nome acessível e dica.
  - [ ] O seletor não estica numa barra flexível.
  - [ ] Opção sem ícone não compila, e as telas atuais continuam compilando.
  - [ ] Conexões agrupa com o seletor segmentado de texto.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 8 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | failed | tentativa 1 de 2 |
| 4 | 2026-11-01 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 5 | 2026-11-01 | retomada | validating | decisão do usuário: Usuário escolheu ajustar a TASK-07: os stubs de fetch ignoram GET /me/preferences; regressão corrigida, sem aceite |
| 6 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-11-01 | regressão | passed | 7 comando(s) iguais ao baseline; 1 com acréscimo |
| 8 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 9 | 2026-11-01 | conferência | usuário | print visualizacao-icones.png conferido pelo usuário (sha256 3f607a59) |
| 10 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-03/ |
| 11 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
