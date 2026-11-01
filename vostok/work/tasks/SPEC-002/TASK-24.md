---
id: TASK-24
spec: SPEC-002
title: "Diálogos sobre o diálogo genérico"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-04]
wave: 3
covers: [RF-30, CT-29]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: 7863243d5cd8fa2c8cd9a6785087839ff3a89c45ae7962862434a5b7f96f3199
adjustments: 1
adjusted_at: 2026-11-01T12:22:21Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: 9e25f4983caaed352a5c9dbb49d1dd22362c14089ccd7f076b949076b468b545
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T12:22:21Z
---

# TASK-24: Diálogos sobre o diálogo genérico

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Componentes compartilhados: 6 diálogos `<dialog>` feitos à mão com espaçamentos diferentes), RF-30, CT-29, CA-09, RNF-02, RNF-03, a interface `DialogProps` em "Contratos e interfaces" e a decisão 20 (inferência L, diálogo genérico na `@atria/ui`) do "Registro de decisões".
- `vostok/work/tasks/SPEC-002/TASK-04.md`, `packages/ui/src/dialog/` e `packages/ui/src/index.ts`: o `Dialog` criado pela TASK-04 (props, papel, descrição, largura, fechar pelo fundo, foco e Esc) e o `ConfirmDialog` montado sobre ele.
- `vostok/memory/decisions.md` (DEC-009): telas não mudam a `packages/ui`; CSS por feature só com tokens.
- `vostok/rules/project/architecture.md`: [project/architecture-10] (modal só para confirmação, com a exceção da paleta de comandos); o diálogo de escolher o que criar vem da PD-09 de `docs/decisoes-do-prototipo.md`.
- `vostok/rules/project/frontend.md`: [project/frontend-02], [project/frontend-04], [project/frontend-09], [project/frontend-10] e [project/frontend-17].
- `vostok/rules/project/code-style.md`: [project/code-style-08] (sem código morto) e [project/code-style-10].
- `vostok/rules/project/testing.md`: [project/testing-04] e [project/testing-10].
- `prototype/atria-prototype.html` (linhas 743 a 746, CSS de `dialog`: `padding: var(--s6)`, `h2` com `margin-bottom: var(--s2)`, `.form-actions` com `margin-top: var(--s4)` à direita; linha 655, `#create-dialog` com 560 px; linha 2719, o clique no fundo fecha o diálogo de criar).
- `apps/web/src/features/reader/session-offer-dialog.tsx` e `apps/web/src/features/reader/reader.module.css` (classes `.dialog`, `.dialogTitle`, `.dialogText`, `.actions` e `.error`, linhas 290 a 330).
- `apps/web/src/features/reader/reader-page.tsx` (fn `onKeyDown`, que ignora a tecla com `defaultPrevented`): o Esc do diálogo não pode fechar o leitor.
- `apps/web/src/features/finance/components/finance-dialog.tsx` e `apps/web/src/features/finance/components/finance.module.css` (classes `.dialog*`, linhas 410 a 455); usos em `apps/web/src/features/finance/screens/account-detail-screen.tsx` e `apps/web/src/features/finance/screens/category-detail-screen.tsx` (só leitura).
- `apps/web/src/features/projects/delete-lane-dialog.tsx` e `apps/web/src/features/projects/projects.module.css` (classes `.dialog*`, linhas 500 a 540); uso em `apps/web/src/features/projects/project-settings-tab.tsx` (só leitura).
- `apps/web/src/shared/forms/create-type-dialog.tsx` e `apps/web/src/shared/forms/create-type-dialog.module.css`; usos em `apps/web/src/features/finance/components/finance-shell.tsx` e `apps/web/src/features/library/shelf-page.tsx` (só leitura).
- Testes: `apps/web/src/shared/forms/create-type-dialog.test.tsx`, `apps/web/src/features/projects/delete-lane-dialog.test.tsx`, `apps/web/src/features/reader/use-reading-session-offer.test.tsx`, `apps/web/src/features/finance/screens/accounts-screens.test.tsx` e `apps/web/src/features/finance/screens/categories-screens.test.tsx` (procuram `alertdialog` pelo nome).
- Páginas de evidência (só leitura): `apps/web/src/features/finance/evidence/harness.tsx`, `apps/web/src/features/projects/evidence/harness.tsx`, `apps/web/src/features/library/evidence/harness.tsx`, `apps/web/src/features/reader/evidence/harness.tsx` e `apps/web/src/features/journal/evidence/harness.tsx`.
- `apps/web/scripts/evidence-journal.mjs`: molde do script de evidência; ler por trecho: `startVite`, `installApi`, `openPage`, `baseChecks`, `gotoApp` e `sheet`.

