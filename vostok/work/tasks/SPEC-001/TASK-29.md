---
id: TASK-29
spec: SPEC-001
title: "Modo leitura"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-65, RF-66, RF-67, RF-68, RF-69, RF-70, CT-35, CT-36, CT-37, CT-38]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: 1ff8416ec529ee1e349d7ebc9645259ffcec5388bb250ef374e6809c68611360
adjustments: 4
adjusted_at: 2026-10-31T11:42:47Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 687a8430ccf176862351e11b813bc550b4daf50a06eeb5e533018e09112a60b7
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T11:42:47Z
model: sonnet
---

# TASK-29: Modo leitura

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-65 a RF-70, CT-35 a CT-38, RN-22 a RN-25, CB-16 a CB-20, contrato do destaque, rotas do modo leitura, risco do PDF grande e decisões 44 a 52.
- `vostok/rules/project/frontend.md`: tema, contraste, animações com `--motion-*`, teclado e Optimistic UI.
- `vostok/rules/project/architecture.md`: [project/architecture-10] e [project/architecture-12] (sem CDN).
- `vostok/rules/project/stack.md`: [project/stack-12] (dependência nova com justificativa).
- `vostok/rules/project/security.md`: [project/security-10] e [project/security-11] (CSP sem inline).
- `vostok/rules/project/code-style.md`: componentes sem regra de negócio, só tokens do tema.
- `vostok/rules/project/testing.md`: Vitest, Testing Library, axe e testes determinísticos.
- `vostok/rules/project/language.md`: textos em arquivo de tradução.
- `vostok/rules/project/naming-convention.md`: arquivos em `kebab-case`, chaves de objetos em `snake_case`.
- `prototype/atria-prototype.html`: modo leitura validado no protótipo com o PDF de exemplo, inclusive a oferta de sessão ao fechar (`requestCloseReader`).
- `docs/decisoes-do-prototipo.md`: linha PD-60 (sessão só com páginas lidas e data; ao fechar, a oferta vem preenchida com as páginas avançadas e pode ser corrigida) e a seção "Decisões resolvidas em 30/10 (DEC-002)". A decisão vale sobre o texto antigo desta tarefa.
- `vostok/memory/decisions.md`: DEC-002 (as telas seguem as decisões do protótipo), DEC-003 e DEC-004 (a página onde a leitura retoma muda só pelo modo leitura; a sessão de leitura não a altera), consultadas com `vostok memory search decision DEC-002 DEC-003 DEC-004`.
- `vostok/work/tasks/SPEC-001/TASK-13.md`: contrato da sessão ajustado (`POST /books/{id}/reading-sessions` com `pages_read` e `read_on` obrigatórios e `from_page`/`to_page` opcionais, que vêm juntos ou não vêm e não alteram `last_read_page`) e da posição (`GET|PUT /books/{id}/reading-position` e `/articles/{id}/reading-position`, a única gravação da retomada).
- `apps/web/package.json`: conferir a dependência `pdfjs-dist`, declarada pela TASK-05.
- `apps/web/vite.config.ts`: como o Vite empacota os workers e os chunks.
- `apps/web/src/app`: só leitura, para ver o roteador raiz e o tema (`data-theme`).
- `apps/web/src/shared`: cliente da API, mutação otimista, i18n comum e utilitário de tema.
- `packages/ui`: botões, barra de ferramentas, diálogo de confirmação, abas e estados.
- `packages/theme`: tokens do tema claro e escuro e as cores `accent`, `primary`, `success`, `warning` e `info` dos destaques.
- `packages/contracts`: tipos gerados de `/files/{id}`, `/books/{id}/reading-position`, `/articles/{id}/reading-position`, `/books/{id}/reading-sessions`, `/books/{id}/book-notes`, `/articles/{id}/article-notes` e `/books/{id}/highlights`, `/articles/{id}/highlights`.
- `apps/web/scripts/evidence-shots.mjs`: molde das evidências visuais automáticas (TASK-05): Vite numa porta livre, Chromium do `@playwright/test`, temas claro e escuro, 1440 e 360 px, `check()` com `ok`/`FALHA`, prancha por `sheet()` e código de saída 1 em falha.

### Mudar

