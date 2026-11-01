---
id: TASK-27
spec: SPEC-002
title: "Quadro com arrastar por mouse, toque e teclado"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-26]
wave: 2
covers: [RF-34, CT-33, CB-13]
type: historia
labels: [SPEC-002, padrao]
status: done
content_hash: 7a5354cc3d06cf25b9b6243a57c12a2b56d6cac8af38c3d498d35c7de3e6899d
adjustments: 4
adjusted_at: 2026-11-01T12:01:21Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: 708898cc16affa285338cbf94bb7920073bf14819a9bcc093e0cc9df9067d1d9
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T12:01:21Z
---

# TASK-27: Quadro com arrastar por mouse, toque e teclado

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Projetos: arrastar nativo, que não funciona em toque, e o seletor de raia cortado pelo `overflow` do quadro), RF-34, CT-33, CB-13, FA-04, RNF-03, RNF-07, a premissa do endpoint de mover e a decisão 7 (resposta 7A).
- `vostok/work/tasks/SPEC-002/TASK-26.md`: o dnd-kit instalado, os sensores escolhidos (teclado pelas setas na alça; nesta tarefa o mouse usa o `MouseSensor`, e o teclado, o link do cartão) e as chaves `projects.checklist.*`, para seguir o mesmo padrão.
- `vostok/rules/project/frontend.md`, `vostok/rules/project/code-style.md`, `vostok/rules/project/testing.md` e `vostok/rules/project/language.md`.
- `docs/decisoes-do-prototipo.md`: linhas PD-44, PD-45, PD-46 (o "seletor no pé" sai por pedido do RF-34) e PD-47 (puxador e setas).
- `apps/web/src/features/projects/kanban-board-page.tsx`, `apps/web/src/features/projects/kanban-lane.tsx` e `apps/web/src/features/projects/kanban-card.tsx`: o arrastar nativo, o `dropPosition`, o `SelectField` do pé, o efeito que devolve o foco (`move-<id>`) e a região `role="status"` do anúncio.
- `apps/web/src/features/projects/use-kanban.ts`: `cardsOfLane`, `moveCardInList`, `useMoveCard` (rota `move`, otimista) e, entregues pela TASK-26, as funções do checklist.
- `apps/web/src/features/projects/checklist-field.tsx` (da TASK-26): uso do `DndContext`, dos sensores e da opção `accessibility` traduzida.
- `apps/web/src/features/projects/icons.tsx`: `HandleIcon` (segue usado pelo checklist e pelas Raias; só sai do cartão).
- `apps/web/src/features/projects/projects.module.css` (mais de 600 linhas): `.rowTitle::after` (linhas 52-58, link que cobre o cartão), `.kanban` a `.laneAdd` (linhas 297-440) e `.handle` (linhas 469-488, compartilhado com o checklist e as Raias; não mexer).
- `apps/web/src/features/projects/i18n/pt-br.json`: chaves `board.*` e `card.*`.
- `apps/web/src/features/projects/kanban-board-page.test.tsx`, `apps/web/src/features/projects/use-kanban.test.tsx` e `apps/web/src/features/projects/test-server.ts` (rota `move`).
- `apps/web/src/features/projects/projects.e2e.ts`: o passo "Mover pelo seletor do pé".
- `apps/web/scripts/evidence-projects.mjs` (mais de 900 linhas): `OUT`, fn `installApi` (rota `move`), fn `openPage`, fn `runScenarios`, fn `sheet`, o modo `checklist` da TASK-26 e `EVIDENCES`.
- Documentação do dnd-kit 6.3.1 e do sortable 10.0.0: `useDroppable`, `useSortable` (`data`, `setActivatorNodeRef`), `DragOverlay`, `closestCorners` e `accessibility.announcements`.

### Mudar