### Mudar

- `apps/web/src/features/reader/session-offer-dialog.tsx` (alterar): o diálogo de registrar a sessão de leitura usa o `Dialog` genérico, com o formulário no corpo e as ações no rodapé (RF-30).
- `apps/web/src/features/reader/reader.module.css` (alterar): tirar o espaçamento e a caixa próprios do diálogo (RF-30).
- `apps/web/src/features/finance/components/finance-dialog.tsx` (alterar): montar sobre o `Dialog` genérico, mantendo as props e o papel `alertdialog` (RF-30).
- `apps/web/src/features/projects/delete-lane-dialog.tsx` (alterar): montar sobre o `Dialog` genérico, mantendo as props e o papel `alertdialog` (RF-30).
- `apps/web/src/shared/forms/create-type-dialog.tsx` (alterar): montar sobre o `Dialog` genérico, mantendo as props, as setas entre os cartões e o fechar pelo fundo (RF-30).
- `apps/web/src/features/finance/components/finance.module.css` (alterar): tirar as classes `.dialog*` que ficam sem uso ([project/code-style-08]).
- `apps/web/src/features/projects/projects.module.css` (alterar): tirar as classes `.dialog*` que ficam sem uso ([project/code-style-08]).
- `apps/web/src/shared/forms/create-type-dialog.module.css` (alterar): tirar a caixa, o fundo, o título e as ações próprios, que passam ao `Dialog` ([project/code-style-08]).
- `apps/web/src/app/no-hand-made-dialogs.test.ts` (criar): teste de regressão que recusa `<dialog` e `showModal(` nos componentes do app.
- `apps/web/src/shared/forms/create-type-dialog.test.tsx` (alterar): teste do diálogo de criar sobre o genérico.
- `apps/web/src/features/projects/delete-lane-dialog.test.tsx` (alterar): teste do papel e do nome no diálogo genérico.
- `apps/web/src/features/reader/use-reading-session-offer.test.tsx` (alterar): teste do envio do formulário pelo botão do rodapé e do Esc que não fecha o leitor.
- `apps/web/scripts/evidence-dialogs.mjs` (criar): print dos cinco diálogos com o espaçamento medido, gravado no caminho recebido como argumento.

### Passos

1. Ler `packages/ui/src/dialog/` e a seção "Execução" de `vostok/work/tasks/SPEC-002/TASK-04.md` e anotar a interface exportada de `Dialog` (`DialogProps`). Esta tarefa precisa de: `open`, `title`, `onClose`, `children` e `actions` (contrato da spec); o papel `alertdialog` (o `ConfirmDialog` sobre o `Dialog` já exige); uma largura maior para o diálogo de criar (560 px do protótipo); o fechar pelo clique no fundo; o foco preso, o Esc chamando `onClose` com `preventDefault` e o foco de volta a quem abriu. Se faltar o papel, a largura, o fechar pelo fundo ou o Esc com `preventDefault`, **PARE** e responda com o template `blocker`, pedindo o ajuste da TASK-04 pela skill `adjust-task`: esta tarefa não muda a `packages/ui` (DEC-009). A ligação da descrição (`aria-describedby`) é usada se o `Dialog` oferecer; senão, o texto fica só no corpo.
2. Escrever os testes antes do código:
   - `apps/web/src/app/no-hand-made-dialogs.test.ts` (novo, `describe('dialogs')`): `uses the generic dialog in every app dialog`, que lê com `readdirSync` recursivo os `.tsx` de `src/` (sem `*.test.tsx` e sem `*/evidence/*`) e espera nenhum arquivo com `<dialog` ou `showModal(`.
   - `create-type-dialog.test.tsx`: acrescentar `renders on the generic dialog with the cancel action in the footer` (o `dialog` com o nome do título e o botão "Cancelar" depois da lista de cartões); manter os testes existentes, entre eles `closes when the backdrop is clicked, but not the dialog padding`, `moves between the cards with the arrow keys in the grid` e `closes with Escape and returns the focus to the trigger`.
   - `delete-lane-dialog.test.tsx`: acrescentar `keeps the alertdialog role and the lane name on the generic dialog`.
   - `use-reading-session-offer.test.tsx`: acrescentar `confirms the session with the footer button of the generic dialog` e `skips the session with escape without closing the reader`; manter os testes existentes.