- `apps/web/src/features/reader/routes.tsx` (criar): rotas `/library/books/$bookId/read` e `/library/articles/$articleId/read` com o componente carregado sob demanda, exportadas por `createReaderRoutes(root_route)` para a TASK-35 registrar fora do layout.
- `apps/web/src/features/reader/i18n/pt-br.json` (criar): textos da feature.
- `apps/web/src/features/reader/load-pdf.ts` (criar): único ponto que importa `pdfjs-dist` e configura o worker empacotado.
- `apps/web/src/features/reader/reader-page.tsx` (criar): tela do leitor sem sidebar nem topbar (RF-65).
- `apps/web/src/features/reader/reader-toolbar.tsx` (criar): fechar, zoom, navegação por página, tema e baixar (RF-65, RF-70).
- `apps/web/src/features/reader/pdf-viewer.tsx` (criar): rolagem das páginas com renderização sob demanda.
- `apps/web/src/features/reader/pdf-page.tsx` (criar): página com canvas, camada de texto selecionável e camada de destaques.
- `apps/web/src/features/reader/selection-toolbar.tsx` (criar): ações sobre o trecho selecionado: criar nota e destacar com cor.
- `apps/web/src/features/reader/passage-note-panel.tsx` (criar): painel lateral da nota de trecho com comentário opcional (RF-68).
- `apps/web/src/features/reader/session-offer-dialog.tsx` (criar): confirmação do registro da sessão ao fechar o livro, com as páginas lidas preenchidas e corrigíveis (RF-67, PD-60).
- `apps/web/src/features/reader/highlights-tab.tsx` (criar): aba "Destaques" do livro ou do artigo, exportada para a TASK-35 montar (RF-69).
- `apps/web/src/features/reader/use-pdf-document.ts` (criar): carregamento do PDF por `/files/{id}` e erros de arquivo corrompido ou protegido (CB-16).
- `apps/web/src/features/reader/use-reading-position.ts` (criar): retomada e gravação da última página lida, único ponto que grava a página de retomada (RF-66, CB-18, DEC-004).
- `apps/web/src/features/reader/use-reading-session-offer.ts` (criar): regra da oferta de sessão ao fechar, com as páginas avançadas (RF-67, CB-17, CB-18, RN-23, PD-60).
- `apps/web/src/features/reader/use-passage-note.ts` (criar): criação da nota de trecho (RF-68, CB-20, RN-24).
- `apps/web/src/features/reader/use-highlights.ts` (criar): leitura e criação otimista dos destaques (RF-69, CB-19).
- `apps/web/src/features/reader/reader-page.test.tsx` (criar): testes da tela do leitor.
- `apps/web/src/features/reader/use-reading-position.test.tsx` (criar): testes da retomada.
- `apps/web/src/features/reader/use-reading-session-offer.test.tsx` (criar): testes da oferta de sessão.
- `apps/web/src/features/reader/passage-note-panel.test.tsx` (criar): testes da nota de trecho.
- `apps/web/src/features/reader/highlights-tab.test.tsx` (criar): testes dos destaques.
- `apps/web/src/features/reader/reader.e2e.ts` (criar): fluxos ponta a ponta dos CT-35 a CT-38, rodados só na TASK-35.
- `apps/web/src/features/reader/evidence/harness.tsx` (criar): página de evidência que monta `createReaderRoutes` num roteador em memória do TanStack Router, com os providers do app (tema, TanStack Query, i18n, preferências) e fora do layout do app, como a TASK-35 as registra; não é importada pelo app nem por `apps/web/src/app` (nada muda em `apps/web/src/app`) e por isso fica fora do build de produção; só tokens do tema; passa no typecheck e no lint.
- `apps/web/scripts/evidence-reader.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-reader.mjs themes-widths|states-focus`), em Node sem dependências novas, no molde de `apps/web/scripts/evidence-shots.mjs` (código próprio, sem importar o da TASK-05): sobe o Vite numa porta livre por `createServer` da API do Vite com um plugin que serve uma página HTML virtual carregando o `harness.tsx` (encerra no fim, KNW-006), simula a API com `context.route('/api/**')` e fixtures em memória no próprio script (livro com `last_read_page` 40, um PDF válido de várias páginas com texto montado em bytes no próprio script, bytes inválidos para o PDF corrompido, um destaque, resposta lenta do arquivo para o carregando e `problem+json` nos erros), captura nos temas claro e escuro, em 1440 px e em 360 px, confere o estado no DOM antes de cada captura (tema aplicado, sem rolagem horizontal, sem erro de JS, axe sem violações, inclusive `color-contrast`, e as verificações de cada estado) e imprime `ok` ou `FALHA` por verificação, o caminho do PNG e a última linha `ok  0 falha(s)`; sai com código diferente de 0 se algo falhar; as pranchas vão para `vostok/work/tasks/SPEC-001/evidence/TASK-29/`.

