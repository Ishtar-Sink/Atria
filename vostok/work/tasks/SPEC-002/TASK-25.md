---
id: TASK-25
spec: SPEC-002
title: "Notas e destaques editáveis na tela"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-15]
wave: 4
covers: [RF-31, RF-32, CT-30, CT-31, CB-15]
type: historia
labels: [SPEC-002, padrao]
status: done
content_hash: 9fd5102cc1ddd5e4fad7c8d0332eb9a8b49eaa093b3210f07c9c9295c195c0ee
adjustments: 1
adjusted_at: 2026-11-01T13:37:21Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: 453742d89472e6513168c90189bbfa9ccedae6b5393fc54e3e88b4e3d46af4e5
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T13:37:21Z
---

# TASK-25: Notas e destaques editáveis na tela

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Acervo e leitor: as notas já têm PATCH e DELETE no servidor, mas a tela não oferece; os destaques só tinham GET e POST), RF-31, RF-32, CT-30, CT-31, CB-15, RN-08, "Contratos e interfaces" (`PATCH`/`DELETE` de `/books/{id}/highlights/{highlight_id}` e `/articles/{id}/highlights/{highlight_id}`), a premissa das notas no servidor e a decisão 16 (inferência H: exclusão lógica).
- `vostok/work/tasks/SPEC-002/TASK-12.md` e `vostok/work/tasks/SPEC-002/TASK-15.md`: as rotas novas de destaque (corpo `{ "color": ... }` com resposta 200 e `DELETE` com 204) e os tipos gerados em `packages/contracts/src/schema.ts`.
- `packages/contracts/src/schema.ts` (arquivo gerado, grande): só por busca, `UpdateItemNoteRequest`, `ItemNoteResponse`, `HighlightResponse`, `HighlightColor` e as operações de `/highlights/{highlight_id}`.
- `vostok/rules/project/frontend.md` (em especial [project/frontend-09], [project/frontend-10], [project/frontend-14] e [project/frontend-18]), `vostok/rules/project/architecture.md` ([project/architecture-10]: modal só para confirmação), `vostok/rules/project/code-style.md`, `vostok/rules/project/testing.md` e `vostok/rules/project/language.md`.
- `apps/web/src/features/library/use-item-notes.ts`: `notesPath`, `useItemNotes` e `useCreateItemNote` (padrão otimista com desfazer e aviso).
- `apps/web/src/features/library/item-notes-tab.tsx`: o formulário de nova nota e a validação (trecho ou comentário, página maior que zero).
- `apps/web/src/features/library/reading-history-tab.tsx`: padrão de Editar e Excluir com `ConfirmDialog`, `styles.sessionActions` e `styles.linkButton`, com `aria-label` que diz qual item.
- `apps/web/src/features/library/library.module.css` (mais de 400 linhas): `.linkButton` (linhas 48-81), `.noteRow` e `.sessionActions` (linhas 423-457), `.noteForm` (linha 468) e `.fieldError`, `.fieldLabel`, `.textareaRoot` e `.textarea` (linhas 537-595).
- `apps/web/src/features/library/use-library-items.ts`: `libraryKeys.notes`, `itemPath` e `refusalMessageKey`.
- `apps/web/src/features/reader/use-highlights.ts` e `apps/web/src/features/reader/highlights-tab.tsx`; `apps/web/src/features/reader/selection-toolbar.tsx` (botões `.swatch` de cor com nome acessível).
- `apps/web/src/features/reader/reader.module.css` (mais de 400 linhas): `.swatch` (linhas 209-242) e `.highlightList` a `.dot` (linhas 330-383).
- `apps/web/src/shared/optimistic/use-optimistic-mutation.ts`: `useOptimisticMutation`.
- `apps/web/src/app/entity-layout.tsx`: fn `entityExtraTabs`, que monta a aba Destaques nos livros e artigos.
- `apps/web/src/features/library/i18n/pt-br.json` (chaves `notes.*`) e `apps/web/src/features/reader/i18n/pt-br.json` (chaves `highlight*`).
- `apps/web/src/features/library/library-test-server.ts`: fn `stubLibraryServer`, bloco `section?.endsWith('-notes')`, e fn `renderLibrary`.
- `apps/web/src/features/library/book-page.test.tsx`: casos `adds a note to the book history` e `asks for a quote or a comment before adding a note`, como exemplo.
- `apps/web/src/features/reader/highlights-tab.test.tsx`.
- `apps/web/src/features/library/library.e2e.ts` (casos `ct28` e `ct29`, que abrem a aba Notas) e `apps/web/src/features/reader/reader.e2e.ts` (caso `CT-38`, que cria destaques).
- `apps/web/scripts/evidence-library.mjs` (922 linhas): `OUT` (linha 20), fn `installApi` (linhas 282-348, rotas das notas), fn `runScenarios`, fn `sheet` e `EVIDENCES` (linha 874); `apps/web/src/features/library/evidence/harness.tsx`.

