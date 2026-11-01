---
id: TASK-04
spec: SPEC-002
title: "Diálogo, campo de moeda e botão carregando na @atria/ui"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-03]
wave: 2
covers: [RF-13, RF-25, RF-30, CT-24, CT-29, CB-03]
type: tarefa
labels: [SPEC-002, padrao]
status: done
content_hash: b88b7d7ea306f1ed62fb74ad6a08cd59a801a4dd46ec62d0dd9e9ba22ac6ced9
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 240d33e3936dbe678ab755bf623b7aad95948d5170c67aa64038fe09663a48ea
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-04: Diálogo, campo de moeda e botão carregando na @atria/ui

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Componentes compartilhados: os 6 diálogos feitos à mão; Financeiro: o `MoneyField` que não formata; Acervo: o `Button` com `loading` que só desabilita), RF-13, RF-25, RF-30, CT-24, CT-29, CB-03, CB-04, RN-09, os contratos `DialogProps` e `MoneyFieldProps` em "Contratos e interfaces" e as decisões 12 (inferência D), 14 (inferência F) e 20 (inferência L).
- `vostok/rules/project/frontend.md` ([project/frontend-04], [project/frontend-09], [project/frontend-10], [project/frontend-16]), `code-style.md` ([project/code-style-05], [project/code-style-10]), `testing.md` ([project/testing-04], [project/testing-10]) e `naming-convention.md`.
- `prototype/atria-prototype.html` (mais de 400 linhas): linhas 743-746 (`dialog`, `dialog::backdrop`, `dialog h2`, `dialog .form-actions`), linha 538 (`.form-actions`), linhas 880-893 (`#create-dialog` e `#confirm-dialog`, com Cancelar em `.btn`) e linha 411 (`.btn`).
- `packages/ui/src/confirm-dialog/confirm-dialog.tsx`, `confirm-dialog.module.css` e `confirm-dialog.test.tsx`.
- `packages/ui/src/button/button.tsx`, `button.module.css` e `button.test.tsx`.
- `packages/ui/src/text-field/text-field.tsx`: base visual do campo de moeda.
- `apps/web/src/features/finance/lib/money-input.ts` (fn `separatorsOf`, `parseMoneyToCents`) e `apps/web/src/features/finance/components/money-field.tsx` (fn `currencySymbol`): conversão atual com `Intl`; não mudam aqui (são da TASK-16).
- `packages/theme/src/tokens.css`: `--space`, `--s1` a `--s8`, `--motion-slow`, `--motion-ease-linear` e o `prefers-reduced-motion` que zera as durações.
- `packages/ui/src/index.ts` (já com os ícones da TASK-03).
- `apps/web/scripts/evidence-ui.mjs`, `apps/web/src/app/dev/evidence-checks.ts` e `apps/web/src/app/dev/view-switcher-harness.tsx`, criados pela TASK-03: script de print, contrato das conferências e molde do harness.
- `vostok/work/tasks/SPEC-002/TASK-24.md` ("Passos", passo 1): o que a migração dos diálogos espera do `Dialog`.

### Mudar

