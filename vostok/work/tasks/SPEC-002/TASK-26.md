---
id: TASK-26
spec: SPEC-002
title: "Checklist do cartão em lista"
profile: padrao
persona: ui-ux-designer
depends_on: []
wave: 1
covers: [RF-33, CT-32, CB-12]
type: historia
labels: [SPEC-002, padrao]
status: done
content_hash: 323a55ac8210bc9b22ff6a365b8e10e83f7f1e31e91d8b2a134e3bd29ab213a9
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: d05bb551e14d38367bf78b81d359232cd4bb6a6fff68ab14353c550d6cf1f7d4
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-26: Checklist do cartão em lista

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Projetos: o checklist é um `textarea` convertido por `parseChecklist`, embora o servidor já guarde itens), RF-33, CT-32, CB-12, RNF-03, RNF-07, a premissa do dnd-kit, o risco do tamanho do bundle e a decisão 7 (resposta 7A).
- `vostok/rules/project/frontend.md`, `vostok/rules/project/code-style.md`, `vostok/rules/project/testing.md`, `vostok/rules/project/language.md`, `vostok/rules/project/naming-convention.md` e `vostok/rules/project/stack.md` ([project/stack-12]: dependência nova só com justificativa na tarefa).
- `docs/decisoes-do-prototipo.md`: linhas PD-46 (formulário do cartão) e PD-47 (puxador de seis pontinhos, setas pelo teclado).
- `prototype/atria-prototype.html`: só por busca, o formulário do cartão (`checklist_text`) e a linha de raia com o puxador (`po-lanes`, `handle`); o protótipo ainda tem o `textarea`, a lista é a mudança pedida pelo RF-33.
- `apps/web/package.json`: dependências atuais.
- `apps/web/src/features/projects/card-form-page.tsx`: esquema `zod`, `defaultValues`, `save` e o bloco do checklist (`checklist_id`).
- `apps/web/src/features/projects/use-kanban.ts`: `CardInput`, `parseChecklist` e `formatChecklist`.
- `apps/web/src/features/projects/use-projects.ts`: tipo `ChecklistItem` (`Schemas['ChecklistItemResponse']`).
- `apps/web/src/features/projects/project-settings-tab.tsx`: o puxador das raias (`HandleIcon`, `onKeyDown` com `ArrowUp`/`ArrowDown`, mapa `handles` e o foco devolvido depois de mover) como padrão de teclado.
- `apps/web/src/features/projects/icons.tsx`: `HandleIcon`.
- `apps/web/src/features/projects/projects.module.css` (622 linhas): `.hint` (linha 195), `.srOnly` (linhas 411-422), `.handle` (linhas 469-488) e `.textareaRoot`/`.textareaLabel`/`.textarea` (linhas 544-583).
- `apps/web/src/features/projects/i18n/pt-br.json`: chaves `card_form.*`.
- `apps/web/src/features/projects/card-form-page.test.tsx` e `apps/web/src/features/projects/test-server.ts` (fn `stubServer`, rotas `POST`/`PATCH` de cartões, linhas 330-375, que já gravam o `checklist` em itens com `id` e `position`).
- `apps/web/src/features/projects/use-kanban.test.tsx`: bloco `kanban helpers`.
- `apps/web/src/features/projects/projects.e2e.ts`: o passo que preenche o checklist (`getByLabel('Checklist').fill`).
- `apps/web/scripts/evidence-projects.mjs` (955 linhas): `OUT` (linha 19), fn `installApi` (rotas de `cards`, linhas 362-376), fn `openPage`, fn `runScenarios`, fn `sheet` e `EVIDENCES` (linha 903).
- `apps/web/src/features/projects/evidence/harness.tsx`: página que o script fotografa.
- `packages/ui/src/index.ts` e `packages/ui/src/icon-button/icon-button.tsx`: `IconButton` com `aria-label` obrigatório.
- Documentação do dnd-kit (`@dnd-kit/core` 6.3.1 e `@dnd-kit/sortable` 10.0.0): `DndContext`, `useSensors`, `PointerSensor`, `TouchSensor`, `SortableContext`, `useSortable`, `verticalListSortingStrategy`, `arrayMove` e a opção `accessibility` (anúncios e instruções).

### Mudar