### Mudar

- `apps/web/src/features/library/use-item-notes.ts` (alterar): mutações otimistas de editar (`PATCH`) e excluir (`DELETE`) nota, e a validação compartilhada da nota.
- `apps/web/src/features/library/item-notes-tab.tsx` (alterar): ações Editar e Excluir em cada nota, edição no próprio histórico e confirmação da exclusão.
- `apps/web/src/features/reader/use-highlights.ts` (alterar): mutações otimistas de trocar a cor (`PATCH`) e excluir (`DELETE`) destaque.
- `apps/web/src/features/reader/highlights-tab.tsx` (alterar): escolha da cor e Excluir em cada destaque, com confirmação.
- `apps/web/src/features/reader/reader.module.css` (alterar): linha de ações do destaque e cor escolhida marcada no `.swatch`.
- `apps/web/src/features/library/i18n/pt-br.json` (alterar): textos de editar e excluir nota.
- `apps/web/src/features/reader/i18n/pt-br.json` (alterar): textos de trocar a cor e excluir destaque.
- `apps/web/src/features/library/item-notes-tab.test.tsx` (criar): testes de editar e excluir notas de livro, artigo e vídeo, da recusa do servidor, do CB-15 e do axe.
- `apps/web/src/features/library/library-test-server.ts` (alterar): `PATCH` e `DELETE` das notas na API falsa.
- `apps/web/src/features/reader/highlights-tab.test.tsx` (alterar): testes de trocar a cor e excluir destaque de livro e de artigo, com a recusa do servidor.
- `apps/web/src/features/library/library.e2e.ts` (alterar): e2e do CT-30 contra o servidor real.
- `apps/web/src/features/reader/reader.e2e.ts` (alterar): e2e do CT-31 contra o servidor real.
- `apps/web/scripts/evidence-library.mjs` (alterar): modo `notes-highlights`, que edita e exclui notas e destaques no navegador, confere os dois temas e larguras e grava o vídeo das abas, e a pasta de saída lida de `VOSTOK_EVIDENCE`.
- `apps/web/src/features/library/evidence/harness.tsx` (alterar): montar as abas extras de livro e artigo (Destaques) com `entityExtraTabs`, como o app.

### Passos