- `packages/ui/src/dialog` (criar): pasta do diálogo genérico (RF-30).
- `packages/ui/src/dialog/dialog.tsx` (criar): `Dialog` com corpo, rodapé de ações, `role` de alerta, largura larga, fechar pelo fundo e foco preso (RF-30, CT-29).
- `packages/ui/src/dialog/dialog.module.css` (criar): espaçamento do `dialog` do protótipo.
- `packages/ui/src/dialog/dialog.test.tsx` (criar): testes do diálogo.
- `packages/ui/src/money-field` (criar): pasta do campo de moeda (RF-13).
- `packages/ui/src/money-field/money-mask.ts` (criar): máscara, conversão para centavos e formatação com `Intl` (RF-13, RN-09, CB-03).
- `packages/ui/src/money-field/money-mask.test.ts` (criar): testes da máscara.
- `packages/ui/src/money-field/money-field.tsx` (criar): `MoneyField` sobre o `TextField`, com a máscara ao digitar (RF-13).
- `packages/ui/src/money-field/money-field.test.tsx` (criar): testes do campo.
- `packages/ui/src/confirm-dialog/confirm-dialog.tsx` (alterar): monta sobre o `Dialog`, com a mesma API (RF-30).
- `packages/ui/src/confirm-dialog/confirm-dialog.module.css` (alterar): fica só a descrição; o resto passa ao `Dialog` (sem classe morta).
- `packages/ui/src/confirm-dialog/confirm-dialog.test.tsx` (alterar): caso do espaçamento herdado do `Dialog`.
- `packages/ui/src/button/button.tsx` (alterar): indicador visível de carregando (RF-25, CT-24).
- `packages/ui/src/button/button.module.css` (alterar): estilo do indicador e do primário carregando (RF-25).
- `packages/ui/src/button/button.test.tsx` (alterar): testes do carregando.
- `packages/ui/src/index.ts` (alterar): exporta `Dialog`, `MoneyField` e as funções da máscara (o arquivo é da TASK-03, de que esta depende).
- `apps/web/src/app/dev/dialog-harness.tsx` (criar): página de evidência do diálogo, do campo de moeda e do botão carregando.

### Passos

1. Leia os arquivos de "Ler". Rode o bloco de "Verificação" e confirme que ele falha (`src/dialog` e `src/money-field` não existem).
2. Escreva `packages/ui/src/money-field/money-mask.test.ts` (describe `money mask`, locale `pt-BR`, moeda `BRL`; compare com `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(...)`, que usa espaço sem quebra) e confirme que falha:
   - `formats the whole part with thousands while typing`: `maskMoneyInput('14500', 'pt-BR', 'BRL')` é o prefixo da moeda + `14.500`.
   - `keeps a typed comma and up to two decimals`: `'14500,'` → prefixo + `14.500,`; `'14500,509'` → prefixo + `14.500,50`.
   - `accepts a pasted value with separators` (CB-03): `'14500,5'` e `'R$ 14.500,5'` → prefixo + `14.500,5`.
   - `starts with zero when only the comma is typed` (CB-03): `','` → prefixo + `0,`.
   - `clears when nothing is left` (CB-03): `''` e `'R$ '` → `''`.
   - `converts to integer cents` (RN-09): `parseMoneyInput` de `'R$ 14.500'` é `1450000`, de `'R$ 14.500,5'` é `1450050`, de `''` é `null`.
   - `formats cents with two decimals`: `formatCents(1450050, 'pt-BR', 'BRL')` é igual ao `Intl` de `14500.5`.
3. Escreva `packages/ui/src/money-field/money-field.test.tsx` com um `Harness` que guarda `value_cents` em `useState` e registra cada `onChange`, e confirme que falha:
   - `formats while typing and stores the same value in cents` (RF-13): digitar `14500` mostra prefixo + `14.500` e o último `onChange` é `1450000`; ao sair do campo (`userEvent.tab()`), mostra o `Intl` de `14500` (com `,00`).
   - `completes the decimals of a pasted value on blur` (CB-03): `userEvent.paste('14500,5')`, sair do campo: mostra o `Intl` de `14500.5` e o `onChange` é `1450050`.
   - `sends null when everything is erased and shows the message` (CB-03): com `value_cents={1000}`, `userEvent.clear` emite `null`; com `error="Informe o valor."`, o campo tem `aria-invalid="true"` e o texto está em `role="alert"`.
   - `shows the initial cents formatted`: `value_cents={1450000}` mostra o `Intl` de `14500`.
   - `has no axe violations`.