### Passos

1. Ler os arquivos de "Ler" e anotar os nomes exportados por `apps/web/src/shared`, `packages/ui` e `packages/contracts` (posição de leitura, sessões com `pages_read`, `read_on`, `from_page` e `to_page`, notas de livro e de artigo com trecho e página, e destaques com `file_id`, `page`, `color`, `text` e `rects`).
2. Conferir que `apps/web/package.json` já declara `pdfjs-dist` (declarado pela TASK-05) e que `pnpm install` o instalou. Se não estiver declarado, **PARE** e informe que a pré-condição da TASK-05 não foi cumprida; esta tarefa não altera `apps/web/package.json`.
3. Criar `apps/web/src/features/reader/i18n/pt-br.json` com chaves em `snake_case` sob `reader`: `close`, `zoom_in`, `zoom_out`, `zoom_reset`, `page_label`, `page_of`, `previous_page`, `next_page`, `theme_light`, `theme_dark`, `download`, `loading`, `error_corrupted`, `error_protected`, `create_note`, `note_comment`, `note_comment_optional`, `note_page_only`, `note_saved`, `highlight`, `highlight_color_accent`, `highlight_color_primary`, `highlight_color_success`, `highlight_color_warning`, `highlight_color_info`, `session_offer_title` ("Registrar esta sessão de leitura?"), `session_offer_text` ("Você avançou da página {{from}} até a {{to}}. O registro só entra no histórico e no progresso se você confirmar."), `session_offer_pages` ("Páginas lidas"), `session_offer_pages_invalid`, `session_offer_confirm` ("Registrar sessão"), `session_offer_skip`, `session_registered` ("Sessão registrada: {{pages}} páginas."), `session_skipped` ("Sessão não registrada. A página {{page}} foi guardada."), `page_saved` ("Página {{page}} guardada."), `highlights_tab`, `highlights_empty`, `highlights_other_file` e `undo_notice`.
4. Escrever os testes antes do código, com `pdfjs-dist` simulado por `vi.mock` de `./load-pdf` (o jsdom não tem canvas) e o cliente da API simulado:
   - `use-reading-position.test.tsx`: `opens at the last read page of a book`, `opens at the last read page of an article`, `saves the closing page even when it is before the opening page` (CB-18).
   - `use-reading-session-offer.test.tsx`: `pd60 offers 22 pages read when advancing from page 40 to 62`, `pd60 lets the person correct the pages before confirming` (corrigido para 30, o `POST` leva `pages_read: 30`), `pd60 sends pages_read and read_on with the range only when the pages were not corrected` (sem correção: `pages_read: 22`, `read_on` de hoje no fuso da pessoa, `from_page: 40` e `to_page: 62`; com correção: só `pages_read` e `read_on`), `pd60 rejects zero pages inside the dialog with role alert`, `does not offer when the reader did not advance` (CB-17), `does not offer when closing before the opening page` (CB-18), `never offers for an article`, `registers the session only after confirmation` (RN-23), `dec004 saves the closing page whether the session is confirmed or skipped` (o `PUT .../reading-position` com a página 62 acontece nos dois casos), `dec004 confirming the session does not change the resume page` (depois da confirmação, nenhum `PUT .../reading-position` além do do fechamento, e o `POST` da sessão não leva a página de retomada).
   - `passage-note-panel.test.tsx`: `creates a note with the passage and the page`, `creates a note with the passage, the page and a comment`, `creates a page only note when the page has no text` (CB-20), `shows the error inside the panel with role alert`.
   - `highlights-tab.test.tsx`: `lists highlights with their color and page`, `marks highlights from another file` (CB-19), `shows the empty state`, `has no axe violations`.
   - `reader-page.test.tsx`: `renders without sidebar and topbar`, `zooms in and out`, `navigates by page with buttons and keyboard`, `toggles light and dark theme`, `keeps the download button and shows an error for a corrupted pdf` (CB-16), `shows a protected pdf error` (CB-16), `renders only the pages near the viewport`, `shows the loading state`, `has no axe violations`.