1. Confira em `packages/contracts/src/schema.ts` (gerado pela TASK-15) que existem as operações `PATCH` e `DELETE` de `/books/{id}/highlights/{highlight_id}` e `/articles/{id}/highlights/{highlight_id}`. Se faltarem, **pare** e informe o Coordenador: a TASK-15 não entregou o contrato.
2. Em `apps/web/src/features/library/library-test-server.ts`, no bloco `section?.endsWith('-notes')`: com `section_id` e `PATCH`, aplique o corpo à nota (`{ ...note, ...body, updated_at: '2026-10-27T10:00:00Z' }`) e responda 200 com ela; com `section_id` e `DELETE`, tire a nota de `server.notes` e responda 204; sem nota com o id, 404 `not_found`.
3. Escreva os testes de `apps/web/src/features/library/item-notes-tab.test.tsx` (criar), com `stubLibraryServer` e `renderLibrary` e uma nota inicial por item (livro `b-1`, artigo `a-1` e vídeo `v-1`, rotas `/library/books/b-1?tab=notes`, `/library/articles/a-1?tab=notes` e `/library/videos/v-1?tab=notes`). Casos, com os nomes exatos:
   - `rf31 edits a book note`, `rf31 edits an article note` e `rf31 edits a video note`: clicar em "Editar a nota “<início do texto>”", trocar o comentário, salvar; o texto novo aparece na lista na hora e o `PATCH` em `/api/v1/<books|articles|videos>/<id>/<book|article|video>-notes/<nota>` leva `{ quote, comment, page }` com `null` nos vazios.
   - `rf31 deletes a book note after confirmation`, `rf31 deletes an article note after confirmation` e `rf31 deletes a video note after confirmation`: "Excluir a nota “…”", confirmar "Excluir nota" no diálogo; a nota some da lista e há um `DELETE` na rota da nota.
   - `rf31 keeps the note when the deletion is cancelled`: cancelar o diálogo não chama `DELETE`.
   - `rf31 validates the edited note inside the form`: apagar trecho e comentário e salvar mostra, com `role="alert"`, "Escreva um trecho ou um comentário." e não chama `PATCH`.
   - `rf31 rolls back the edit and warns when the server refuses`: com `reject: [{ method: 'PATCH', match: /-notes\//, status: 500, code: 'boom' }]`, o texto antigo volta e `getToasts()` tem `library.undo_notice`.
   - `cb15 a deleted note is gone when the list is reloaded`: excluir a nota, desmontar com `cleanup()`, montar de novo a mesma rota sobre o mesmo `server` (como outra aba que recarrega) e ver a lista vazia ("Nenhuma nota ainda").
   - `rf31 has no axe violations with the edit form open`.
4. Atualize `apps/web/src/features/reader/highlights-tab.test.tsx`: troque `stubApi(items)` por um `fetch` falso que guarda as chamadas e responde `GET` com a lista, `PATCH` com o destaque e a cor do corpo e `DELETE` com 204 (com um modo de recusa 500 `boom`); os casos atuais continuam com os mesmos nomes. Acrescente, com os nomes exatos, renderizando com `item_type="book"` e com `item_type="article"`:
   - `rf32 changes the color of a book highlight` e `rf32 changes the color of an article highlight`: no grupo "Cor do destaque da página 3", clicar em "Trocar para verde"; o botão fica com `aria-pressed="true"`, o nome da cor na linha muda para "verde" na hora e há um `PATCH` em `/api/v1/<books|articles>/<id>/highlights/h-1` com `{ color: 'success' }`.
   - `rf32 deletes a book highlight after confirmation` e `rf32 deletes an article highlight after confirmation`: "Excluir o destaque da página 3", confirmar "Excluir destaque"; o item some da lista e há um `DELETE` na rota do destaque.
   - `rf32 rolls back the color and warns when the server refuses`: com o modo de recusa, a cor antiga volta e `getToasts()` tem `reader.highlight_change_error`.
   - `rf32 disables the actions of a highlight not saved yet`: um destaque com id `temp-1` tem os botões de cor e Excluir desabilitados.
   - `rf32 has no axe violations with the actions`.
5. Rode `pnpm --filter @atria/web exec vitest run src/features/library/item-notes-tab.test.tsx src/features/reader/highlights-tab.test.tsx` e confira que os casos novos falham.
6. Em `apps/web/src/features/library/use-item-notes.ts`:
   - Exporte `type ItemNotePatch = Schemas['UpdateItemNoteRequest']`.
   - Crie `export function validateNote(draft: { quote: string; comment: string; page: string }): { error?: 'library.notes.add_error' | 'library.notes.page_invalid'; body?: { quote: string | null; comment: string | null; page: number | null } }`, com as regras que hoje estão no `submit` do `item-notes-tab.tsx` (trecho ou comentário obrigatório depois de aparar; página vazia ou `/^[1-9]\d{0,8}$/`).
   - Crie `useUpdateItemNote(kind, id)`, `PATCH` em `${notesPath(kind, id)}/${encodeURIComponent(note_id)}` com variáveis `{ note_id: string; patch: ItemNotePatch }`, e `useDeleteItemNote(kind, id)`, `DELETE` na mesma rota com `{ note_id: string }`. As duas seguem o `useCreateItemNote`: `cancelQueries`, guardam a lista anterior, aplicam na hora (troca os campos da nota ou tira a nota de `items`), desfazem com `pushToast({ tone: 'danger', message_key: refusalMessageKey(error) })` na recusa e invalidam `libraryKeys.notes(kind, id)` no fim.