- `apps/web/src/features/projects/kanban-card.tsx` (alterar): tirar o seletor de raia da face e o arrastar nativo; o cartão vira item arrastável do dnd-kit, sem alça: o link do título (que cobre o cartão) recebe o foco e as setas.
- `apps/web/src/features/projects/kanban-lane.tsx` (alterar): a raia vira área de soltura do dnd-kit, com os cartões num `SortableContext`; sai o `dropPosition` nativo.
- `apps/web/src/features/projects/kanban-board-page.tsx` (alterar): `DndContext` do quadro com mouse e toque, `DragOverlay`, mover pelas setas no link do cartão e anúncios traduzidos.
- `apps/web/src/features/projects/use-kanban.ts` (alterar): funções puras que calculam a raia e a posição de destino de uma soltura e das setas.
- `apps/web/src/features/projects/projects.module.css` (alterar): hover do cartão, cartão flutuante e cartão em arraste; saem os estilos do seletor do pé (`.move`).
- `apps/web/src/features/projects/i18n/pt-br.json` (alterar): textos das instruções e dos anúncios do arrastar; saem `card.move_to` e `card.drag_handle`.
- `apps/web/src/features/projects/kanban-board-page.test.tsx` (alterar): os casos do arrastar nativo e do seletor do pé dão lugar aos de teclado no link do cartão, sem seletor na face e sem alça.
- `apps/web/src/features/projects/use-kanban.test.tsx` (alterar): testes das funções de destino da soltura e das setas.
- `apps/web/src/features/projects/projects.e2e.ts` (alterar): o fluxo do CT-30 move o cartão pelo teclado e arrastando com o mouse, e um caso novo arrasta por toque emulado.
- `apps/web/scripts/evidence-projects.mjs` (alterar): modo `board-drag`, que move cartões por mouse, toque emulado e teclado no Chromium, confere o hover e o arraste e grava o vídeo do quadro.

### Passos

1. Escreva primeiro os testes das funções puras em `apps/web/src/features/projects/use-kanban.test.tsx`, num bloco `describe('card drop targets', ...)`, com três raias (`l-wait`, `l-doing`, `l-done`, nessa ordem de `position`) e os cartões `c-1` e `c-2` em `l-wait` e `c-3` em `l-doing`. Casos, com os nomes exatos:
   - `rf34 drops over a card of another lane before that card`: `resolveCardDrop(cards, 'c-1', { type: 'card', card_id: 'c-3' })` devolve `{ lane_id: 'l-doing', position: 0 }`.
   - `rf34 drops over a lane at its end`: `resolveCardDrop(cards, 'c-1', { type: 'lane', lane_id: 'l-done' })` devolve `{ lane_id: 'l-done', position: 0 }`; sobre `l-doing`, `position: 1`.
   - `cb13 drops in the same lane changing only the position`: `resolveCardDrop(cards, 'c-1', { type: 'card', card_id: 'c-2' })` devolve `{ lane_id: 'l-wait', position: 1 }`.
   - `rf34 ignores a drop on the same place`: sobre o próprio cartão, sobre `null` e sobre a própria raia quando o cartão já é o último dela, devolve `null`.
   - `rf34 moves with the arrow keys`: `keyboardCardTarget(lanes, cards, 'c-1', 'ArrowRight')` devolve `{ lane_id: 'l-doing', position: 1 }`; `'ArrowLeft'` em `c-1` devolve `null` (primeira raia); `'ArrowDown'` em `c-1` devolve `{ lane_id: 'l-wait', position: 1 }`; `'ArrowUp'` em `c-1` devolve `null`.
2. Atualize `apps/web/src/features/projects/kanban-board-page.test.tsx`:
   - Tire os casos `pd46 moves a card to another lane by drag and drop through the move route` e `pd46 moves a card with the lane selector at the foot by keyboard`, e os imports que ficarem sem uso (`createEvent`, `fireEvent`).
   - Troque o caso `announces the move to screen readers` por `rf34 announces the move to screen readers`: focar o link "Escolher sofá" do cartão e teclar `{ArrowRight}`; a região com `aria-live="polite"` mostra "“Escolher sofá” movido para Em progresso.".
   - Acrescente, com os nomes exatos: `rf34 has no lane selector on the card face` (nenhum `button` com nome `/para$/` nem `combobox` dentro do cartão, e nenhum botão "Mover …" no cartão); `rf34 moves a card to the next lane with the arrow keys through the move route` (`{ArrowRight}` no link de `c-1` faz um `POST` em `/cards/c-1/move` com `{ lane_id: 'l-doing', position: 1 }`, sem `PATCH`, e o cartão aparece na raia "Em progresso"); `cb13 reorders inside the lane with arrow down` (`{ArrowDown}` no link de `c-1` faz o `POST` com `{ lane_id: 'l-wait', position: 1 }`); `rf34 keeps the focus on the card link after the move` (depois do `{ArrowRight}`, `document.activeElement.id` é `move-c-1`); `rf34 explains how to move in Portuguese` (a instrução do dnd-kit ligada ao link do cartão por `aria-describedby` tem o texto de `projects.board.drag_instructions`).