5. Rodar `pnpm --filter @atria/web test -- src/features/reader` e confirmar que falham por falta da implementação.
6. Implementar `load-pdf.ts`: importa `pdfjs-dist`, define `GlobalWorkerOptions.workerSrc` com a URL do worker empacotado pelo Vite (`pdfjs-dist/build/pdf.worker.min.mjs?url`) e exporta `loadPdf(url)`, que devolve o documento ou um erro tipado `corrupted` ou `protected` (de `InvalidPDFException` e `PasswordException`). Nenhum outro arquivo importa `pdfjs-dist`.
7. Implementar os hooks: `use-pdf-document.ts` (carrega `/api/v1/files/{file_id}` com cookie de sessão), `use-reading-position.ts` (GET na abertura; PUT na troca de página, com espera curta, e no fechamento), `use-reading-session-offer.ts` (guarda a página de abertura; ao fechar um livro, oferece a sessão só se a página de fechamento for maior que a de abertura, com `pages_read` preenchido com a diferença, 22 de 40 a 62, PD-60; POST em `/books/{id}/reading-sessions` só na confirmação, com `pages_read` (inteiro maior que zero, corrigível) e `read_on` de hoje no fuso da pessoa, mais `from_page` e `to_page` só quando as páginas não foram corrigidas, para o intervalo gravado bater com as páginas; a oferta nunca grava a posição de leitura, que é só do `use-reading-position`, DEC-004), `use-passage-note.ts` (POST em `book-notes` ou `article-notes` com trecho e página; sem texto selecionável, só página e comentário) e `use-highlights.ts` (mutação otimista com `rects` normalizados de 0 a 1 em relação à página).
8. Implementar `pdf-page.tsx` (canvas, camada de texto do `pdfjs-dist` para seleção e camada de destaques com as cores dos tokens) e `pdf-viewer.tsx`, que usa `IntersectionObserver` para renderizar só as páginas visíveis e as vizinhas e libera as distantes.
9. Implementar `reader-toolbar.tsx` (botões com `aria-label`, campo da página atual, zoom, alternar tema do leitor e link "Baixar" para `/api/v1/files/{file_id}` com `download`), `selection-toolbar.tsx` (aparece sobre a seleção, acessível pelo teclado), `passage-note-panel.tsx` (painel lateral dentro do leitor, não modal, com comentário opcional) e `session-offer-dialog.tsx` (diálogo de confirmação de `packages/ui` com o texto "Você avançou da página 40 até a 62", o campo numérico "Páginas lidas" preenchido com 22 e corrigível, erro no próprio diálogo com `role="alert"` e os botões "Registrar sessão" e "Agora não", PD-60).
10. Implementar `reader-page.tsx`: tela inteira sem sidebar nem topbar, tema próprio no elemento raiz do leitor (`data-theme`, iniciado com o tema atual do app e alterado só no leitor), atalhos de teclado (setas e Page Up/Down para página, `+` e `-` para zoom, Esc para fechar) e, no fechar, primeiro grava a página de fechamento pelo `use-reading-position` (sempre, confirmando ou não a sessão, DEC-004) e depois o fluxo de `use-reading-session-offer` antes de voltar à tela do item: confirmada, volta à aba do histórico de leitura com o aviso `session_registered`; recusada, volta à tela do item com `session_skipped`; artigo ou sem avanço, volta com `page_saved`. Erro de PDF mostra a mensagem com `role="alert"` e mantém o botão de baixar (CB-16). Transições só com `--motion-*` e respeitando `prefers-reduced-motion`.
11. Implementar `highlights-tab.tsx` exportando `HighlightsTab({ item_type, item_id })`, com a lista de destaques (cor, página, trecho), a marca "de outro arquivo" quando o `file_id` do destaque for diferente do PDF atual e o estado vazio.
12. Criar `routes.tsx` com `createReaderRoutes(root_route)`: as duas rotas usam `lazyRouteComponent(() => import('./reader-page'))`, para o `pdfjs-dist` ficar num chunk carregado só nelas; `routes.tsx` não importa `load-pdf.ts` nem `pdfjs-dist`. Um comentário diz que a TASK-35 registra estas rotas fora do layout autenticado. A feature não tem `nav.ts`.
13. Criar `reader.e2e.ts` (Playwright) com os CT-35 a CT-38: abrir o PDF de um livro e de um artigo, zoom, navegação, tema, fechar na página 12 e reabrir na 12; ao fechar de 40 a 62, oferta com 22 páginas, confirmada sem correção (histórico com "22 páginas") e com correção, e recusada (a retomada continua na 62 nos três casos); nota de trecho com e sem comentário; dois destaques de cores diferentes na aba "Destaques" e download, em 360 px e desktop, com axe. Não rodar: ele roda na TASK-35.
14. Rodar a Verificação até passar sem nenhum warning de lint.
15. Criar `apps/web/src/features/reader/evidence/harness.tsx` e `apps/web/scripts/evidence-reader.mjs` (veja "Mudar") e rodar `node apps/web/scripts/evidence-reader.mjs themes-widths` e `node apps/web/scripts/evidence-reader.mjs states-focus`. Corrigir o código da tarefa a cada linha `FALHA` e conferir as pranchas `reader-themes-widths.png` e `reader-states-focus.png` abrindo-as.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
pnpm --filter @atria/web test -- src/features/reader
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
grep -q '"pdfjs-dist"' apps/web/package.json
! grep -q "pdfjs-dist" apps/web/src/features/reader/routes.tsx
test "$(grep -rl "pdfjs-dist" apps/web/src/features/reader --include='*.ts' --include='*.tsx' | grep -v '\.test\.tsx$')" = "apps/web/src/features/reader/load-pdf.ts"
! grep -rnE "https?://[^\"' ]*(cdn|unpkg|jsdelivr)" apps/web/src/features/reader
test -f apps/web/src/features/reader/reader.e2e.ts
# Evidências visuais automáticas
test -f apps/web/src/features/reader/evidence/harness.tsx
test -f apps/web/scripts/evidence-reader.mjs
node --check apps/web/scripts/evidence-reader.mjs
```

### Evidências

- `reader-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/reader --reporter=verbose`
  - Prova: os testes do leitor passam, cobrindo tela própria, zoom, navegação, tema, retomada, oferta de sessão, nota de trecho, destaques, download, erros de PDF, renderização sob demanda e axe (RF-65 a RF-70, CT-35 a CT-38, CB-16 a CB-20, RNF-06).
  - Trecho: os arquivos `reader-page.test.tsx`, `use-reading-position.test.tsx`, `use-reading-session-offer.test.tsx`, `passage-note-panel.test.tsx` e `highlights-tab.test.tsx` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `reader-session-offer.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/reader --reporter=verbose -t "pd60|dec004"`
  - Prova: ao fechar o livro, a oferta vem com as páginas avançadas (22, de 40 a 62), pode ser corrigida, grava páginas e data só com a confirmação, e a página de retomada muda só pelo leitor, confirmando ou não a sessão (PD-60, DEC-004, RF-66, RF-67, CT-36).
  - Trecho: os casos `pd60 offers 22 pages read when advancing from page 40 to 62`, `pd60 lets the person correct the pages before confirming`, `pd60 sends pages_read and read_on with the range only when the pages were not corrected`, `dec004 saves the closing page whether the session is confirmed or skipped` e `dec004 confirming the session does not change the resume page` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests`, `No test files found` ou nenhum caso `pd60` ou `dec004` executado.