- `apps/web/package.json` (alterar): acrescentar `@dnd-kit/core`, `@dnd-kit/sortable` e `@dnd-kit/utilities` às dependências (decisão 7A; justificativa de [project/stack-12] nos Detalhes técnicos).
- `pnpm-lock.yaml` (alterar): lockfile atualizado pelo `pnpm add` das dependências do dnd-kit.
- `apps/web/src/features/projects/checklist-field.tsx` (criar): `ChecklistField`, o checklist em lista com caixa de marcação, campo vazio no fim, remoção e reordenação pela alça (mouse, toque e teclado).
- `apps/web/src/features/projects/card-form-page.tsx` (alterar): trocar o `textarea` do checklist pelo `ChecklistField` e gravar os itens na ordem e no estado mostrados.
- `apps/web/src/features/projects/use-kanban.ts` (alterar): tirar `parseChecklist` e `formatChecklist` e criar as funções puras do rascunho do checklist.
- `apps/web/src/features/projects/projects.module.css` (alterar): estilos da lista do checklist, da alça, da linha arrastada e do campo vazio do fim.
- `apps/web/src/features/projects/i18n/pt-br.json` (alterar): textos do checklist em lista (rótulos, ajuda, anúncios e erros); sai a ajuda do `textarea`.
- `apps/web/src/features/projects/checklist-field.test.tsx` (criar): testes de componente do checklist (Enter, campo vazio, marcar, remover, reordenar pelo teclado, anúncios e axe).
- `apps/web/src/features/projects/card-form-page.test.tsx` (alterar): os casos do checklist passam a usar a lista; sai o caso do `parseChecklist`.
- `apps/web/src/features/projects/use-kanban.test.tsx` (alterar): testes das funções puras do rascunho do checklist.
- `apps/web/src/features/projects/projects.e2e.ts` (alterar): o fluxo do CT-30 preenche o checklist pela lista, com Enter e reordenação pela alça.
- `apps/web/scripts/evidence-projects.mjs` (alterar): modo `checklist`, que fotografa o checklist em lista no navegador, e a pasta de saída lida de `VOSTOK_EVIDENCE`.

### Passos

1. Instale as dependências na raiz do repositório: `pnpm --filter @atria/web add @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2`. Confira que `apps/web/package.json` ganhou as três entradas em `dependencies` e que `pnpm-lock.yaml` mudou. Não instale nenhum outro pacote.
2. Escreva primeiro os testes das funções puras em `apps/web/src/features/projects/use-kanban.test.tsx`, num bloco novo `describe('checklist drafts', ...)`, com os nomes exatos:
   - `rf33 builds drafts from the card items in position order`: `toChecklistDrafts` recebe itens fora de ordem (`position` 1 e 0) e devolve `[{ key: id, text, done }]` na ordem de `position`.
   - `rf33 appends a trimmed item at the end`: `appendChecklistItem(items, '  Lixar  ')` devolve a lista com `{ text: 'Lixar', done: false }` no fim e uma `key` nova, diferente das existentes.
   - `cb12 ignores an item made only of spaces`: `appendChecklistItem(items, '   ')` devolve uma lista igual à de entrada.
   - `rf33 moves an item and clamps the target`: `moveChecklistItem(items, 0, 2)` leva o primeiro para a terceira posição; `moveChecklistItem(items, 0, -1)` e `moveChecklistItem(items, 2, 9)` devolvem a mesma ordem.
   - `rf33 removes an item by key` e `rf33 sends only filled items in order`: `removeChecklistItem` tira o item pela `key`; `toChecklistInput` devolve `[{ text, done }]` com o texto aparado, sem os itens vazios, na ordem da lista.
3. Escreva os testes de componente em `apps/web/src/features/projects/checklist-field.test.tsx` (criar), renderizando o `ChecklistField` com `renderWithProviders` de `apps/web/src/shared/test/render` dentro de um componente de teste que guarda os itens num `useState` e mostra `JSON.stringify(items)` num `<output data-testid="items">`. Casos, com os nomes exatos:
   - `rf33 adds an item with Enter and keeps an empty input at the end`: digitar `Medir{Enter}` no campo "Novo item do checklist" cria o item "Medir", o campo do fim volta vazio e continua com o foco, e nenhum formulário é enviado (o `Enter` tem `preventDefault`).
   - `cb12 does not add an item made only of spaces`: digitar três espaços e `{Enter}` não cria item e o campo do fim fica vazio.
   - `rf33 adds the pending text when the input loses focus`: digitar `Comparar` e sair do campo com `Tab` cria o item.
   - `rf33 marks an item as done`: clicar na caixa "Feito: Medir" marca `done: true` no item.
   - `rf33 removes an item`: clicar em "Remover o item Medir" tira o item e leva o foco ao campo do fim.
   - `rf33 reorders with the arrow keys on the handle`: com três itens, focar a alça "Reordenar o item A, posição 1 de 3" e teclar `{ArrowDown}` deixa a ordem B, A, C, o foco continua na alça do item A (agora "posição 2 de 3") e a região `role="status"` anuncia "Item “A” na posição 2 de 3.".
   - `rf33 moves to the next item input with Enter`: `Enter` no campo de um item leva o foco ao campo do item seguinte ou, no último, ao campo do fim, sem criar item.
   - `rf33 has no axe violations`: `axe(container)` sem violações, com dois itens e um marcado.