7. Em `apps/web/src/features/library/item-notes-tab.tsx`:
   - O `submit` da nota nova passa a usar `validateNote` (mesmas mensagens; a nota nova só envia os campos preenchidos, como hoje).
   - Em cada `li.noteRow`, depois do conteúdo, `<div className={styles.sessionActions}>` com dois `<button type="button" className={styles.linkButton}>`: "Editar" (`aria-label={t('library.notes.edit_label', { excerpt })}`) e "Excluir" (`aria-label={t('library.notes.delete_label', { excerpt })}`), em que `excerpt` é o trecho ou o comentário, aparado e cortado em 40 caracteres com "…". Notas com id `pending-` (ainda sem resposta do servidor) mostram os dois botões com `disabled`.
   - Editar troca o conteúdo da linha por um `<form noValidate className={styles.noteForm} aria-label={t('library.notes.edit_title')}>` com os campos Trecho e Comentário (`textarea`, mesmas classes do formulário novo) e Página (`TextField`), já preenchidos, e os botões "Salvar" (`Button variant="primary" type="submit"`) e "Cancelar" (`Button type="button"`); `Escape` no formulário cancela. Uma nota em edição por vez (estado `editing_id`); ao abrir, o foco vai ao primeiro campo; ao salvar ou cancelar, o foco volta ao botão "Editar" daquela nota.
   - Salvar: `validateNote`; com erro, mostra a mensagem com `role="alert"` no próprio formulário ([project/frontend-09]); sem erro, `update.mutate({ note_id, patch: body })` e sai da edição.
   - Excluir: abre um `ConfirmDialog` da `@atria/ui` (`title` `library.notes.delete_title`, `description` `library.notes.delete_text`, `confirmLabel` `library.notes.delete_confirm`, `cancelLabel` `library.notes.delete_cancel`); confirmar chama `remove.mutate({ note_id })`.
8. Em `apps/web/src/features/reader/use-highlights.ts`, crie, com `useOptimisticMutation` sobre a mesma chave `key(item_type, item_id)` (assim o leitor e a aba mudam juntos):
   - `useChangeHighlightColor(item_type, item_id)`: variáveis `{ highlight_id: string; color: HighlightColor }`, `api.patch<Highlight>(`${itemBase(item_type, item_id)}/highlights/${encodeURIComponent(highlight_id)}`, { color })`, `apply` troca a cor do item e `error_message_key: 'reader.highlight_change_error'`.
   - `useDeleteHighlight(item_type, item_id)`: variáveis `{ highlight_id: string }`, `api.delete<undefined>` na mesma rota, `apply` tira o item da lista e `error_message_key: 'reader.highlight_delete_error'`.
9. Em `apps/web/src/features/reader/highlights-tab.tsx`, em cada `li.highlightItem`, depois do texto, `<div className={styles.highlightActions}>` com:
   - `<div role="group" aria-label={t('reader.highlight_color_group', { page: item.page })} className={styles.highlightColors}>` e um `<button type="button" className={styles.swatch} data-color={color} aria-pressed={item.color === color} aria-label={t('reader.highlight_change_to', { color: t(`reader.highlight_color_${color}`) })}>` por cor de `HIGHLIGHT_COLORS`; clicar numa cor diferente chama `change.mutate({ highlight_id: item.id, color })`.
   - `<Button variant="ghost" aria-label={t('reader.highlight_delete_label', { page: item.page })}>{t('reader.highlight_delete')}</Button>`, que abre um `ConfirmDialog` (`reader.highlight_delete_title`, `reader.highlight_delete_text`, `reader.highlight_delete_confirm`, `reader.highlight_delete_cancel`); confirmar chama `remove.mutate({ highlight_id })`.
   - Com id começando por `temp-`, todos esses botões com `disabled`.