3. Rodar `pnpm --filter @atria/web exec vitest run src/app/no-hand-made-dialogs.test.ts src/shared/forms/create-type-dialog.test.tsx src/features/projects/delete-lane-dialog.test.tsx src/features/reader/use-reading-session-offer.test.tsx` e confirmar que os testes novos falham por falta da implementação.
4. Alterar `finance-dialog.tsx`: manter `FinanceDialogProps`; renderizar `<Dialog>` com `open`, `title`, `onClose={onCancel}`, o papel `alertdialog`, o `children` no corpo e `actions` com o botão "Cancelar" (`variant="ghost"`, `ref={cancelRef}`) seguido de `actions`; um `useEffect` em `[open]` foca `cancelRef` depois de abrir, como hoje. Tirar o `<dialog>`, o `showModal`, o `onKeyDown` de foco e Esc e a constante `FOCUSABLE`, que o `Dialog` já faz.
5. Alterar `delete-lane-dialog.tsx`: manter as props e a lógica de `confirm`; renderizar `<Dialog>` com `open={lane !== undefined}`, o título `projects.delete_lane.title`, `onClose={onClose}`, o papel `alertdialog`; no corpo, o texto, o `SelectField` da raia de destino e o erro com `role="alert"`; nas ações, o botão de fechar ou cancelar e o "Excluir" com `loading`. Tirar o `<dialog>` e o `useEffect` de `showModal`.
6. Alterar `create-type-dialog.tsx`: manter `CreateTypeDialogProps`; renderizar `<Dialog>` com `open`, `title`, `onClose={on_close}`, a largura maior e o fechar pelo fundo do `Dialog`; a descrição no corpo (ligada por `aria-describedby` se o `Dialog` oferecer); a lista de cartões dentro de um `<div role="presentation" onKeyDown={onArrowKeys}>`, com a lógica atual das setas, de Home e de End movida do `onKeyDown` do `<dialog>` para esse `div`; as ações com o botão "Cancelar"; um `useEffect` em `[open, focused_type]` foca o cartão do tipo da aba ou o primeiro, como hoje. Tirar o `<dialog>`, o `showModal`, o Esc próprio e `onBackdropClick`.
7. Alterar `session-offer-dialog.tsx`: manter `SessionOfferDialogProps`; renderizar `<Dialog>` com `open`, o título `reader.session_offer_title` e `onClose={onSkip}`; no corpo, `<form id={form_id} onSubmit={submit} noValidate>` (com `form_id` de `useId`) com o texto `reader.session_offer_text`, o `TextField` de páginas (com o `autoFocus` atual) e o erro com `role="alert"`; nas ações, "Pular" (`variant="ghost"`, `disabled={is_pending}`) e "Registrar" (`type="submit"`, `form={form_id}`, `loading={is_pending}`). Tirar o `<dialog>`, o `showModal` e o `onKeyDown` próprio; o Esc do `Dialog` com `preventDefault` não chega a fechar o leitor, porque o `onKeyDown` de `reader-page.tsx` ignora a tecla com `defaultPrevented`.
8. Limpar o CSS, só tirando o que ficou sem uso (conferir cada classe com `grep -rn 'styles.<classe>'` na pasta da feature antes de remover): em `reader.module.css`, `.dialog`, `.dialog::backdrop`, `.dialogTitle` e `.dialogText` (`.actions` e `.error` continuam, usados por `passage-note-panel.tsx`); em `finance.module.css`, `.dialog`, `.dialog::backdrop`, `.dialogTitle`, `.dialogBody`, `.dialogBody p` e `.dialogActions`; em `projects.module.css`, `.dialog`, `.dialog::backdrop`, `.dialogTitle`, `.dialogText` e `.dialogActions`; em `create-type-dialog.module.css`, `.root`, `.root::backdrop`, `.title` e `.actions` (`.description`, `.choices` e `.card*` continuam). Se o texto do corpo precisar de cor `--text-muted` ou de espaço entre parágrafos e o `Dialog` não der, manter só essa regra, com tokens.
9. Rodar os testes de "Verificação" até passar; depois `pnpm --filter @atria/web typecheck`, o ESLint e o Prettier da Verificação, sem nenhum warning.
10. Criar `apps/web/scripts/evidence-dialogs.mjs`, em Node sem dependências novas, com código próprio no molde de `apps/web/scripts/evidence-journal.mjs` (sem importá-lo): uso `node apps/web/scripts/evidence-dialogs.mjs <caminho.png>`; sobe o Vite numa porta livre com a página virtual `/__evidence/<feature>` que carrega `src/features/<feature>/evidence/harness.tsx` (finance, projects, library, reader e journal) e encerra ao fim (KNW-006); simula a API de cada um com fixtures em memória; abre os cinco diálogos: o da conta com movimentações (Financeiro), o de excluir raia com cartões (Projetos), o de criar no Acervo, o de registrar a sessão de leitura (fecha o leitor depois de avançar páginas) e o `ConfirmDialog` de remover emoção (Diário); temas claro e escuro, a 1280 px e a 360 px. Em cada diálogo, confere: `padding` computado igual ao de `--s6`; distância entre o fim do corpo e o topo das ações igual a `--s4`; margem abaixo do título igual a `--s2`; as ações alinhadas à direita; as medidas iguais às do `ConfirmDialog`; o diálogo inteiro dentro da janela a 360 px; o tema, a falta de erro de JS e o axe sem violações (inclui `color-contrast`). Imprime `ok` ou `FALHA` por verificação com as medidas, monta a prancha rotulada no caminho do argumento, imprime `png: <caminho> (N capturas)` e a última linha `ok  0 falha(s)`, e sai com código 1 se algo falhar.
11. Rodar o comando de print de "Evidências" com `VOSTOK_EVIDENCE` apontando para uma pasta temporária, corrigir o código da tarefa a cada `FALHA` e abrir a prancha para conferir.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/shared/forms/create-type-dialog.test.tsx src/features/projects/delete-lane-dialog.test.tsx src/features/projects/project-settings-tab.test.tsx src/features/reader/use-reading-session-offer.test.tsx src/features/finance/screens/accounts-screens.test.tsx src/features/finance/screens/categories-screens.test.tsx src/features/finance/components/components.test.tsx src/features/library/shelf-page.test.tsx --reporter=verbose 2>/dev/null | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/reader src/features/finance/components src/features/projects src/shared/forms --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/reader src/features/finance/components src/features/projects src/shared/forms`

### Verificação

```bash
# evidência: dialogs-tests.txt
pnpm --filter @atria/web exec vitest run src/app/no-hand-made-dialogs.test.ts src/shared/forms/create-type-dialog.test.tsx src/features/projects/delete-lane-dialog.test.tsx src/features/projects/project-settings-tab.test.tsx src/features/reader/use-reading-session-offer.test.tsx src/features/finance/screens/accounts-screens.test.tsx src/features/finance/screens/categories-screens.test.tsx src/features/finance/components/components.test.tsx src/features/library/shelf-page.test.tsx --reporter=verbose
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/app/no-hand-made-dialogs.test.ts src/features/reader src/features/finance/components src/features/projects src/shared/forms --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/app/no-hand-made-dialogs.test.ts src/features/reader src/features/finance/components src/features/projects src/shared/forms scripts/evidence-dialogs.mjs
node --check apps/web/scripts/evidence-dialogs.mjs
```

### Evidências

- `dialogs-tests.txt` (automática, da verificação)
  - Prova: nenhum componente do app tem mais `<dialog>` feito à mão, e os diálogos de criar, de excluir raia, da conta e da categoria do Financeiro e da sessão de leitura funcionam sobre o `Dialog` genérico, com o mesmo papel, nome, foco, setas, Esc e fechar pelo fundo (RF-30, CT-29).
  - Trecho: `uses the generic dialog in every app dialog`, `renders on the generic dialog with the cancel action in the footer`, `keeps the alertdialog role and the lane name on the generic dialog`, `confirms the session with the footer button of the generic dialog` e `skips the session with escape without closing the reader` aprovados, os testes existentes dos mesmos arquivos aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests`, ou o teste `uses the generic dialog in every app dialog` listando um arquivo com `<dialog`.