4. Atualize `apps/web/src/features/projects/card-form-page.test.tsx`:
   - Tire o import de `parseChecklist` e o caso `pd46 parses the checklist lines with done items marked by [x]`.
   - No caso `pd46 creates a card with title description lane due date priority labels and checklist`, troque o `paste` no `textarea` por: digitar `Medir o canto{Enter}` e `Escolher a cor{Enter}` no campo "Novo item do checklist" e marcar a caixa "Feito: Medir o canto"; o corpo esperado continua `checklist: [{ text: 'Medir o canto', done: true }, { text: 'Escolher a cor', done: false }]`.
   - No caso `pd46 edits a card with PATCH and moves it with the move route when the lane changes`, troque a conferência do `textarea` por: os campos "Item 1 do checklist" e "Item 2 do checklist" com os valores `Medir` e `Comparar`, e a caixa "Feito: Medir" marcada.
   - Acrescente `rf33 saves the checklist in the order and state shown`: abrir `/projects/p-1/cards/c-1`, focar a alça "Reordenar o item Comparar, posição 2 de 2", teclar `{ArrowUp}`, remover "Medir", acrescentar `Pintar{Enter}`, salvar e ver no `PATCH` `checklist: [{ text: 'Comparar', done: false }, { text: 'Pintar', done: false }]`.
   - Acrescente `rf33 refuses a checklist item longer than 300 characters inside the form`: um item de 301 caracteres mostra, com `role="alert"`, "Cada item do checklist tem até 300 caracteres." e nenhum `POST` é feito.
5. Rode `pnpm --filter @atria/web exec vitest run src/features/projects/use-kanban.test.tsx src/features/projects/checklist-field.test.tsx src/features/projects/card-form-page.test.tsx` e confira que os casos novos falham (o componente e as funções ainda não existem).
6. Em `apps/web/src/features/projects/use-kanban.ts`, tire `parseChecklist` e `formatChecklist` e crie, no lugar, exportados:
   - `export interface ChecklistDraft { key: string; text: string; done: boolean }`.
   - `export const CHECKLIST_MAX_ITEMS = 100` e `export const CHECKLIST_TEXT_MAX_CHARS = 300` (os limites de `apps/server/src/projects/domain/card.rs`).
   - `newChecklistKey(): string`, com um contador de módulo, devolvendo `novo-1`, `novo-2`...
   - `toChecklistDrafts(items: readonly Pick<ChecklistItem, 'id' | 'text' | 'done' | 'position'>[]): ChecklistDraft[]`, ordenado por `position`, com `key` igual ao `id`.
   - `appendChecklistItem(items: readonly ChecklistDraft[], text: string): ChecklistDraft[]`: apara o texto; vazio devolve `[...items]`; senão acrescenta `{ key: newChecklistKey(), text, done: false }` no fim.
   - `updateChecklistItem(items, key, patch: Partial<Pick<ChecklistDraft, 'text' | 'done'>>)`, `removeChecklistItem(items, key)` e `moveChecklistItem(items, from: number, to: number)`: este devolve `[...items]` quando `to` sai de `0..items.length - 1` e, senão, usa `arrayMove` de `@dnd-kit/sortable`.
   - `toChecklistInput(items: readonly ChecklistDraft[]): CardInput['checklist']`: `{ text: text.trim(), done }`, sem os itens de texto vazio depois de aparar.