10. Em `apps/web/src/features/reader/reader.module.css`, só com tokens do tema: `.highlightActions` (`display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s3)`), `.highlightColors` (`display: flex; gap: var(--s2)`), `.swatch[aria-pressed='true']` (`border-color: var(--text)`, `box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text)`) e `.swatch:disabled` (`cursor: not-allowed; opacity: 0.5`).
11. Em `apps/web/src/features/library/i18n/pt-br.json`, acrescente: `"notes.edit": "Editar"`, `"notes.edit_label": "Editar a nota “{excerpt}”"`, `"notes.edit_title": "Editar nota"`, `"notes.save": "Salvar"`, `"notes.cancel": "Cancelar"`, `"notes.delete": "Excluir"`, `"notes.delete_label": "Excluir a nota “{excerpt}”"`, `"notes.delete_title": "Excluir esta nota?"`, `"notes.delete_text": "A nota sai do histórico do item. Isso não pode ser desfeito."`, `"notes.delete_confirm": "Excluir nota"` e `"notes.delete_cancel": "Cancelar"`. Em `apps/web/src/features/reader/i18n/pt-br.json`: `"highlight_color_group": "Cor do destaque da página {page}"`, `"highlight_change_to": "Trocar para {color}"`, `"highlight_change_error": "Não foi possível trocar a cor do destaque. A mudança foi desfeita."`, `"highlight_delete": "Excluir"`, `"highlight_delete_label": "Excluir o destaque da página {page}"`, `"highlight_delete_title": "Excluir este destaque?"`, `"highlight_delete_text": "O destaque sai do leitor e desta lista."`, `"highlight_delete_confirm": "Excluir destaque"`, `"highlight_delete_cancel": "Cancelar"` e `"highlight_delete_error": "Não foi possível excluir o destaque. Ele voltou para a lista."`.
12. Em `apps/web/src/features/library/library.e2e.ts`, acrescente `ct30 edits and deletes notes of a book, an article and a video`: para cada item criado pela tela (como nos casos `ct28` e `ct29`), adicionar uma nota na aba Notas, editá-la ("Editar a nota …", novo comentário, Salvar, texto novo visível depois de `page.reload()`) e excluí-la (confirmar "Excluir nota", lista vazia depois de `page.reload()`). Em `apps/web/src/features/reader/reader.e2e.ts`, acrescente `CT-31 changes the color and deletes a highlight of a book and an article`: criar um destaque como no `CT-38`, abrir a aba Destaques, "Trocar para verde" (cor "verde" depois de `page.reload()`), excluir (confirmar "Excluir destaque") e conferir que a lista e o leitor não mostram mais o destaque depois de recarregar.
13. Em `apps/web/src/features/library/evidence/harness.tsx`, troque `createLibraryRoutes(rootRoute)` por `createLibraryRoutes(rootRoute, { book_extra_tabs: entityExtraTabs('/library/books/$bookId'), article_extra_tabs: entityExtraTabs('/library/articles/$articleId') })`, com o import de `entityExtraTabs` de `../../../app/entity-layout`, e atualize o comentário do topo.
14. Em `apps/web/scripts/evidence-library.mjs`:
    - Troque `const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-28');` por `const OUT = process.env.VOSTOK_EVIDENCE ?? join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-28');` e atualize o comentário do topo.
    - No `installApi`, as notas passam a vir de um estado em memória (duas notas no livro `ids.book1`, uma com trecho e página e outra só com comentário), com `PATCH` e `DELETE` em `/<itens>/<id>/<tipo>-notes/<nota>`; e os destaques de `/books/<id>/highlights` e `/articles/<id>/highlights` (dois por item, cores `accent` e `warning`), com `PATCH` (troca a cor) e `DELETE` (204) em `/highlights/<id>`; `/links` responde lista vazia.
    - Acrescente a `EVIDENCES` o modo `notes-highlights`, nos dois temas, em desktop e em 360 px, com as verificações `check`: "nota editada no histórico" (Editar, novo comentário, Salvar, texto novo na lista e o `PATCH` registrado), "formulário de edição com rótulos e foco visível", "diálogo de exclusão da nota" (captura com o diálogo aberto), "nota excluída some da lista" (com o `DELETE`), "cor do destaque trocada" (`aria-pressed` na cor nova e o `PATCH` com `{ color }`), "contorno de foco visível na cor (≥ 2 px)", "destaque excluído some da lista" (com o `DELETE`) e "sem rolagem horizontal", mais o `baseChecks`. As verificações dos dois temas e das duas larguras seguem sem vídeo. Grave também o vídeo `notes-highlights.webm` com `recordVideo` do Playwright (desktop 1280x800, tema claro, cursor visível pelo molde do modo `board-drag` de `evidence-projects.mjs`, salvo com `page.video().saveAs(...)` depois de fechar o contexto), em ritmo de acompanhar: editar uma nota, excluir com a confirmação e o desfazer (cancelar e confirmar), trocar a cor de um destaque e excluir um destaque. Imprima a linha `video:` e atualize a mensagem de uso.