- `dialogs.png` (print): `node apps/web/scripts/evidence-dialogs.mjs "$VOSTOK_EVIDENCE/dialogs.png"`
  - Requer: `apps/web/scripts/evidence-dialogs.mjs`
  - Prova: os cinco diálogos do app (sessão de leitura, conta com movimentações, excluir raia, criar no Acervo e confirmação) têm o mesmo espaçamento do protótipo entre conteúdo e ações, nos dois temas, a 1280 px e a 360 px (RF-30, CT-29).
  - Trecho: em cada diálogo, linhas `ok` de "padding igual a --s6", "corpo até as ações igual a --s4", "margem do título igual a --s2", "ações à direita", "igual ao ConfirmDialog", "dentro da janela a 360 px" e "axe sem violações (inclui color-contrast)", a linha `png:` e a última `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (espaçamento diferente entre diálogos, diálogo cortado a 360 px), a falta da linha `png:` ou código de saída diferente de 0.

### Concluída quando

- [x] Os diálogos de registrar a sessão de leitura, da conta e da categoria do Financeiro, de excluir raia e de criar usam o `Dialog` genérico da `@atria/ui`, sem nenhum `<dialog>` feito à mão no app (RF-30, CT-29).

  > Como comprovar: em `dialogs-tests.txt`, ver aprovado `uses the generic dialog in every app dialog` e os testes novos de cada diálogo.

- [x] Todos os diálogos têm o espaçamento do protótipo entre o conteúdo e as ações, iguais ao do diálogo de confirmação (RF-30, CT-29, CA-09).

  > Como comprovar: na prancha `dialogs.png`, ver os cinco diálogos lado a lado com o mesmo espaço entre o texto e os botões, e as linhas `ok` das medidas na saída do print.

- [x] Os diálogos mantêm o comportamento: papel e nome, foco inicial, setas entre os cartões de criar, Esc, fechar pelo fundo, foco de volta e o leitor que não fecha com o Esc do diálogo (RF-30).

  > Como comprovar: em `dialogs-tests.txt`, ver aprovados os testes existentes de `create-type-dialog.test.tsx`, `delete-lane-dialog.test.tsx`, `use-reading-session-offer.test.tsx` e das telas de contas e categorias, e `skips the session with escape without closing the reader`.

- [x] Os diálogos não têm violações no axe nos dois temas e cabem na tela a partir de 360 px (RNF-03, [project/frontend-17]).

  > Como comprovar: ver aprovados os `has no axe violations` de `create-type-dialog.test.tsx`; na saída do print, as linhas `ok` de axe e "dentro da janela a 360 px".

- [x] Typecheck, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a Verificação e ver que termina sem erro.

## Descrição

### Resumo executivo

Passa os quatro diálogos que ainda eram feitos à mão (registrar a sessão de leitura, avisos do Financeiro, excluir raia e escolher o que criar) para o diálogo padrão da biblioteca de componentes.
Todos ficam com o mesmo espaçamento do protótipo entre o conteúdo e os botões, o que corrige o diálogo da sessão de leitura relatado pelo usuário.
Perfil padrão, risco baixo: o comportamento de cada diálogo (teclado, foco e fechar) é mantido e coberto pelos testes existentes.
Depende do diálogo genérico da biblioteca de componentes e não bloqueia outras tarefas.

### Detalhes técnicos

- **Abordagem:** cada componente mantém as próprias props (os chamadores não mudam) e troca o `<dialog>` com `showModal`, foco preso e Esc próprios pelo `Dialog` da `@atria/ui` (TASK-04), passando o conteúdo como corpo e os botões como `actions`; as classes de caixa, fundo, título e ações de cada feature saem do CSS.
- **Componentes:** `session-offer-dialog.tsx`, `finance-dialog.tsx`, `delete-lane-dialog.tsx`, `create-type-dialog.tsx` e os CSS `reader.module.css`, `finance.module.css`, `projects.module.css` e `create-type-dialog.module.css`; `Dialog` da `@atria/ui` sem mudança nela (DEC-009).
- **Decisões:**
  - Manter os componentes de cada feature como invólucros finos do `Dialog`; descartado trocar os chamadores para usar o `Dialog` direto, que mudaria telas fora do plano sem ganho de espaçamento.
  - Formulário da sessão de leitura no corpo e o botão de enviar no rodapé com o atributo `form`; descartado um `Dialog` com `form` próprio, que a interface da spec não tem.
  - Setas dos cartões de criar num `div` com `role="presentation"` dentro do corpo, como o `reader-page.tsx` faz; descartado um `onKeyDown` no `Dialog`, que a interface não tem.
  - Papel `alertdialog` mantido nos diálogos de confirmação do Financeiro e de Projetos, porque os testes e o e2e do Financeiro os procuram por esse papel.
  - Teste que lê o código e recusa `<dialog` e `showModal(` no app, no molde do teste de CSS sem `danger` do Diário, para nenhum diálogo novo voltar a ser feito à mão; o seletor de cor (`packages/ui/src/color-field`) fica fora: está na `@atria/ui` e não está no plano.
  - Se o `Dialog` não tiver o papel, a largura maior, o fechar pelo fundo ou o Esc com `preventDefault`, a tarefa para e pede o ajuste da TASK-04, em vez de mudar a `@atria/ui` aqui.
- **Riscos:** a interface final do `Dialog` é decidida na TASK-04 (detalhada em paralelo); o passo 1 confere o que esta tarefa precisa antes de mudar qualquer arquivo. O Esc do diálogo da sessão não pode fechar o leitor: coberto por `skips the session with escape without closing the reader`.
- **Referências da spec:** RF-30, CT-29, CA-09, decisão 20 (inferência L); protótipo (CSS de `dialog` e `#create-dialog`).
- **Evidências visuais:** um print gerado por `apps/web/scripts/evidence-dialogs.mjs` sobre os harnesses do Financeiro, de Projetos, do Acervo, do leitor e do Diário, com as medidas do espaçamento, conferido pelo usuário na finalização.
- **Arquivos em comum na onda 3:** nenhum; a TASK-23 muda `load-pdf.ts`, `pdf-viewer.tsx` e `reader-page.tsx` do leitor, e esta tarefa só lê `reader-page.tsx`.

### Card

- **Título:** Diálogos sobre o diálogo genérico
- **Tipo:** bug
- **Descrição:** Os diálogos feitos à mão (sessão de leitura, Financeiro, excluir raia e criar) passam a usar o diálogo genérico da @atria/ui, com o espaçamento do protótipo entre conteúdo e ações.
- **Critérios de aceite:**
  - [ ] Nenhum `<dialog>` feito à mão no app; os quatro diálogos usam o genérico.
  - [ ] Mesmo espaçamento do protótipo entre conteúdo e ações em todos os diálogos.
  - [ ] Teclado, foco, Esc e fechar pelo fundo mantidos.
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
| 7 | 2026-11-01 | conferência | usuário | print dialogs.png conferido pelo usuário (sha256 766a3b70) |
| 8 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-24/ |
| 9 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | ESLint da Verificação sem o script de evidência, que o eslint.config.js do web ignora (o aviso de arquivo ignorado virava erro com --max-warnings 0); o script segue conferido por node --check e Prettier |