3. Rode `pnpm --filter @atria/web exec vitest run src/features/projects/kanban-board-page.test.tsx src/features/projects/use-kanban.test.tsx` e confira que os casos novos falham.
4. Em `apps/web/src/features/projects/use-kanban.ts`, acrescente, exportados:
   - `export type CardDropOver = { type: 'card'; card_id: string } | { type: 'lane'; lane_id: string }` e `export interface CardDropTarget { lane_id: string; position: number }`.
   - `resolveCardDrop(cards: readonly Card[], card_id: string, over: CardDropOver | null): CardDropTarget | null`: sem `over` ou sem o cartão, `null`. Sobre uma raia: `position` é o número de cartões dessa raia sem o que se move (o fim). Sobre um cartão da mesma raia: `position` é o índice desse cartão em `cardsOfLane(cards, lane)` com o que se move incluído (a semântica do `arrayMove` do sortable). Sobre um cartão de outra raia: o índice dele em `cardsOfLane(cards, lane)`. Se a raia e a posição resultantes são as atuais do cartão, `null`.
   - `keyboardCardTarget(lanes: readonly Lane[], cards: readonly Card[], card_id: string, key: string): CardDropTarget | null`: `ArrowLeft`/`ArrowRight` vão para a raia anterior/seguinte na ordem de `position`, no fim dela; `ArrowUp`/`ArrowDown` mudam a posição em 1 na mesma raia; fora dos limites, ou outra tecla, `null`.
5. Em `apps/web/src/features/projects/kanban-card.tsx`:
   - Tire `SelectField`, a alça `HandleIcon`, as props `lanes`, `onMove`, `dragging`, `onDragStart`, `onDragEnd`, `draggable` e os handlers nativos; as props novas são `{ project_id, card, task, onKeyMove: (card: Card, key: string) => boolean }`.
   - Use `useSortable({ id: card.id, data: { type: 'card', card_id: card.id, lane_id: card.lane_id }, transition: null, attributes: { roleDescription: t('projects.card.drag_role') } })`. No `<li ref={setNodeRef} data-card-id={card.id} style={{ transform: CSS.Translate.toString(transform) }} className={[styles.kcard, isDragging ? styles.kcardDragging : ''].filter(Boolean).join(' ')} {...listeners}>` (mouse e toque no cartão inteiro).
   - No `.kcardFoot` não fica nada no lugar do seletor. O link do título (`.rowTitle`) recebe `id={`move-${card.id}`}`, `aria-describedby` e `aria-roledescription` de `attributes` (sem `role` nem `tabIndex`, para continuar um link) e `onKeyDown={(event) => { if (onKeyMove(card, event.key)) event.preventDefault(); }}`. Enter continua abrindo o cartão.
6. Em `apps/web/src/features/projects/kanban-lane.tsx`:
   - Tire `dropPosition`, o estado `over`, os handlers `onDragOver`/`onDragLeave`/`onDrop` e as props `lanes`, `dragging_id`, `onMove`, `onDrop`, `onDragStart`, `onDragEnd`; as props novas são `{ project_id, lane, cards, tasks, onKeyMove }`.
   - Use `useDroppable({ id: `lane:${lane.id}`, data: { type: 'lane', lane_id: lane.id } })`; o `<li ref={setNodeRef}>` recebe `styles.laneDrop` quando `isOver` é verdadeiro ou quando o `over` atual do `useDndContext()` é um cartão desta raia (`over.data.current.lane_id === lane.id`).
   - Envolva o `<ul className={styles.cards}>` num `SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}` e passe `onKeyMove` a cada `KanbanCard`.
7. Em `apps/web/src/features/projects/kanban-board-page.tsx`:
   - Tire `onDragStart` nativo, `DragEvent` e as props removidas; guarde `active_id` num estado.
   - Envolva o `<ul className={styles.kanban}>` num `DndContext` com `sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }))`, `collisionDetection={closestCorners}` e `accessibility={{ screenReaderInstructions: { draggable: t('projects.board.drag_instructions') }, announcements }}`, com `onDragStart`, `onDragOver`, `onDragEnd` e `onDragCancel` traduzidos pelas chaves `projects.board.drag_start`, `projects.board.drag_over`, `projects.board.moved` e `projects.board.drag_cancel`.
   - `onDragEnd({ active, over })`: monte o `CardDropOver` de `over.data.current` (`type` `card` ou `lane`) e chame `resolveCardDrop(card_list, String(active.id), over_data)`; com destino, `moveTo(card, target.lane_id, target.position)`; zere `active_id` em `onDragEnd` e em `onDragCancel`.
   - Mostre `<DragOverlay dropAnimation={null}>` com o cartão em arraste como `<div className={[styles.kcard, styles.kcardOverlay].join(' ')}>{card.title}</div>` (o cartão flutua por cima do `overflow` do quadro).
   - `onKeyMove(card, key)`: calcula `keyboardCardTarget(lanes.data, card_list, card.id, key)`; sem destino devolve `false`; com destino chama `moveTo(card, target.lane_id, target.position, true)` (o foco volta ao link `move-<id>` do cartão pelo efeito que já existe) e devolve `true`.
   - Em `moveTo`, troque a guarda `card.lane_id === lane_id && position === undefined` pela chamada só quando há destino (as funções puras já devolvem `null` para o mesmo lugar) e mantenha o anúncio `projects.board.moved`.