- `reader-bundle.txt` (automática): `grep -rln "pdfjs-dist" apps/web/package.json apps/web/src/features/reader`
  - Prova: o `pdfjs-dist` é dependência do próprio app (declarada pela TASK-05) e só `load-pdf.ts` o importa, carregado sob demanda pelas rotas do leitor (risco do PDF grande, [project/architecture-12]).
  - Trecho: só as linhas `apps/web/package.json` e `apps/web/src/features/reader/load-pdf.ts` (além de arquivos de teste, se houver), sem `routes.tsx`.
  - Falha: saída vazia, `No such file or directory` ou `routes.tsx` na lista.
- `reader-files.txt` (automática): `find apps/web/src/features/reader -type f | sort`
  - Prova: a feature tem rotas, traduções, telas, hooks, testes, a aba "Destaques" e o e2e dos CT-35 a CT-38.
  - Trecho: `routes.tsx`, `i18n/pt-br.json`, `highlights-tab.tsx` e `reader.e2e.ts` na lista.
  - Falha: `No such file or directory` ou algum desses arquivos ausente.
- `reader-themes-widths.txt` (automática): `node apps/web/scripts/evidence-reader.mjs themes-widths`
  - Prova: tela própria sem sidebar nem topbar, nos dois temas e a partir de 360 px, medida no DOM e fotografada com um PDF aberto, um destaque e o painel da nota de trecho (RF-65, RNF-08, RNF-10).
  - Trecho: uma linha `ok` por verificação, como `ok ... tema claro aplicado`, `ok ... tema escuro aplicado`, `ok ... sem sidebar nem topbar`, `ok ... página do PDF renderizada`, `ok ... destaque visível na página`, `ok ... painel da nota de trecho aberto`, `ok ... barra do leitor inteira dentro da janela`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclusive color-contrast)` em cada captura; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-29/reader-themes-widths.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (sidebar ou topbar visível, barra cortada em 360 px, contraste baixo no tema escuro), a ausência da linha `png:`, código de saída diferente de 0 ou a prancha sem algum dos estados.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-29/reader-themes-widths.png`, a prancha com as capturas rotuladas do leitor com o PDF aberto, um destaque e o painel da nota de trecho, nos temas claro e escuro, em 360 px e em 1440 px.