4. Escreva `packages/ui/src/dialog/dialog.test.tsx` (o jsdom não tem `showModal`: no `beforeAll`, defina `HTMLDialogElement.prototype.showModal` e `close` com `vi.fn` que ligam e desligam o atributo `open`, como faz `confirm-dialog.test.tsx`) e confirme que falha:
   - `renders the title, the body and the actions`: `role="dialog"` com nome igual ao `title`, o corpo em `[data-dialog-body]` e as ações em `[data-dialog-actions]`, depois do corpo.
   - `focuses the element marked with data-autofocus, or the first focusable one`.
   - `routes Escape to onClose without closing by itself` (pedido da TASK-24): `keyDown` `Escape` chama `onClose` uma vez e o evento fica com `defaultPrevented`; o evento `cancel` do `<dialog>` também chama `onClose` com `preventDefault`.
   - `traps Tab inside the dialog`, cobrindo campo do corpo e botões das ações.
   - `returns focus to the trigger when closed`.
   - `uses alertdialog with the body as description` (pedido da TASK-24): `role="alertdialog"` tem `aria-describedby` com o id do corpo; `described_by="x"` troca esse id.
   - `closes on a backdrop click only when asked` (pedido da TASK-24): com `close_on_backdrop`, um clique cujo alvo é o próprio `<dialog>` chama `onClose`, e um clique no corpo não chama; sem a opção, nenhum chama.
   - `submits a form of the body from a button in the actions` (pedido da TASK-24): corpo com `<form id="f" onSubmit={spy}>`, ação `<Button type="submit" form="f">`; o clique chama `spy`.
   - `applies the wide size`: `size="wide"` põe a classe `wide` no `<dialog>`.
   - `has the prototype spacing`: lê `dialog.module.css` com `readFileSync(new URL('./dialog.module.css', import.meta.url), 'utf8')` e confere `padding: var(--s6)` em `.inner`, `margin-top: var(--s4)` e `justify-content: flex-end` em `.actions`, `margin: 0 0 var(--s2)` em `.title`, `calc(var(--space) * 120)` em `.root` e `calc(var(--space) * 140)` em `.wide`.
   - `has no axe violations`.
5. Altere `confirm-dialog.test.tsx` acrescentando `is built on Dialog, with the actions after the description`: o `alertdialog` tem `[data-dialog-body]` com a descrição e `[data-dialog-actions]` com Cancelar e o botão de confirmar. Os quatro casos atuais continuam iguais. Confirme que o novo falha.
6. Altere `button.test.tsx` e confirme que os novos falham:
   - `shows a visible spinner while loading` (RF-25, CT-24): com `loading`, o botão tem `aria-busy="true"` e um `[data-button-spinner]` com `aria-hidden="true"`; sem `loading`, não tem.
   - `ignores clicks while loading` (CT-24, CB-04): `onClick` espiado não é chamado por dois cliques com `loading`.
   - `keeps the accessible name while loading`: `getByRole('button', { name: 'Salvar' })` continua achando o botão.
   - `keeps the primary color while loading`: lê `button.module.css` com `readFileSync` e confere o bloco `.primary[aria-busy='true']` com `background: var(--primary)` e a animação do `.spinner` com `var(--motion-slow)`.
7. Crie `money-mask.ts` (com comentário do porquê no topo: dinheiro é inteiro em centavos e a máscara é só de exibição, RN-09):
   - `affixesOf(locale, currency)`: com `new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1)`, o `prefix` é a junção das partes antes da primeira `integer` e o `suffix` a das partes depois da última `fraction` (moedas com símbolo depois do número); o `group` e o `decimal` vêm de `formatToParts(1234567.5)`. Guarde num `Map` por `locale|currency`.
   - `export function maskMoneyInput(text: string, locale: string, currency: string): string`: tire o prefixo e o sufixo; ache a última ocorrência do separador decimal; a parte inteira são só os dígitos antes dele, sem zeros à esquerda (`0` quando só há decimais ou a vírgula); a fração, até 2 dígitos depois dele; sem dígitos e sem separador, devolva `''`; senão `prefix + inteira com o group a cada 3 dígitos + (com separador ? decimal + fração : '') + suffix`.
   - `export function parseMoneyInput(text: string, locale: string, currency: string): number | null`: sobre o texto mascarado, `inteira * 100 + fração.padEnd(2, '0')`, `null` sem dígitos ou fora de `Number.isSafeInteger`.
   - `export function formatCents(cents: number, locale: string, currency: string): string`: `Intl.NumberFormat` com `minimumFractionDigits: 2` e `maximumFractionDigits: 2` sobre `cents / 100`.