15. Rode os testes do passo 5 até passarem; depois rode a Verificação inteira e corrija lint, Prettier e tipos até tudo terminar sem erro.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/library/book-page.test.tsx src/features/library/video-page.test.tsx src/features/reader/highlights-tab.test.tsx --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | grep -v -E '> (rf31|rf32|cb15) ' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/library src/features/reader`
- `pnpm --filter @atria/web exec prettier --check src/features/library src/features/reader scripts/evidence-library.mjs`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-library.mjs`

### Verificação

```bash
# evidência: notes-highlights-tests.txt
pnpm --filter @atria/web exec vitest run src/features/library/item-notes-tab.test.tsx src/features/reader/highlights-tab.test.tsx --reporter=verbose
pnpm --filter @atria/web exec vitest run src/features/library src/features/reader
pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/library src/features/reader
pnpm --filter @atria/web exec prettier --check src/features/library src/features/reader scripts/evidence-library.mjs
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-library.mjs
# evidência: notes-highlights-e2e-list.txt
pnpm --filter @atria/web exec playwright test --list src/features/library/library.e2e.ts src/features/reader/reader.e2e.ts
```

### Evidências

- `notes-highlights-tests.txt` (automática, da verificação)
  - Prova: as notas de livro, artigo e vídeo são editadas e excluídas na tela, com confirmação, validação no formulário e desfazer com aviso na recusa; a nota excluída não volta ao recarregar; os destaques de livro e artigo trocam de cor e são excluídos, também com desfazer na recusa; sem violações no axe (RF-31, RF-32, CT-30, CT-31, CB-15).
  - Trecho: os casos `rf31 edits a book note`, `rf31 edits a video note`, `rf31 deletes an article note after confirmation`, `cb15 a deleted note is gone when the list is reloaded`, `rf32 changes the color of an article highlight`, `rf32 deletes a book highlight after confirmation` e `rf32 rolls back the color and warns when the server refuses` com `✓`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou `No test files found`.
  - Requer: `apps/web/src/features/library/item-notes-tab.test.tsx`
- `notes-highlights-e2e-list.txt` (automática, da verificação)
  - Prova: os e2e do CT-30 e do CT-31 estão escritos e compilam; contra o servidor real (integração), conferem a nota editada e excluída depois de recarregar e o destaque excluído fora do leitor (RN-08).
  - Trecho: as linhas com `ct30 edits and deletes notes of a book, an article and a video` e `CT-31 changes the color and deletes a highlight of a book and an article`.
  - Falha: erro de compilação, `Error:` ou algum dos dois casos ausente.