7. Crie `apps/web/src/features/projects/checklist-field.tsx`, exportando `ChecklistField` com as props `{ label: string; help: string; items: readonly ChecklistDraft[]; onChange: (items: ChecklistDraft[]) => void; error?: string | undefined }`:
   - Raiz `<fieldset className={styles.checklist} data-span="full">` com `<legend className={styles.textareaLabel}>{label}</legend>` e, abaixo da lista, `<p id={help_id} className={styles.hint}>{help}</p>`; com `error`, `<p role="alert" className={styles.error}>{error}</p>`.
   - `DndContext` com `sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }))`, `collisionDetection={closestCenter}`, `modifiers` não usados, e `accessibility={{ screenReaderInstructions: { draggable: t('projects.checklist.drag_instructions') }, announcements }}`, em que `announcements` traduz `onDragStart`, `onDragOver`, `onDragEnd` e `onDragCancel` com as chaves `projects.checklist.drag_start`, `projects.checklist.drag_over`, `projects.checklist.moved` e `projects.checklist.drag_cancel` (nunca o texto em inglês da biblioteca). O teclado não usa o `KeyboardSensor`: é o `onKeyDown` da alça (passo abaixo), como em Configurações › Raias (PD-47).
   - `onDragEnd({ active, over })`: sem `over` ou com `active.id === over.id`, nada; senão `onChange(moveChecklistItem(items, de, para))`, com os índices pela `key`.
   - `SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}` envolvendo `<ul className={styles.checklistList}>`, com uma linha `ChecklistRow` por item e, por último, um `<li className={styles.checklistNew}>` fora do `SortableContext` com o campo do fim.
   - `ChecklistRow` (função interna do arquivo) usa `useSortable({ id: item.key, transition: null })` (a transição sai do CSS, com os tokens `--motion-*`, e não da duração fixa da biblioteca); o `<li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform) }} className={[styles.checklistRow, isDragging ? styles.checklistRowDragging : ''].filter(Boolean).join(' ')}>` tem, nesta ordem: a alça `<button type="button" ref={setActivatorNodeRef} className={styles.handle} aria-label={t('projects.checklist.handle', { item: nome, position, total })} {...attributes} {...listeners} onKeyDown={...}>` com `<HandleIcon />`; a caixa `<input type="checkbox" className={styles.checklistCheck} checked={item.done} aria-label={t('projects.checklist.done', { item: nome })} />`; o campo `<input type="text" className={styles.checklistInput} value={item.text} aria-label={t('projects.checklist.item', { position })} maxLength={CHECKLIST_TEXT_MAX_CHARS + 1} />`; e `IconButton` com `aria-label={t('projects.checklist.remove', { item: nome })}` e um `RemoveIcon` (SVG de "×" definido no próprio arquivo, `aria-hidden="true"`, `focusable="false"`, `stroke="currentColor"`). `nome` é o texto aparado ou, vazio, `t('projects.checklist.untitled', { position })`.
   - Alça: `ArrowUp`/`ArrowDown` chamam `preventDefault`, aplicam `moveChecklistItem(items, index, index ∓ 1)`, guardam a `key` num `useRef` para devolver o foco à alça depois da nova renderização (mapa de alças por `key`, como `handles` do `project-settings-tab.tsx`) e gravam o anúncio `t('projects.checklist.moved', { item: nome, position: nova + 1, total })` num estado mostrado em `<p role="status" aria-live="polite" className={styles.srOnly}>`; nos limites (primeira para cima, última para baixo), nada.
   - Campo de um item: `onChange` aplica `updateChecklistItem(items, key, { text })`; `Enter` faz `preventDefault` e foca o campo do item seguinte ou, no último, o campo do fim.
   - Caixa: `onChange` aplica `updateChecklistItem(items, key, { done: event.target.checked })`.
   - Remover: aplica `removeChecklistItem`, anuncia `t('projects.checklist.removed', { item: nome })` e foca o campo do fim.
   - Campo do fim: estado local `draft`; `<input type="text" className={styles.checklistInput} aria-label={t('projects.checklist.new_item')} placeholder={t('projects.checklist.new_item_placeholder')} aria-describedby={help_id} />`; `Enter` faz `preventDefault`, aplica `appendChecklistItem(items, draft)` (quando o texto aparado não é vazio) e zera o `draft`, mantendo o foco; `onBlur` faz o mesmo sem mover o foco; só espaços apenas zeram o `draft` (CB-12).