8. Em `apps/web/src/features/projects/projects.module.css`: tire `.move label` do seletor compartilhado com `.srOnly` (fica só `.srOnly`) e a regra `.move button`; não mexa em `.handle`, que o checklist e as Raias usam. No `.kcard`, `touch-action: manipulation` e `transition: transform var(--motion-fast) var(--motion-ease-standard), box-shadow var(--motion-fast) var(--motion-ease-standard), border-color var(--motion-fast) var(--motion-ease-standard)`; em `@media (hover: hover)`, `.kcard { cursor: grab; }` e `.kcard:hover` com `transform: translateY(calc(var(--space) * -0.5))`, `box-shadow: var(--shadow-md)` e `border-color: var(--border-strong)` (o hover não vale com o cartão em arraste); `.kcard:active { cursor: grabbing; }`. `.kcardDragging` com `opacity: 0.4` e `box-shadow: none` (marcador de lugar); `.kcardOverlay` com `box-shadow: var(--shadow-lg)`, `border-color: var(--primary)` e `cursor: grabbing`. Em `@media (prefers-reduced-motion: reduce)`, `.kcard { transition: none; }` e sem o deslocamento do hover. Sai `.kcardHandle`. O `.kcardFoot` continua com `z-index: 1`. Só tokens do tema.
9. Em `apps/web/src/features/projects/i18n/pt-br.json`: tire `card.move_to` e `card.drag_handle`, e acrescente `"card.drag_role": "cartão móvel"`, `"board.drag_instructions": "Para mover um cartão, arraste-o para outra raia ou foque o cartão e use as setas: esquerda e direita trocam de raia, cima e baixo mudam a posição."`, `"board.drag_start": "“{card}” pego para mover."`, `"board.drag_over": "“{card}” sobre {lane}."` e `"board.drag_cancel": "Movimento de “{card}” cancelado."`. Acrescente também `"board.keys.lanes": "Trocar de raia"`, `"board.keys.order": "Mudar a posição"` e `"board.keys.open": "Abrir o cartão"`. No `kanban-board-page.tsx`, depois do `DndContext`, mostre a lista de comandos num `<ul className={styles.boardHint} aria-hidden="true">` (o leitor de tela já recebe as instruções do dnd-kit), um `<li>` por comando, com as teclas em `<kbd>` seguidas da ação: `← →` Trocar de raia, `↑ ↓` Mudar a posição, `Enter` Abrir o cartão. No `projects.module.css`, `.boardHint` centralizado, em linha (`display: flex; flex-wrap: wrap; justify-content: center; gap: var(--s4)`), sem marcador, com `margin: var(--s3) 0 0; padding: 0; color: var(--text-muted); font-size: var(--font-size-xs)`, e `.boardHint kbd` com fonte monoespaçada, borda e raio do tema. Em `kanban-board-page.test.tsx`, acrescente `rf34 shows the keyboard hint at the end of the board` (as três ações da lista visíveis depois da lista de raias).
10. Em `apps/web/src/features/projects/projects.e2e.ts`:
    - Troque o passo "Mover pelo seletor do pé" por: focar `page.getByRole('link', { name: 'Escolher o sofá' })` e teclar `ArrowRight`, conferindo o cartão na raia "Em progresso"; depois arrastar o cartão com o mouse (`hover` no cartão, `page.mouse.down()`, `page.mouse.move` até o cabeçalho da raia "Pronto" com `steps: 12`, `page.mouse.up()`) e conferir o cartão em "Pronto". Atualize o comentário do topo ("movido pelo teclado e arrastando").
    - Acrescente o teste `rf34 moves a card between lanes by emulated touch`, com `test.use({ hasTouch: true, isMobile: true })` só em 360 px: cria o projeto e um cartão pela tela, e arrasta o cartão por toque com `page.context().newCDPSession(page)` e `Input.dispatchTouchEvent` (`touchStart` no cartão, espera de 300 ms, 12 `touchMove` até a raia "Em progresso" e `touchEnd`), conferindo o cartão na raia nova e a ausência de `combobox` na face.