8. Crie `money-field.tsx`: `export interface MoneyFieldProps { label: string; value_cents: number | null; onChange: (cents: number | null) => void; error?: string; help?: string; locale?: string; currency?: string; onBlur?: () => void; name?: string; id?: string; disabled?: boolean }` (padrões `pt-BR` e `BRL`; a tela passa o locale e a moeda da pessoa). Estado `text`, iniciado com `value_cents === null ? '' : formatCents(...)`; um `useEffect` em `[value_cents, locale, currency]` só troca o texto quando `parseMoneyInput(text) !== value_cents` (mudança de fora, como o `reset` do formulário). Renderiza `<TextField label inputMode="decimal" autoComplete="off" value={text} ... />`; no `onChange`, `const next = maskMoneyInput(event.target.value, ...)`, `setText(next)` e `onChange(parseMoneyInput(next, ...))`; no `onBlur`, com valor, `setText(formatCents(valor, ...))` e depois `onBlur?.()`. Repasse `error`, `help`, `name`, `id` e `disabled`.
9. Crie `dialog.tsx`: `export interface DialogProps { open: boolean; title: string; onClose: () => void; children: ReactNode; actions: ReactNode; role?: 'dialog' | 'alertdialog'; size?: 'default' | 'wide'; close_on_backdrop?: boolean; described_by?: string; className?: string }`. Com `open`, um `useEffect` guarda o elemento em foco (o gatilho), chama `showModal()`, foca `[data-autofocus]` ou o primeiro focável do corpo, ou o das ações, e na limpeza chama `close()` e devolve o foco ao gatilho (a lógica de `confirm-dialog.tsx` de hoje). Sem `open`, retorna `null`. Estrutura: `<dialog ref role={role} aria-labelledby={título} aria-describedby={described_by ?? (role === 'alertdialog' ? corpo : undefined)} className={root + (size === 'wide' ? wide : '') + className} onKeyDown onCancel onClick>` com `<div className={styles.inner}>`, `<h2 id className={styles.title}>`, `<div id className={styles.body} data-dialog-body="">{children}</div>` e `<div className={styles.actions} data-dialog-actions="">{actions}</div>`. As ações ficam fora de qualquer `form`, para um botão com `form="<id>"` enviar o formulário do corpo. `onKeyDown`: `Escape` faz `preventDefault()` e `onClose()`; `Tab` prende o foco entre os focáveis (`button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`, sem `disabled`). `onCancel`: `preventDefault()` e `onClose()`. `onClick`: com `close_on_backdrop` e `event.target === event.currentTarget`, `onClose()` (o `<dialog>` não tem preenchimento; o clique nele mesmo é no fundo).
10. Crie `dialog.module.css`, só com tokens: `.root { max-width: min(calc(var(--space) * 120), calc(100vw - var(--s8))); padding: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--elevation-3); box-shadow: var(--shadow-lg); color: var(--text); font-family: var(--font-body); }`, `.wide { max-width: min(calc(var(--space) * 140), calc(100vw - var(--s8))); }`, `.root::backdrop { background: color-mix(in srgb, var(--bg) 70%, transparent); }`, `.inner { padding: var(--s6); }`, `.title { margin: 0 0 var(--s2); font-family: var(--font-display); font-size: var(--font-size-xl); font-weight: 700; letter-spacing: -0.02em; }`, `.body { color: var(--text); }`, `.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--s2); margin-top: var(--s4); }` (comentário: `dialog` e `dialog .form-actions` do protótipo, 480 e 560 px).
11. Reescreva `confirm-dialog.tsx` com a mesma `ConfirmDialogProps`: `<Dialog open={open} title={title} role="alertdialog" onClose={onCancel} actions={<><Button data-autofocus="" variant="secondary" onClick={onCancel}>{cancelLabel}</Button><Button variant="primary" onClick={onConfirm}>{confirmLabel}</Button></>}><p className={styles.description}>{description}</p></Dialog>`. O Cancelar passa de `ghost` para `secondary`, como o `.btn` do protótipo. Em `confirm-dialog.module.css`, deixe só `.description` (`margin: 0; color: var(--text-muted); font-size: var(--font-size-md); line-height: 1.6;`).
12. Em `button.tsx`, com `loading`, renderize `<span className={styles.spinner} aria-hidden="true" data-button-spinner="" />` antes de `children`. Em `button.module.css`: `.spinner { flex: none; width: calc(var(--space) * 4); height: calc(var(--space) * 4); border: 2px solid currentColor; border-right-color: transparent; border-radius: var(--radius-pill); animation: button-spin var(--motion-slow) var(--motion-ease-linear) infinite; }`, `@keyframes button-spin { to { transform: rotate(360deg); } }`, `.root[aria-busy='true'] { cursor: progress; }` e, no fim do arquivo (vence `.root:disabled` e `.primary:disabled`), `.primary[aria-busy='true'] { border-color: var(--primary); background: var(--primary); color: var(--primary-on); }`. Comentário: com "reduzir movimento", `--motion-slow` vale 0 e o anel fica parado, ainda visível. O clique duplo já é barrado pelo `disabled` durante o carregando.
13. Em `packages/ui/src/index.ts`: `export { Dialog } from './dialog/dialog';`, `export type { DialogProps } from './dialog/dialog';`, `export { MoneyField } from './money-field/money-field';`, `export type { MoneyFieldProps } from './money-field/money-field';` e `export { maskMoneyInput, parseMoneyInput, formatCents } from './money-field/money-mask';`.
14. Rode `pnpm --filter @atria/ui exec vitest run src/dialog src/money-field src/button src/confirm-dialog` e `pnpm --filter @atria/ui typecheck` até passarem, e depois os testes do `@atria/web` da "Verificação" (telas com confirmação e com botão carregando).
15. Crie `apps/web/src/app/dev/dialog-harness.tsx` (não importado pelo app), no molde do `view-switcher-harness.tsx`, usando `publishEvidence` e `near` de `./evidence-checks`. Ele lê `new URLSearchParams(location.search).get('cena')`:
    - `dialogo`: abre o `Dialog` com o título `Registrar esta sessão de leitura?`, o corpo `Você avançou da página 12 até a 30. O registro só entra no histórico e no progresso se você confirmar.` e as ações `Cancelar` (`secondary`, `data-autofocus`) e `Registrar sessão` (`primary`), sobre uma página com fundo `var(--bg)`. Conferências: `diálogo aberto`, `título 8 px acima do corpo` (topo do corpo menos a base do título = 8), `ações 16 px abaixo do corpo`, `preenchimento de 24 px` (diferença entre a borda do `<dialog>` e o título), `ações alinhadas à direita` (`near` entre a direita do último botão e a do `.inner` menos 24), `largura até 480 px` e `foco em Cancelar`.
    - `campos`: dois painéis `data-theme="light"` e `data-theme="dark"`, como no harness da TASK-03, cada um com três `MoneyField` (`value_cents` `1450000`, `1450050` e `null` com `error="Informe o valor."`) e uma linha com `Button variant="primary" loading` `Salvar` e `Button loading` `Enviar`. Conferências: `valor formatado: <texto>` (o `value` do campo igual a `formatCents`), `erro em role="alert"`, e por botão `indicador de carregando visível` (o `[data-button-spinner]` com largura e altura acima de 0), `aria-busy` e `botão desabilitado`.