- `reader-states-focus.txt` (automática): `node apps/web/scripts/evidence-reader.mjs states-focus`
  - Prova: estados de carregando e erro, a oferta de sessão preenchida e o foco por teclado, com a API simulada (arquivo lento, bytes de PDF inválidos e o livro aberto na página 40 e fechado na 62) (CB-16, RF-67, RNF-06, PD-60).
  - Trecho: `ok ... estado carregando · indicador visível`, `ok ... PDF corrompido · erro em role="alert" com o botão "Baixar" visível`, `ok ... oferta de sessão · texto "da página 40 até a 62"`, `ok ... campo "Páginas lidas" com 22`, `ok ... barra navegada por Tab · contorno de foco visível (≥ 2 px)`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclusive color-contrast)`; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-29/reader-states-focus.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (erro sem botão de baixar, diálogo sem as páginas preenchidas, foco invisível), a ausência da linha `png:`, código de saída diferente de 0 ou a prancha sem algum dos estados.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-29/reader-states-focus.png`, a prancha com o leitor carregando, o erro de PDF corrompido com o botão "Baixar", o diálogo da oferta de sessão (de 40 a 62, com 22 páginas) e o anel de foco na barra, nos temas claro e escuro, em 360 px e em 1440 px.

### Concluída quando

- [x] O PDF do livro e do artigo abre numa tela própria, sem sidebar nem topbar, com zoom, navegação por página e tema claro ou escuro (RF-65, CT-35).

  > Como comprovar: na saída `reader-tests.txt`, ver aprovados `renders without sidebar and topbar`, `zooms in and out`, `navigates by page with buttons and keyboard` e `toggles light and dark theme`.

- [x] O leitor reabre na última página lida, no livro e no artigo (RF-66, CT-35).

  > Como comprovar: ver aprovados `opens at the last read page of a book` e `opens at the last read page of an article`.

- [x] Ao fechar o livro, a sessão é oferecida com as páginas avançadas já preenchidas (22, de 40 a 62), pode ser corrigida e só entra no histórico, com páginas e data, depois de confirmada; não é oferecida sem avanço nem ao voltar páginas (RF-67, CT-36, PD-60).

  > Como comprovar: em `reader-session-offer.txt`, ver aprovados os casos `pd60`, e em `reader-tests.txt` os demais casos da `use-reading-session-offer.test.tsx`.

- [x] A página onde a leitura retoma muda só pelo leitor: o fechamento a grava, confirmando ou não a sessão, e a sessão não a altera (DEC-004, RF-66).

  > Como comprovar: em `reader-session-offer.txt`, ver aprovados `dec004 saves the closing page whether the session is confirmed or skipped` e `dec004 confirming the session does not change the resume page`.

- [x] Um trecho selecionado vira nota no histórico do item, com a página e comentário opcional, e uma página sem texto gera nota só com a página (RF-68, CT-37).

  > Como comprovar: ver aprovados os casos da `passage-note-panel.test.tsx`, inclusive `creates a page only note when the page has no text`.

- [x] Os trechos podem ser destacados com cor e aparecem na aba "Destaques", com os de outro arquivo marcados (RF-69, CT-38).

  > Como comprovar: ver aprovados `lists highlights with their color and page` e `marks highlights from another file`.