8. Em `apps/web/src/features/projects/card-form-page.tsx`:
   - No esquema, troque `checklist: z.string()` por `checklist: z.array(z.object({ key: z.string(), text: z.string(), done: z.boolean() })).max(CHECKLIST_MAX_ITEMS, 'projects.card_form.checklist_too_many').refine((items) => items.every((item) => item.text.trim().length <= CHECKLIST_TEXT_MAX_CHARS), { message: 'projects.card_form.checklist_item_too_long' })`.
   - Em `defaultValues`, `checklist: toChecklistDrafts(card?.checklist ?? [])`; em `save`, `checklist: toChecklistInput(values.checklist)`.
   - Tire o `checklist_id` e o bloco do `textarea` do checklist e use, no lugar, `<Controller control={control} name="checklist" render={({ field, fieldState }) => (<ChecklistField label={t('projects.card_form.field_checklist')} help={t('projects.card_form.checklist_help')} items={field.value} onChange={field.onChange} error={fieldState.error?.message ? t(fieldState.error.message) : undefined} />)} />` (import de `Controller` de `react-hook-form`).
   - Atualize os imports de `./use-kanban` (sem `formatChecklist` e `parseChecklist`).
9. Em `apps/web/src/features/projects/projects.module.css`, acrescente, só com tokens do tema ([project/code-style-10]): `.checklist` (sem borda nem margem do `fieldset`, `display: flex; flex-direction: column; gap: var(--space)`, `min-width: 0`); `.checklistList` (lista sem marcador, `gap: var(--s2)`); `.checklistRow` e `.checklistNew` (grade `calc(var(--space) * 4) auto minmax(0, 1fr) auto`, `align-items: center`, `gap: var(--s2)`; o `.checklistNew` ocupa a coluna do campo e deixa a da alça e a da caixa vazias, para alinhar ao texto dos itens); `.checklistRowDragging` (`position: relative; z-index: 5; box-shadow: var(--shadow-lg)`); `.checklistCheck` (`accent-color: var(--primary)`, `inline-size` e `block-size` de `calc(var(--space) * 4)`); `.checklistInput` com o mesmo desenho do `.textarea` numa linha (borda `--border-strong`, `--radius-md`, `--surface`, foco visível com `outline: 2px solid var(--primary)`), e `.error` se ainda não existir com esse nome para o texto de erro (`color: var(--danger)`). `.checklistRow` leva `transition: transform var(--motion-base) var(--motion-ease-standard)`, que zera sozinha com `prefers-reduced-motion`, porque os tokens `--motion-*` já valem 0 ms nesse caso ([project/frontend-04]). A alça reaproveita `.handle` (já tem `touch-action: none`).
10. Em `apps/web/src/features/projects/i18n/pt-br.json`, tire `card_form.field_checklist_help` e acrescente: `"card_form.checklist_help": "Tecle Enter para adicionar cada item. Para reordenar, arraste pela alça ou foque a alça e use as setas."`, `"card_form.checklist_too_many": "Use no máximo 100 itens no checklist."`, `"card_form.checklist_item_too_long": "Cada item do checklist tem até 300 caracteres."`, `"checklist.new_item": "Novo item do checklist"`, `"checklist.new_item_placeholder": "Adicionar item"`, `"checklist.item": "Item {position} do checklist"`, `"checklist.untitled": "item {position}"`, `"checklist.done": "Feito: {item}"`, `"checklist.remove": "Remover o item {item}"`, `"checklist.handle": "Reordenar o item {item}, posição {position} de {total}"`, `"checklist.moved": "Item “{item}” na posição {position} de {total}."`, `"checklist.removed": "Item “{item}” removido."`, `"checklist.drag_instructions": "Para reordenar, arraste pela alça ou foque a alça e use as setas para cima e para baixo."`, `"checklist.drag_start": "Item “{item}” pego para reordenar."`, `"checklist.drag_over": "Item “{item}” sobre a posição {position}."` e `"checklist.drag_cancel": "Reordenação cancelada."`.
11. Em `apps/web/src/features/projects/projects.e2e.ts`, troque `await page.getByLabel('Checklist').fill('[x] Medir a sala\nComparar lojas')` por: preencher `Comparar lojas` e teclar `Enter`, preencher `Medir a sala` e teclar `Enter` no campo "Novo item do checklist", focar a alça "Reordenar o item Medir a sala, posição 2 de 2" e teclar `ArrowUp`, e marcar a caixa "Feito: Medir a sala"; a conferência `1/2` continua. Atualize o comentário do topo ("checklist em lista, com Enter e alça").
12. Em `apps/web/scripts/evidence-projects.mjs`:
    - Troque `const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-30');` por `const OUT = process.env.VOSTOK_EVIDENCE ?? join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-30');` e atualize o comentário do topo com o modo novo.
    - Em `installApi`, na seção `cards`: `POST` em `/projects/p-obra/cards` cria o cartão com o corpo (itens do `checklist` com `id` `ci-N`, `position` pelo índice) e responde 201; `PATCH` em `/projects/p-obra/cards/<id>` aplica o corpo, convertendo o `checklist` da mesma forma.
    - Acrescente a `EVIDENCES` o modo `checklist`, que roda um cenário em `/projects/p-obra/cards/<id de um cartão com checklist de 3 itens>` nos dois temas, em desktop e em 360 px: confere `ok` para "itens em lista com caixa, campo e remover", "campo vazio no fim", "Enter acrescenta e o campo do fim fica vazio" (digita `Comprar tinta` + `Enter`), "só espaços não cria item", "alça move pelo teclado" (foco na alça do primeiro item + `ArrowDown`, conferindo a nova ordem), "alça move arrastando com o mouse" (`page.mouse.down`/`move` em 10 passos/`up` da alça do último item até o primeiro), "contorno de foco visível na alça (≥ 2 px)" e "sem rolagem horizontal", mais o `baseChecks`; salva e confere no `PATCH` registrado em `api.calls` a ordem e o estado mostrados. Tira uma captura com um item marcado e o foco na alça, e monta a prancha com `sheet(browser, { title: 'SPEC-002 TASK-26 · checklist do cartão em lista (RF-33, CT-32, CB-12)', file: 'checklist-form.png', shots, scale: { desktop: 0.5, mobile: 0.62 } })`.
    - Atualize a mensagem de uso (`Use themes-widths, states-focus ou checklist.`).