- `notes-highlights.webm` (print): `node apps/web/scripts/evidence-library.mjs notes-highlights`
  - Prova: no Chromium, a aba Notas mostra Editar e Excluir em cada nota, o formulário de edição no próprio histórico e o diálogo de exclusão, e a aba Destaques mostra as cores com a atual marcada e o Excluir, nos temas claro e escuro, em desktop e em 360 px (RF-31, RF-32, CT-30, CT-31, RNF-03).
  - Trecho: uma linha `ok` por verificação (nota editada, formulário com rótulos e foco, diálogo de exclusão, nota excluída some, cor trocada, foco visível na cor, destaque excluído some, sem rolagem horizontal, axe sem violações), a linha `video:` e `ok  0 falha(s)`; no vídeo, o cursor visível percorrendo editar a nota, excluir com a confirmação e o desfazer, trocar a cor do destaque (com o anel de seleção) e excluir o destaque.
  - Falha: alguma linha `FALHA`, a ausência da linha `video:`, código de saída diferente de 0, ou no vídeo notas sem ações, a cor atual sem marca ou rolagem horizontal em 360 px.

### Concluída quando

- [x] Cada nota de livro, artigo e vídeo pode ser editada no próprio histórico e excluída com confirmação, e a mudança aparece na hora (RF-31, CT-30).

  > Como comprovar: em `notes-highlights-tests.txt`, ver aprovados os três casos `rf31 edits ...` e os três `rf31 deletes ... after confirmation`; no vídeo `notes-highlights.webm`, ver o formulário de edição e o diálogo de exclusão.

- [x] A edição valida a nota no formulário e, se o servidor recusar, a nota volta ao que era com um aviso (RF-31, [project/frontend-09], [project/frontend-18]).

  > Como comprovar: em `notes-highlights-tests.txt`, ver aprovados `rf31 validates the edited note inside the form` e `rf31 rolls back the edit and warns when the server refuses`.

- [x] Uma nota excluída deixa de aparecer quando outra tela recarrega a lista (CB-15).

  > Como comprovar: em `notes-highlights-tests.txt`, ver aprovado `cb15 a deleted note is gone when the list is reloaded`.

- [x] Um destaque de livro ou de artigo troca de cor e é excluído na aba Destaques, sumindo também do leitor, que usa a mesma consulta (RF-32, CT-31, RN-08).

  > Como comprovar: em `notes-highlights-tests.txt`, ver aprovados `rf32 changes the color of a book highlight`, `rf32 changes the color of an article highlight`, `rf32 deletes a book highlight after confirmation` e `rf32 deletes an article highlight after confirmation`; o `deleted_at` no banco é conferido pelos testes da TASK-12 e pelo e2e `CT-31` na integração.

- [x] As ações têm nome acessível que diz qual nota ou destaque, a cor atual fica marcada, e não há violações de acessibilidade (RNF-03).

  > Como comprovar: em `notes-highlights-tests.txt`, ver aprovados `rf31 has no axe violations with the edit form open` e `rf32 has no axe violations with the actions`; no log da evidência, ver `ok` em "axe sem violações" e "contorno de foco visível na cor".

- [x] Testes, lint, Prettier e typecheck passam sem warning, e os e2e de CT-30 e CT-31 estão listados.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; em `notes-highlights-e2e-list.txt`, ver os casos `ct30` e `CT-31`.

## Descrição

### Resumo executivo

As notas de livros, artigos e vídeos passam a ser editadas e excluídas na própria tela, e os destaques do leitor ganham troca de cor e exclusão.
O benefício é corrigir ou limpar o que foi anotado sem depender de outra ferramenta: hoje a nota ou o destaque errado fica para sempre.
Perfil padrão: telas e chamadas que seguem padrões que o app já usa (edição otimista, confirmação de exclusão).
Risco baixo; depende do contrato gerado com as rotas novas de destaque (TASK-15, sobre a TASK-12) e não bloqueia outras tarefas.

### Detalhes técnicos

**Abordagem.** As notas já têm `PATCH` e `DELETE` no servidor ("Estado atual" da spec); faltam as mutações e as ações na tela. `use-item-notes.ts` ganha `useUpdateItemNote` e `useDeleteItemNote`, no mesmo padrão otimista do `useCreateItemNote` (aplica na hora, desfaz com aviso na recusa e invalida a lista, [project/frontend-18]), e a validação da nota sai do componente para `validateNote`, usada pela criação e pela edição ([project/code-style-09]). Os destaques usam as rotas novas da TASK-12 (`PATCH` com `{ color }` e `DELETE` lógico, decisão 16, inferência H) pelo `useOptimisticMutation` sobre a mesma chave de consulta do leitor: trocar a cor ou excluir na aba muda também o leitor aberto (RN-08).