16. Rode `node apps/web/scripts/evidence-ui.mjs src/app/dev/dialog-harness.tsx /tmp/atria-dialogo.png --query=cena=dialogo` e o mesmo com `--query=cena=campos`, até a última linha ser `ok  0 falha(s)`, corrigindo o código da tarefa a cada `FALHA`, e abra os PNG.
17. Rode o lint e o Prettier dos arquivos de "Mudar" e o bloco de "Verificação" até terminar sem erro.

### Baseline

- `pnpm --filter @atria/ui exec vitest run src/button src/confirm-dialog --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/ui typecheck`
- `pnpm --filter @atria/ui exec eslint src/button src/confirm-dialog src/index.ts --max-warnings 0`
- `pnpm --filter @atria/ui exec prettier --check src/button src/confirm-dialog src/index.ts`
- `pnpm --filter @atria/web exec vitest run src/features/goals/screens src/features/notes/screens src/features/journal/emotions-page src/features/finance/screens/accounts-screens src/features/reports src/features/library/reading-history-tab --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# evidência: ui-tests.txt
pnpm --filter @atria/ui exec vitest run src/dialog src/money-field src/button src/confirm-dialog --reporter=verbose
pnpm --filter @atria/ui typecheck
pnpm --filter @atria/ui exec eslint src/dialog src/money-field src/button src/confirm-dialog src/index.ts --max-warnings 0
pnpm --filter @atria/ui exec prettier --check src/dialog src/money-field src/button src/confirm-dialog src/index.ts
pnpm --filter @atria/web exec vitest run src/features/goals/screens src/features/notes/screens src/features/journal/emotions-page src/features/finance/screens/accounts-screens src/features/reports src/features/library/reading-history-tab
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/app/dev/dialog-harness.tsx --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/app/dev/dialog-harness.tsx
```