11. Em `apps/web/scripts/evidence-projects.mjs`, acrescente a `EVIDENCES` o modo `board-drag` (a pasta de saída já vem de `VOSTOK_EVIDENCE`, pela TASK-26), que abre `/projects/p-obra?tab=board` nos dois temas, em desktop e em 360 px (em 360 px com `hasTouch: true` e `isMobile: true` no `browser.newContext`), e confere com `check`: "face do cartão sem seletor de raia" (nenhum `[role="combobox"]`, botão "Mover … para" nem botão "Mover …" dentro de `.kcard`), "mouse move entre raias" (desktop: `page.mouse` do cartão para outra raia em 12 passos, com o `POST .../move` registrado em `api.calls`), "toque emulado move entre raias" (360 px: CDP `Input.dispatchTouchEvent` com `touchStart`, espera de 300 ms, 12 `touchMove` e `touchEnd`), "teclado move pelo cartão em foco" (foco por `Tab` no link do cartão e `ArrowRight`), "mesma raia muda só a ordem" (CB-13: `ArrowDown`, com o `POST` sem troca de `lane_id`), "contorno de foco visível no cartão em foco (≥ 2 px)", "hover eleva o cartão" (sombra do tema mais forte, deslocamento para cima e `cursor: grab`), "cartão de origem esmaecido no arraste" (opacidade menor), "cartão flutuante visível durante o arraste" (sombra mais forte que a do repouso, `cursor: grabbing`; captura com o `DragOverlay` na tela antes do `mouse.up`) e "sem rolagem horizontal", mais o `baseChecks`. Essas checagens não gravam vídeo. Depois delas, grave `board-drag.webm` num contexto à parte (desktop 1280x800, tema claro, `recordVideo`, sem `reducedMotion` forçado, com um marcador na tela que mostra o `cursor` computado, porque o vídeo do Playwright não desenha o cursor): hover num cartão, arrastar com o mouse de uma raia para outra (`mouse.move` em vários `steps` e pausas curtas), reordenar na mesma raia e mover pelas setas com o foco no cartão; feche o contexto e salve com `page.video().saveAs(join(OUT, 'board-drag.webm'))`. Imprima `video: <caminho>` no lugar da linha `png:` e atualize a mensagem de uso.
12. Rode os testes do passo 3 até passarem; depois rode a Verificação inteira e corrija lint, Prettier e tipos até tudo terminar sem erro.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/projects --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | grep -v -E '> (rf34|cb13) ' | sed -E 's/ [0-9]+ms$//' | sort` (muda): saem os casos do arrastar nativo e do seletor do pé (`pd46 moves a card to another lane by drag and drop through the move route`, `pd46 moves a card with the lane selector at the foot by keyboard` e `announces the move to screen readers`), que o RF-34 substitui pelos de alça e dnd-kit
- `pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/projects`
- `pnpm --filter @atria/web exec prettier --check src/features/projects scripts/evidence-projects.mjs`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-projects.mjs`

### Verificação

```bash
# evidência: board-tests.txt
pnpm --filter @atria/web exec vitest run src/features/projects/kanban-board-page.test.tsx src/features/projects/use-kanban.test.tsx --reporter=verbose
pnpm --filter @atria/web exec vitest run src/features/projects
pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/projects
pnpm --filter @atria/web exec prettier --check src/features/projects scripts/evidence-projects.mjs
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-projects.mjs
# evidência: board-e2e-list.txt
pnpm --filter @atria/web exec playwright test --list src/features/projects/projects.e2e.ts
```

### Evidências

- `board-tests.txt` (automática, da verificação)
  - Prova: o quadro move cartões pelo cartão em foco com o teclado, entre raias e na mesma raia, pela rota `move`, com o foco e o anúncio em português, sem seletor na face; e as funções de destino calculam a raia e a posição das solturas do mouse e do toque (RF-34, CT-33, CB-13, RNF-07).
  - Trecho: os casos `rf34 has no lane selector on the card face`, `rf34 moves a card to the next lane with the arrow keys through the move route`, `cb13 reorders inside the lane with arrow down`, `rf34 keeps the focus on the card link after the move`, `rf34 drops over a card of another lane before that card` e `cb13 drops in the same lane changing only the position` com `✓`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `board-e2e-list.txt` (automática, da verificação)
  - Prova: o e2e do quadro está escrito e compila, com o mover pelo teclado e pelo mouse no CT-30 e o caso de toque emulado do CT-33 (rodam com o servidor real na integração).
  - Trecho: as linhas `project with colored lanes, a card with checklist and a linked task` e `rf34 moves a card between lanes by emulated touch`.
  - Falha: erro de compilação, `Error:` ou o caso `rf34` ausente.