- [x] O leitor tem botão para baixar o PDF, mantido quando o arquivo está corrompido ou protegido (RF-70, CT-38).

  > Como comprovar: ver aprovados `keeps the download button and shows an error for a corrupted pdf` e `shows a protected pdf error`; em `reader-states-focus.txt`, ver `PDF corrompido` com `ok` e `ok  0 falha(s)`, e o botão na prancha `reader-states-focus.png`.

- [x] O `pdf.js` vem empacotado no app, sem CDN, carregado só nas rotas do leitor e com as páginas renderizadas sob demanda.

  > Como comprovar: abrir `reader-bundle.txt` e ver só `apps/web/package.json` e `load-pdf.ts`, sem `routes.tsx`; e ver aprovado `renders only the pages near the viewport`.

- [x] O leitor não tem violações no axe, funciona só pelo teclado e nos dois temas, a partir de 360 px (RNF-06, RNF-08, RNF-10).

  > Como comprovar: ver aprovados os casos `has no axe violations`; em `reader-themes-widths.txt` e `reader-states-focus.txt`, ver `tema claro aplicado`, `tema escuro aplicado`, `contorno de foco visível`, `sem rolagem horizontal` e `axe sem violações` com `ok` e `ok  0 falha(s)`, e conferir as pranchas `reader-themes-widths.png` e `reader-states-focus.png`.

- [x] Testes, typecheck e lint passam sem warning, e o e2e dos CT-35 a CT-38 está escrito para a TASK-35.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; `reader.e2e.ts` aparece em `reader-files.txt`.

## Descrição

### Resumo executivo

Entrega o modo leitura: abrir o PDF de um livro ou artigo numa tela própria, retomar de onde parou, registrar ao fechar a sessão de leitura com as páginas avançadas já preenchidas e guardar notas e destaques dos trechos.
Leva a leitura para dentro do Atria, sem depender de outro programa nem de internet.
Perfil padrão, risco médio: um PDF grande pode pesar, o que é mitigado carregando o leitor só quando ele é aberto.
Libera a integração do frontend, que monta as rotas do leitor e a aba de destaques.

### Detalhes técnicos