Resultado esperado: código 0; no primeiro comando, as linhas `✓` de `dialog.test.tsx`, `money-mask.test.ts`, `money-field.test.tsx`, `button.test.tsx` e `confirm-dialog.test.tsx` e nenhuma `×`.

### Evidências

- `ui-tests.txt` (automática, da verificação)
  - Prova: o diálogo genérico tem corpo, ações, alerta, largura larga, fundo que fecha sob pedido, Esc para `onClose`, foco preso e envio pelo atributo `form`; o campo de moeda formata ao digitar e grava centavos; o botão carregando mostra o indicador e ignora cliques (RF-13, RF-25, RF-30, CT-24, CT-29, CB-03).
  - Trecho: `✓ src/dialog/dialog.test.tsx > Dialog > has the prototype spacing`, `routes Escape to onClose without closing by itself`, `submits a form of the body from a button in the actions`, `✓ src/money-field/money-field.test.tsx > MoneyField > formats while typing and stores the same value in cents`, `completes the decimals of a pasted value on blur`, `sends null when everything is erased and shows the message` e `✓ src/button/button.test.tsx > Button > shows a visible spinner while loading` e `ignores clicks while loading`.
  - Falha: uma linha `×`, `FAIL` ou `No test files found`.
- `dialogo-generico.png` (print): `node apps/web/scripts/evidence-ui.mjs src/app/dev/dialog-harness.tsx "$VOSTOK_EVIDENCE/dialogo-generico.png" --query=cena=dialogo`
  - Prova: no navegador, o diálogo genérico tem o espaçamento do protótipo entre título, conteúdo e ações (CT-29, RF-30).
  - Trecho: na imagem, o diálogo "Registrar esta sessão de leitura?" com o texto e, 16 px abaixo, Cancelar e Registrar sessão à direita; na saída, `ok    título 8 px acima do corpo`, `ok    ações 16 px abaixo do corpo`, `ok    preenchimento de 24 px`, `ok    foco em Cancelar` e a última `ok  0 falha(s)`.
  - Falha: ações coladas no texto ou à esquerda, uma linha `FALHA` ou a última linha `FALHA  N falha(s)`.
  - Requer: `packages/ui/src/dialog/dialog.tsx`, `apps/web/src/app/dev/dialog-harness.tsx`