- `board-drag.webm` (print): `node apps/web/scripts/evidence-projects.mjs board-drag`
  - Prova: no Chromium, em desktop de 1280x800 e tema claro, o vídeo mostra o cartão elevando no hover com o cursor `grab`, mudando de raia arrastando com o mouse (cartão flutuante com sombra forte e cursor `grabbing`, origem esmaecida), a mesma raia só mudando a ordem e o cartão em foco movido pelas setas; as checagens do mesmo comando cobrem a face sem seletor nem alça, o toque emulado, os dois temas, 360 px, o axe e a rolagem (RF-34, CT-33, CB-13, RNF-03, RNF-07).
  - Trecho: uma linha `ok` por verificação (face sem seletor, mouse, toque emulado, teclado, mesma raia, contorno de foco, hover eleva o cartão, cartão de origem esmaecido, cartão flutuante, sem rolagem horizontal, axe sem violações), a linha `video:` com o caminho do `.webm` e `ok  0 falha(s)`; no vídeo, o hover elevado, o arraste com o cartão flutuante e a origem esmaecida, a reordenação na raia e as setas com o foco no cartão.
  - Falha: alguma linha `FALHA`, a ausência da linha `video:`, código de saída diferente de 0, ou no vídeo o seletor de raia ou uma alça no cartão, o hover sem elevação, o cartão de origem sem esmaecer, o cartão cortado pela raia durante o arraste ou um dos quatro movimentos ausente.

### Concluída quando

- [x] A face do cartão não tem seletor de raia nem alça; o cartão inteiro é arrastável e eleva no hover (RF-34, CT-33).

  > Como comprovar: em `board-tests.txt`, ver aprovado `rf34 has no lane selector on the card face`; no vídeo `board-drag.webm`, ver o pé do cartão sem seletor nem alça e o cartão em hover elevado.

- [x] O cartão muda de raia arrastando com o mouse e por toque, e pelo teclado com as setas no cartão em foco, sempre pela rota de mover (RF-34, CT-33, FA-04, RNF-07).

  > Como comprovar: no log do print, ver `ok` em "mouse move entre raias", "toque emulado move entre raias" e "teclado move pelo cartão em foco"; em `board-tests.txt`, ver aprovado `rf34 moves a card to the next lane with the arrow keys through the move route`.

- [x] Soltar o cartão na mesma raia em outra posição só muda a ordem, pelo endpoint de mover (CB-13).

  > Como comprovar: em `board-tests.txt`, ver aprovados `cb13 reorders inside the lane with arrow down` e `cb13 drops in the same lane changing only the position`; no log do print, ver `ok` em "mesma raia muda só a ordem".

- [x] O foco fica no cartão depois de mover, o movimento é anunciado e as instruções estão em português, sem violações de acessibilidade (RNF-03).

  > Como comprovar: em `board-tests.txt`, ver aprovados `rf34 keeps the focus on the card link after the move`, `rf34 announces the move to screen readers`, `rf34 explains how to move in Portuguese` e `has no axe violations`; no log do print, ver `ok` em "axe sem violações".

- [x] Durante o arraste, o cartão flutuante tem sombra mais forte e `cursor: grabbing`, o cartão de origem fica esmaecido como marcador de lugar, e com `prefers-reduced-motion` não há transição (RNF-03).

  > Como comprovar: no log do print, ver `ok` em "hover eleva o cartão", "cartão de origem esmaecido no arraste" e "cartão flutuante visível durante o arraste"; no vídeo `board-drag.webm`, ver o cartão em hover elevado, o flutuante sobre a raia de destino e o de origem esmaecido.

- [x] Testes, lint, Prettier e typecheck passam sem warning, e o e2e lista o caso de toque emulado.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; em `board-e2e-list.txt`, ver `rf34 moves a card between lanes by emulated touch`.

- [x] No fim do quadro, uma lista discreta e centralizada, em cinza claro, mostra os comandos do teclado: as teclas e as ações, sem prosa (RNF-03).

  > Como comprovar: em `board-tests.txt`, ver aprovado `rf34 shows the keyboard hint at the end of the board`; no `board-drag.webm`, ver a dica abaixo das raias.