**Decisões.**
- Edição da nota no próprio histórico, como a criação, que já acontece na aba. Alternativa descartada: uma rota própria de edição, como a das sessões de leitura ([project/architecture-10]), que pediria rotas novas no `routes.tsx` do Acervo, fora dos componentes do plano, para uma nota curta; o modal fica só para a confirmação da exclusão.
- Exclusão com `ConfirmDialog` nas notas e nos destaques, como nas sessões de leitura. Alternativa descartada: excluir na hora com "desfazer" no aviso, padrão que o app não tem.
- A cor do destaque é escolhida pelos mesmos botões de cor do leitor (`.swatch`), com `aria-pressed` na atual. Alternativa descartada: um `SelectField` de cor, menos direto e diferente da barra de seleção do leitor.
- Os corpos dos pedidos usam os tipos gerados (`UpdateItemNoteRequest` e a cor de `HighlightResponse`), sem tipo de API escrito à mão ([project/api-02]).
- Nota ou destaque ainda sem id do servidor (`pending-`, `temp-`) fica com as ações desabilitadas, para não pedir `PATCH` de um id que não existe.

**Arquivos além dos componentes do plano.** `reader.module.css` (ações do destaque), os `i18n/pt-br.json` do Acervo e do leitor ([project/language-06]), os testes (`item-notes-tab.test.tsx`, `library-test-server.ts`, `highlights-tab.test.tsx`, `library.e2e.ts`, `reader.e2e.ts`) e a evidência (`scripts/evidence-library.mjs` e `library/evidence/harness.tsx`, que passa a montar a aba Destaques como o app).

**Riscos.** Depende do contrato da TASK-15; o passo 1 para a tarefa se as rotas de destaque não estiverem nele. A TASK-21 e a TASK-23 (onda 3) também mexem no Acervo e no leitor; esta tarefa parte do estado deixado por elas.

**Referências.** RF-31, RF-32, CT-30, CT-31, CB-15, RN-08, decisão 16 (H).

**Arquivos em comum na onda 4.** Nenhum: TASK-16 (Financeiro), TASK-20 (Diário) e TASK-28 (Tarefas) não alteram os arquivos desta tarefa.

### Card

- **Título:** Notas e destaques editáveis na tela
- **Tipo:** historia
- **Descrição:** Editar e excluir as notas de livros, artigos e vídeos, e trocar a cor ou excluir os destaques do leitor, com confirmação e desfazer quando o servidor recusar.
- **Critérios de aceite:**
  - [ ] Cada nota de livro, artigo e vídeo pode ser editada e excluída.
  - [ ] A nota excluída não volta ao recarregar a lista.
  - [ ] Cada destaque de livro e artigo troca de cor e pode ser excluído.
  - [ ] O destaque excluído some também do leitor.
  - [ ] Ações com nome acessível e sem violações de acessibilidade.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-15

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | ajuste | in_progress | Evidência de notas e destaques passa de prancha PNG para vídeo .webm gravado pelo script (desktop 1280x800, tema claro, cursor visível); linha png: vira video:; passo, Evidência (Trecho e Falha) e Como comprovar atualizados |
| 4 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-11-01 | regressão | passed | 5 comando(s) iguais ao baseline |
| 6 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 7 | 2026-11-01 | conferência | usuário | print notes-highlights.webm conferido pelo usuário (sha256 2d03eb63) |
| 8 | 2026-11-01 | evidências | passed | 3 evidência(s) em evidence/TASK-25/ |
| 9 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Evidência de notas e destaques passa de prancha PNG para vídeo .webm gravado pelo script (desktop 1280x800, tema claro, cursor visível); linha png: vira video:; passo, Evidência (Trecho e Falha) e Como comprovar atualizados |