- `moeda-e-carregando.png` (print): `node apps/web/scripts/evidence-ui.mjs src/app/dev/dialog-harness.tsx "$VOSTOK_EVIDENCE/moeda-e-carregando.png" --query=cena=campos`
  - Prova: os valores aparecem como `R$ 14.500,00` e `R$ 14.500,50`, o campo vazio mostra o erro no próprio campo e os botões carregando têm indicador visível, nos temas claro e escuro (RF-13, RF-25, CT-24, CB-03).
  - Trecho: na imagem, os três campos e os botões Salvar (primário) e Enviar com o anel de carregando; na saída, `ok    valor formatado: R$ 14.500,00`, `ok    indicador de carregando visível` em cada botão e a última `ok  0 falha(s)`.
  - Falha: valor sem separador de milhar, botão sem o anel, uma linha `FALHA` ou a última linha `FALHA  N falha(s)`.
  - Requer: `packages/ui/src/money-field/money-field.tsx`, `apps/web/src/app/dev/dialog-harness.tsx`

### Concluída quando

- [x] A `@atria/ui` tem um diálogo genérico com título, corpo e ações, com o espaçamento do protótipo, opções de alerta, de largura de 560 px e de fechar pelo fundo, Esc levado ao `onClose`, foco preso e envio de formulário pelo botão das ações (RF-30, CT-29).

  > Como comprovar: no `dialogo-generico.png`, ver as ações 16 px abaixo do texto e à direita; em `ui-tests.txt`, ver `✓` nos casos de `dialog.test.tsx`.

- [x] O `ConfirmDialog` usa o diálogo genérico e mantém a mesma API (RF-30).

  > Como comprovar: em `ui-tests.txt`, ver `✓` em `is built on Dialog, with the actions after the description` e nos quatro casos antigos de `confirm-dialog.test.tsx`.

- [x] O campo de moeda formata o valor ao digitar (`R$ 14.500,00`), completa os centavos ao sair, grava o mesmo valor em centavos e manda vazio quando tudo é apagado (RF-13, CB-03).

  > Como comprovar: em `ui-tests.txt`, ver `✓` nos casos de `money-mask.test.ts` e `money-field.test.tsx`; no `moeda-e-carregando.png`, ver os valores formatados.

- [x] O botão carregando mostra um indicador visível, tem `aria-busy` e ignora um segundo clique (RF-25, CT-24).

  > Como comprovar: em `ui-tests.txt`, ver `✓` em `shows a visible spinner while loading` e `ignores clicks while loading`; no print, ver o anel nos dois botões.

- [x] Testes, lint e checagem de tipos da `@atria/ui` e das telas do `@atria/web` com confirmação passam.

  > Como comprovar: rodar o bloco de "Verificação" e ver código 0.

## Descrição

### Resumo executivo

Três peças da biblioteca de componentes que o uso real mostrou faltar: um diálogo único com o espaçamento do protótipo, um campo de dinheiro que mostra "R$ 14.500,00" enquanto se digita e um botão que mostra claramente que está trabalhando.
Perfil padrão: componentes novos e compartilhados, que as telas adotam nas tarefas seguintes.
Depende da TASK-03 e libera as TASK-16, TASK-21, TASK-22 e TASK-24.

### Detalhes técnicos