## Descrição

### Resumo executivo

No quadro de Projetos, os cartões passam a mudar de raia arrastando o cartão inteiro, também no celular e pelo teclado, e sai o seletor de raia que ficava cortado no cartão, sem alça de arrastar.
O benefício é um quadro que funciona do mesmo jeito em qualquer aparelho, com uma face de cartão mais limpa.
Perfil padrão: usa a biblioteca de arrastar que a tarefa do checklist já trouxe, com decisões locais de interação.
Risco baixo: o servidor já tem a rota de mover; o cuidado é a acessibilidade pelo teclado e o toque não brigar com a rolagem.
Depende do checklist em lista (TASK-26) e não bloqueia outras tarefas.

### Detalhes técnicos

**Abordagem.** O quadro troca o arrastar nativo do HTML pelo dnd-kit (instalado pela TASK-26): o `kanban-board-page.tsx` tem o `DndContext`, cada raia (`kanban-lane.tsx`) é uma área de soltura (`useDroppable`) com os cartões num `SortableContext`, e cada cartão (`kanban-card.tsx`) é um item `useSortable`. O destino de uma soltura e das setas é calculado por funções puras novas em `use-kanban.ts` (`resolveCardDrop`, `keyboardCardTarget`), testadas sem DOM, e o movimento continua pela `useMoveCard` (rota `move`, otimista, com desfazer e aviso na recusa, [project/frontend-18]).

**Decisões.**
- Mouse e toque no cartão inteiro (`MouseSensor` com 6 px de distância, para o clique no título continuar abrindo o cartão, e `TouchSensor` com 200 ms de atraso, para a rolagem do quadro funcionar) e teclado pelas setas no link do cartão em foco: esquerda e direita trocam de raia, cima e baixo mudam a posição. Alternativa descartada: o `KeyboardSensor` do dnd-kit, que mede a tela (zerada no jsdom) e não dá um caminho previsível entre colunas; as setas seguem o padrão do puxador de Raias (PD-47) e do checklist (TASK-26), mas o cartão não tem alça (decisão do usuário: a alça destoava do resto da aplicação). O `MouseSensor` substitui o `PointerSensor`, que cancelava o toque.
- O link do cartão reaproveita o id `move-<id>` do seletor antigo, para o efeito que devolve o foco depois de mover continuar valendo.
- `DragOverlay` com uma cópia leve do cartão, porque o `overflow-x: auto` do quadro cortaria o item arrastado entre raias. Alternativa descartada: mover o próprio item entre os `SortableContext` durante o arraste (`onDragOver`), mais complexo e sem ganho visível.
- Feedback visual só com tokens do tema: no hover o cartão eleva (`--shadow-md` e leve deslocamento) com `cursor: grab`; no arraste o `DragOverlay` leva `--shadow-lg` e `cursor: grabbing`, e o cartão de origem esmaece como marcador de lugar; com `prefers-reduced-motion` o `.kcard` fica sem transição.
- Sem transições da biblioteca (`transition: null` e `dropAnimation={null}`): as durações fixas do dnd-kit não usam os tokens `--motion-*` ([project/frontend-04]).
- Sai o seletor do pé decidido na PD-46, por pedido explícito do RF-34 (a face do cartão sem seletor).

**Arquivos além dos componentes do plano.** `use-kanban.ts` (funções de destino), `projects.module.css` (hover e cartão flutuante), `i18n/pt-br.json` de Projetos ([project/language-06]), os testes (`kanban-board-page.test.tsx`, `use-kanban.test.tsx`, `projects.e2e.ts`) e o modo `board-drag` do `scripts/evidence-projects.mjs`. Todos foram alterados pela TASK-26, da onda 1, de que esta depende.

**Riscos.** O toque é exercitado só no Chromium (print e e2e com toque emulado), não no jsdom. O baseline dos testes de Projetos leva `(muda)`: saem os três casos do arrastar nativo e do seletor do pé.

**Referências.** RF-34, CT-33, CB-13, FA-04, RNF-03, RNF-07, decisão 7 (7A), PD-44 a PD-47.

**Arquivos em comum na onda 2.** Nenhum: as outras tarefas da onda 2 (TASK-04, TASK-13 e TASK-18) não alteram os arquivos desta tarefa. A TASK-18 altera `apps/web/src/features/projects/icons.tsx` e `projects-list-page.tsx`, que esta tarefa só lê (`HandleIcon`).

### Card