13. Rode os testes do passo 5 até passarem; depois rode a Verificação inteira e corrija lint, Prettier e tipos até tudo terminar sem erro.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/projects --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | grep -v -E '> (rf33|cb12) ' | sed -E 's/ [0-9]+ms$//' | sort` (muda): sai o caso `pd46 parses the checklist lines with done items marked by [x]`, porque o `parseChecklist` deixa de existir com o checklist em lista
- `pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/projects`
- `pnpm --filter @atria/web exec prettier --check src/features/projects scripts/evidence-projects.mjs package.json`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-projects.mjs`

### Verificação

```bash
# evidência: checklist-tests.txt
pnpm --filter @atria/web exec vitest run src/features/projects/checklist-field.test.tsx src/features/projects/card-form-page.test.tsx src/features/projects/use-kanban.test.tsx --reporter=verbose
pnpm --filter @atria/web exec vitest run src/features/projects
pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/projects
pnpm --filter @atria/web exec prettier --check src/features/projects scripts/evidence-projects.mjs package.json
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-projects.mjs
# evidência: checklist-deps.txt
pnpm --filter @atria/web list @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --depth 0
# evidência: checklist-e2e-list.txt
pnpm --filter @atria/web exec playwright test --list src/features/projects/projects.e2e.ts
```

### Evidências

- `checklist-tests.txt` (automática, da verificação)
  - Prova: o checklist em lista funciona no componente e no formulário: Enter acrescenta, o campo do fim fica vazio, só espaços não criam item, marcar, remover, reordenar pela alça com o teclado e gravar na ordem e no estado mostrados, sem violações no axe (RF-33, CT-32, CB-12, RNF-03, RNF-07).
  - Trecho: os casos `rf33 adds an item with Enter and keeps an empty input at the end`, `cb12 does not add an item made only of spaces`, `rf33 reorders with the arrow keys on the handle`, `rf33 saves the checklist in the order and state shown`, `rf33 has no axe violations` e `cb12 ignores an item made only of spaces` com `✓`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou `No test files found`.
  - Requer: `apps/web/src/features/projects/checklist-field.tsx`, `apps/web/src/features/projects/checklist-field.test.tsx`
- `checklist-deps.txt` (automática, da verificação)
  - Prova: o dnd-kit entrou como dependência do `apps/web`, como pede a decisão 7A.
  - Trecho: sob `dependencies:`, as linhas com `@dnd-kit/core@6.`, `@dnd-kit/sortable@10.` e `@dnd-kit/utilities@3.`.
  - Falha: saída vazia ou sem algum dos três pacotes.