**Abordagem.**
- `Dialog` (`packages/ui/src/dialog`): `<dialog>` nativo com `showModal`, título, corpo (`children`) e ações (`actions`) com `margin-top: var(--s4)` e `justify-content: flex-end`, preenchimento `var(--s6)` e largura `min(480px, 100vw - s8)`, como o `dialog` do protótipo. Atende o que a TASK-24 pede: `role` `alertdialog`, `size="wide"` (560 px, do protótipo), `close_on_backdrop`, Esc com `preventDefault` levado a `onClose`, `described_by` e botão de envio fora do corpo pelo atributo `form`. O preenchimento fica num `div` interno para o clique no próprio `<dialog>` ser o do fundo.
- `ConfirmDialog` passa a ser um `Dialog` com `role="alertdialog"`, sem mudar a API usada por mais de 15 telas. O Cancelar passa de `ghost` a `secondary`, como o `.btn` do protótipo.
- `MoneyField` (`packages/ui/src/money-field`): máscara de exibição sobre o `TextField`; centavos inteiros no `onChange` (RN-09). Ao digitar, mostra o símbolo, os milhares e até dois decimais digitados; ao sair, completa com `,00`. Separadores, símbolo e posição vêm do `Intl` do locale e da moeda (padrão `pt-BR` e `BRL`). O campo do Financeiro passa a usá-lo na TASK-16.
- `Button` carregando: anel com `aria-hidden` antes do texto, nome acessível igual, `aria-busy` e `disabled` (já barram o segundo clique); o primário mantém a cor.

**Decisões.**
- Máscara que respeita o que se digita, no lugar da máscara de caixa registradora (dígitos entram pelos centavos). Descartada a de caixa: a CT-12 digita `14500` e espera `R$ 14.500,00`, ou seja, o número digitado é em reais.
- Completar os decimais só ao sair do campo. Descartado mostrar `,00` durante a digitação: o cursor saltaria a cada tecla.
- Animação do anel com `--motion-slow` (320 ms por volta), no limite de [project/frontend-04]; com "reduzir movimento" o anel fica parado e continua visível.
- `confirm-dialog.module.css` e `index.ts` entram em "Mudar" além dos componentes do plano: sem eles ficariam classes mortas ([project/code-style-08]) e os componentes novos sem exportação. Nenhuma outra tarefa da onda 2 lista esses arquivos.
- Print por harness (`apps/web/src/app/dev/dialog-harness.tsx` com o script `evidence-ui.mjs` da TASK-03), sem servidor: nenhuma tela usa o campo de moeda antes da TASK-16.

**Riscos.** O `jsdom` não tem `showModal`: os testes definem o método, como os de hoje. Testes de telas que procurem o Cancelar por classe `ghost` quebrariam; os de hoje procuram por papel e nome.

**Referências.** RF-13, RF-25, RF-30, CT-24, CT-29, CB-03, CB-04, RN-09, decisões 12, 14 e 20 (inferências D, F e L).

**Arquivos em comum na onda 2.** Nenhum com as TASK-13, TASK-18 e TASK-27. `packages/ui/src/index.ts` foi alterado pela TASK-03 (onda 1).

### Card

- **Título:** Diálogo, campo de moeda e botão carregando na @atria/ui
- **Tipo:** tarefa
- **Descrição:** Diálogo genérico com o espaçamento do protótipo, campo de moeda com máscara ao digitar e botão com indicador visível de carregando, na `@atria/ui`.
- **Critérios de aceite:**
  - [ ] Diálogo genérico com título, corpo e ações no espaçamento do protótipo, com alerta, largura larga e fechar pelo fundo.
  - [ ] O diálogo de confirmação usa o diálogo genérico.
  - [ ] O campo de moeda mostra `R$ 14.500,00` e grava centavos.
  - [ ] O botão carregando mostra um indicador e ignora o segundo clique.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-03

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 6 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 2 com acréscimo |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | conferência | usuário | print dialogo-generico.png conferido pelo usuário (sha256 e84f9938) |
| 7 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 8 | 2026-11-01 | conferência | usuário | print moeda-e-carregando.png conferido pelo usuário (sha256 05919ccd) |
| 9 | 2026-11-01 | evidências | passed | 3 evidência(s) em evidence/TASK-04/ |
| 10 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