- **Título:** Quadro com arrastar por mouse, toque e teclado
- **Tipo:** historia
- **Descrição:** Os cartões do quadro de Projetos mudam de raia arrastando com mouse, toque ou pelas setas no cartão em foco, com o dnd-kit, com feedback de hover e de arraste, e a face do cartão perde o seletor de raia e não tem alça.
- **Critérios de aceite:**
  - [ ] A face do cartão não tem seletor de raia nem alça.
  - [ ] O cartão muda de raia arrastando com o mouse e por toque.
  - [ ] Pelo teclado, as setas no cartão em foco movem entre raias e na mesma raia.
  - [ ] Soltar na mesma raia só muda a ordem.
  - [ ] Foco, anúncios e instruções em português, sem violações de acessibilidade.
  - [ ] Hover eleva o cartão; no arraste, o flutuante tem sombra forte e o de origem esmaece.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-26

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 mudança(s) esperada(s) |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | ajuste | in_progress | Alça Mover removida do cartão (HandleIcon, .kcardHandle e card.drag_handle; face segue sem seletor de raia); arrastar pelo cartão inteiro com MouseSensor (distance 6) no lugar do PointerSensor e TouchSensor (delay 200, tolerance 6); teclado sem alça, inferência: setas no link do cartão em foco, foco volta ao link, aria-live e instruções no aria-describedby do link, Enter abre o cartão; feedback visual só com tokens do tema: hover eleva com cursor grab, DragOverlay com sombra forte e grabbing, origem esmaecida, sem transição com prefers-reduced-motion; testes, e2e, modo board-drag e cenário de teclado do states-focus atualizados; Evidências, Concluída quando e Descrição trocam alça por cartão em foco e acrescentam hover e arraste na prancha |
| 7 | 2026-11-01 | ajuste | in_progress | Evidência visual trocada de board-drag.png para o vídeo board-drag.webm (print), gravado com recordVideo em desktop 1280x800 e tema claro (hover, arraste entre raias, reordenar na mesma raia e setas com o cartão em foco); Passo 11, Trecho, Falha e Como comprovar passam a falar do vídeo; checagens ok/FALHA mantidas sem vídeo |
| 8 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 9 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 mudança(s) esperada(s) |
| 10 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 11 | 2026-11-01 | ajuste | in_progress | Dica visível dos comandos de teclado no fim do quadro, em cinza claro (board.keyboard_hint, .boardHint), com teste e critério de conclusão |
| 12 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 13 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 mudança(s) esperada(s) |
| 14 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 15 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 16 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 17 | 2026-11-01 | ajuste | in_progress | Dica de teclado vira lista centralizada de comandos (teclas em kbd e a ação), sem prosa nem o rótulo Teclado |
| 18 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 19 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 mudança(s) esperada(s) |
| 20 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 21 | 2026-11-01 | conferência | usuário | print board-drag.webm conferido pelo usuário (sha256 dc0e0447) |
| 22 | 2026-11-01 | evidências | passed | 3 evidência(s) em evidence/TASK-27/ |
| 23 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Alça Mover removida do cartão (HandleIcon, .kcardHandle e card.drag_handle; face segue sem seletor de raia); arrastar pelo cartão inteiro com MouseSensor (distance 6) no lugar do PointerSensor e TouchSensor (delay 200, tolerance 6); teclado sem alça, inferência: setas no link do cartão em foco, foco volta ao link, aria-live e instruções no aria-describedby do link, Enter abre o cartão; feedback visual só com tokens do tema: hover eleva com cursor grab, DragOverlay com sombra forte e grabbing, origem esmaecida, sem transição com prefers-reduced-motion; testes, e2e, modo board-drag e cenário de teclado do states-focus atualizados; Evidências, Concluída quando e Descrição trocam alça por cartão em foco e acrescentam hover e arraste na prancha |
| 2 | 2026-11-01 | agente | Evidência visual trocada de board-drag.png para o vídeo board-drag.webm (print), gravado com recordVideo em desktop 1280x800 e tema claro (hover, arraste entre raias, reordenar na mesma raia e setas com o cartão em foco); Passo 11, Trecho, Falha e Como comprovar passam a falar do vídeo; checagens ok/FALHA mantidas sem vídeo |
| 3 | 2026-11-01 | agente | Dica visível dos comandos de teclado no fim do quadro, em cinza claro (board.keyboard_hint, .boardHint), com teste e critério de conclusão |
| 4 | 2026-11-01 | agente | Dica de teclado vira lista centralizada de comandos (teclas em kbd e a ação), sem prosa nem o rótulo Teclado |