- `checklist-e2e-list.txt` (automática, da verificação)
  - Prova: o e2e do CT-30 continua escrito e compilando, agora preenchendo o checklist pela lista (o e2e roda com o servidor real na integração).
  - Trecho: as linhas `project with colored lanes, a card with checklist and a linked task` e `Total:` com o número de testes.
  - Falha: erro de compilação, `Error:` ou nenhuma linha listada.
- `checklist-form.png` (print): `node apps/web/scripts/evidence-projects.mjs checklist`
  - Prova: no Chromium, o formulário do cartão mostra o checklist como lista, com caixa, campo, remover, alça e o campo vazio no fim, nos temas claro e escuro, em desktop e em 360 px; a alça move por teclado e por mouse e o salvar grava a ordem mostrada (RF-33, CT-32, CB-12, RNF-03, RNF-07).
  - Trecho: uma linha `ok` por verificação (itens em lista, campo vazio no fim, Enter acrescenta, só espaços não cria item, alça move pelo teclado e pelo mouse, contorno de foco visível, sem rolagem horizontal, axe sem violações), a linha `png:` e `ok  0 falha(s)`; na prancha, a lista com um item marcado e o foco na alça.
  - Falha: alguma linha `FALHA`, a ausência da linha `png:`, código de saída diferente de 0, ou na imagem o `textarea` antigo, item sem alça, texto cortado ou rolagem horizontal em 360 px.
  - Requer: `apps/web/src/features/projects/checklist-field.tsx`

### Concluída quando

- [x] O formulário do cartão mostra o checklist como lista: cada item com alça, caixa de marcação, campo de texto e remover, e um campo vazio no fim para o próximo item (RF-33, CT-32).

  > Como comprovar: na prancha `checklist-form.png`, ver a lista nos dois temas e nas duas larguras; em `checklist-tests.txt`, ver aprovado `rf33 adds an item with Enter and keeps an empty input at the end`.

- [x] Enter no campo do fim cria o item e deixa o campo vazio; um item só com espaços não é criado (RF-33, CB-12).

  > Como comprovar: em `checklist-tests.txt`, ver aprovados `rf33 adds an item with Enter and keeps an empty input at the end`, `cb12 does not add an item made only of spaces` e `cb12 ignores an item made only of spaces`.

- [x] Os itens são marcados, removidos e reordenados pela alça com mouse, toque e teclado, e o cartão grava os itens na ordem e no estado mostrados (RF-33, CT-32, RNF-07).

  > Como comprovar: em `checklist-tests.txt`, ver aprovados `rf33 reorders with the arrow keys on the handle` e `rf33 saves the checklist in the order and state shown`; no log do print, ver `ok` em "alça move pelo teclado" e "alça move arrastando com o mouse"; o toque usa o `TouchSensor` do dnd-kit, conferido no quadro da TASK-27 e no e2e da integração.

- [x] O dnd-kit entrou só no `apps/web`, com a justificativa registrada (decisão 7A, [project/stack-12]).

  > Como comprovar: abrir `checklist-deps.txt` e ver os três pacotes `@dnd-kit` listados; nos Detalhes técnicos desta tarefa, ler a justificativa.

- [x] Sem violações de acessibilidade, com anúncios em português para leitor de tela, nos dois temas (RNF-03).

  > Como comprovar: em `checklist-tests.txt`, ver aprovado `rf33 has no axe violations`; no log do print, ver `ok` em "axe sem violações" em todas as capturas.

- [x] Testes, lint, Prettier e typecheck passam sem warning, e o e2e do CT-30 lista o fluxo atualizado.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; em `checklist-e2e-list.txt`, ver o teste `project with colored lanes, a card with checklist and a linked task`.

## Descrição

### Resumo executivo

O checklist dos cartões de Projetos deixa de ser um texto em que cada linha vira um item e passa a ser uma lista de verdade: marcar, escrever, apagar e reordenar cada item arrastando, inclusive no celular e pelo teclado.
O benefício é o uso direto do checklist, sem a convenção de "[x]" que o usuário não conhecia.
Perfil padrão: decisões locais de componente, com uma biblioteca nova de arrastar (dnd-kit) já decidida na spec.
Risco baixo: o servidor já guarda os itens; o cuidado é o tamanho do pacote do app e a acessibilidade do arrastar.
Desbloqueia o quadro com arrastar (TASK-27), que usa a mesma biblioteca.

### Detalhes técnicos