- **Abordagem:** feature React em `apps/web/src/features/reader` com `pdfjs-dist` isolado em `load-pdf.ts`, carregado por rota preguiçosa (`lazyRouteComponent`) só em `/library/books/{id}/read` e `/library/articles/{id}/read`. As páginas são renderizadas sob demanda com `IntersectionObserver`. As regras (retomada, oferta de sessão, nota de trecho, destaques) ficam nos hooks e são testadas sem canvas, com `load-pdf.ts` simulado.
- **Componentes:** tela do leitor, barra (fechar, zoom, página, tema, baixar), visualizador, página com camadas de texto e destaques, barra da seleção, painel da nota de trecho, diálogo da oferta de sessão e a aba "Destaques" (`HighlightsTab`), exportada para a TASK-35 montar nas telas do livro e do artigo (TASK-28).
- **Decisões do protótipo (DEC-002):** a oferta de sessão mostra as páginas avançadas (fechamento menos abertura, 22 de 40 a 62) num campo corrigível e grava `pages_read` e `read_on` (PD-60); o intervalo `from_page`/`to_page`, opcional no contrato da TASK-13, vai junto só quando as páginas não foram corrigidas, para não gravar um intervalo que contradiz as páginas, e nunca aparece na tela (descartados enviar sempre o intervalo, que ficaria incoerente após a correção, e nunca enviá-lo, que perderia o CT-36). A página de retomada é gravada só pelo `use-reading-position`, no fechamento e na troca de página, confirmando ou não a sessão (DEC-004); descartado a sessão confirmada atualizar a retomada.
- **Decisões:** `pdfjs-dist` empacotado (decisão 48), descartados o CDN e o leitor nativo; rota própria sem modal (decisão 49); a nota de trecho num painel lateral dentro do leitor, descartado o modal por [project/architecture-10]; a oferta de sessão num diálogo de confirmação, o único modal permitido; o tema do leitor muda só o leitor, descartado mudar o tema global ao ler; a sessão só é gravada depois da confirmação (RN-23). As rotas são registradas pela TASK-35 fora do layout autenticado.
- **Pré-condição:** `pdfjs-dist` declarado em `apps/web/package.json` pela TASK-05, de que esta depende, com a justificativa de [project/stack-12] registrada lá: é o leitor decidido na spec (decisão 48), empacotado para funcionar sem internet ([project/architecture-12]). Esta tarefa não altera esse arquivo; a Verificação confere a declaração.
- **Evidências visuais.** As pranchas `reader-themes-widths.png` e `reader-states-focus.png` são geradas por `apps/web/scripts/evidence-reader.mjs`, no molde do `evidence-shots.mjs` da TASK-05: cada evidência é um comando cuja saída (`.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG, e a prancha vai para a pasta de evidências da tarefa. Como as rotas da feature só são registradas no app pela TASK-35, o script sobe o Vite com uma página virtual que carrega `src/features/reader/evidence/harness.tsx`, que monta `createReaderRoutes` num roteador em memória com os providers do app, fora do layout, sem mudar `apps/web/src/app`; a API e o arquivo são simulados por `context.route('/api/**')` com fixtures no script (o PDF de exemplo é montado em bytes, sem arquivo novo no repositório), o `pdfjs-dist` roda de verdade no Chromium, e cada captura passa pelo axe (inclusive `color-contrast`).
- **Riscos:** PDF grande deixa o leitor lento ou pesa no Lighthouse (mitigado com chunk próprio e renderização sob demanda); worker do `pdf.js` bloqueado pela CSP sem inline (mitigado com o worker como arquivo do próprio app, mesma origem); PDF escaneado sem texto (CB-20, nota só com a página).
- **Referências da spec:** RF-65 a RF-70, CT-35 a CT-38, RN-22 a RN-25, CB-16 a CB-20, decisões 44 a 52, risco "PDF grande", RNF-05, RNF-06, RNF-08, RNF-10; PD-60 de `docs/decisoes-do-prototipo.md`; DEC-002 e DEC-004 da memória; contrato da sessão e da posição da TASK-13.
- **Arquivos em comum na onda 7:** nenhum.

### Card

- **Título:** Modo leitura
- **Tipo:** historia
- **Descrição:** Modo leitura de PDF de livros e artigos com `pdf.js` empacotado: tela própria, zoom, navegação, tema, retomada, registro da sessão ao fechar, notas de trecho, destaques com cor e download.
- **Critérios de aceite:**
  - [ ] Leitor em tela própria com zoom, navegação, tema e retomada da última página.
  - [ ] Oferta da sessão ao fechar o livro com as páginas avançadas preenchidas e corrigíveis, gravada só com confirmação.
  - [ ] A página de retomada muda só pelo leitor, confirmando ou não a sessão.
  - [ ] Notas de trecho com comentário opcional e destaques com cor na aba "Destaques".
  - [ ] Botão de baixar mantido nos erros de PDF; `pdf.js` sem CDN e carregado só no leitor.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 4 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | ajuste | in_progress | Evidências manuais reader-themes-widths.png e reader-states-focus.png trocadas por automáticas reader-themes-widths.txt e reader-states-focus.txt geradas por apps/web/scripts/evidence-reader.mjs, com a prancha PNG como Artefato; harness da feature em src/features/reader/evidence/harness.tsx montando as rotas fora do layout sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 4 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
| 5 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 6 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 7 | 2026-10-31 | evidências | passed | 6 evidência(s) em evidence/TASK-29/ |
| 8 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler: decisoes-do-prototipo (PD-60), DEC-002 a DEC-004 e contrato de sessao e posicao da TASK-13; PD-60: oferta ao fechar com as paginas avancadas preenchidas e corrigiveis (22, de 40 a 62), POST com pages_read e read_on e intervalo so sem correcao; DEC-004: a retomada e gravada so pelo leitor no fechamento, confirmando ou nao a sessao; testes pd60 e dec004, evidencia reader-session-offer.txt, e2e, Concluida quando, Detalhes tecnicos e card |
| 2 | 2026-10-31 | agente | Linha da Baseline que conferia a pasta criada pela própria tarefa removida (recusada pela validação do vostok 0.2.3; defeito da issue 6) |
| 3 | 2026-10-31 | agente | Evidências manuais reader-themes-widths.png e reader-states-focus.png trocadas por automáticas reader-themes-widths.txt e reader-states-focus.txt geradas por apps/web/scripts/evidence-reader.mjs, com a prancha PNG como Artefato; harness da feature em src/features/reader/evidence/harness.tsx montando as rotas fora do layout sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 4 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