**Abordagem.** O formulário (`card-form-page.tsx`) passa a guardar o checklist como lista de rascunhos (`ChecklistDraft`: `key`, `text`, `done`) num `Controller` do `react-hook-form`, renderizado pelo `ChecklistField` novo. As operações (acrescentar, mover, remover, converter para o corpo da API) são funções puras em `use-kanban.ts`, para o componente não ter regra ([project/code-style-09]) e para serem testadas sem DOM. O corpo enviado continua `checklist: [{ text, done }]` na ordem da lista: o servidor já grava itens estruturados (`project_card_checklist_items`), então não há mudança de contrato.

**Decisões.**
- Mouse e toque pelo dnd-kit (`PointerSensor` com distância de 4 px e `TouchSensor` com atraso de 200 ms, para não brigar com a rolagem), e teclado pelas setas na alça, como o puxador de Configurações › Raias (PD-47). Alternativa descartada: o `KeyboardSensor` do dnd-kit, porque depende das medidas da tela (zeradas no jsdom, o que obrigaria simular coordenadas nos testes) e destoaria do padrão de teclado que o app já tem.
- Alça só no item e campo do fim fora do `SortableContext`: o campo vazio não é arrastável e fica sempre no fim (RF-33). Alternativa descartada: arrastar a linha inteira, que conflita com a seleção de texto do campo.
- O texto pendente do campo do fim entra também ao sair do campo, para não perder o item digitado e não confirmado antes de salvar. Alternativa descartada: só pelo Enter, que perderia o texto em silêncio.
- Anúncios e instruções do dnd-kit traduzidos pelas chaves `projects.checklist.*` ([project/language-06]); a biblioteca traria textos em inglês.
- Ícone de remover definido no próprio `checklist-field.tsx`, como o `RepeatIcon` de `task-item.tsx`, para não mexer em `icons.tsx`, que a TASK-18 altera na onda 2.

**Dependência nova ([project/stack-12]).** `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0 e `@dnd-kit/utilities` 3.2.2 (decisão 7A da spec): arrastar acessível com toque e teclado, sem dependências de terceiros e mantido; o arrastar nativo do HTML não funciona em toque (estado atual da spec). Alternativa descartada na spec: arrastar nativo com menu e botões.

**Arquivos além dos componentes do plano.** `pnpm-lock.yaml` (gerado pelo `pnpm add`), `i18n/pt-br.json` de Projetos (textos novos, [project/language-06]), os testes (`checklist-field.test.tsx`, `card-form-page.test.tsx`, `use-kanban.test.tsx`, `projects.e2e.ts`) e o script de evidência `apps/web/scripts/evidence-projects.mjs`, que passa a gravar em `$VOSTOK_EVIDENCE` para o print.

**Riscos.** O dnd-kit soma cerca de 50 kB ao bundle (risco baixo da spec): o formulário do cartão já fica numa rota própria; a conferência do Lighthouse é da integração. O `TouchSensor` não é exercitado no jsdom; o toque emulado é conferido no quadro (TASK-27) e no e2e. O `baseline` dos testes de Projetos leva `(muda)` porque sai o caso do `parseChecklist`.

**Referências.** RF-33, CT-32, CB-12, RNF-03, RNF-07, decisão 7 (7A), PD-46 e PD-47.

**Arquivos em comum na onda 1.** Nenhum dos arquivos desta tarefa é alterado por outra tarefa da onda 1. Nas ondas seguintes, a TASK-27 altera de novo `projects.module.css`, `use-kanban.ts`, `i18n/pt-br.json`, `projects.e2e.ts` e `scripts/evidence-projects.mjs`, e depende desta tarefa.

### Card

- **Título:** Checklist do cartão em lista
- **Tipo:** historia
- **Descrição:** O checklist do cartão de Projetos vira uma lista com caixa de marcação, campo vazio no fim, remoção e reordenação pela alça, por mouse, toque e teclado, com o dnd-kit.
- **Critérios de aceite:**
  - [ ] Cada item tem alça, caixa, campo e remover, com um campo vazio no fim.
  - [ ] Enter acrescenta o item; só espaços não criam item.
  - [ ] Reordenar pela alça funciona com mouse, toque e teclado.
  - [ ] O cartão grava os itens na ordem e no estado mostrados.
  - [ ] Sem violações de acessibilidade e com anúncios em português.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 mudança(s) esperada(s) |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | conferência | usuário | print checklist-form.png conferido pelo usuário (sha256 0f850264) |
| 7 | 2026-11-01 | evidências | passed | 4 evidência(s) em evidence/TASK-26/ |
| 8 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
