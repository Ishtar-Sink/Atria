---
id: TASK-28
spec: SPEC-001
title: "Telas do Acervo"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-47, RF-48, RF-49, RF-50, RF-51, RF-52, RF-53, RF-64, CT-28, CT-29]
type: historia
labels: [SPEC-001, padrao]
status: approved
content_hash: 85c63eb138df6e3725c1cdd35a051e129b063c23dba765cf07432da9b2029124
adjustments: 3
adjusted_at: 2026-10-30T22:24:49Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 85c63eb138df6e3725c1cdd35a051e129b063c23dba765cf07432da9b2029124
attempts: 0
tests_result: null
regression_result: null
evidence_result: null
updated_at: 2026-10-30T22:24:49Z
---

# TASK-28: Telas do Acervo

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-47 a RF-53, RF-64, CT-28, CT-29, RN-14, RN-21, RN-22, RN-25, CB-05, CB-12, RNF-06, RNF-08 a RNF-10 e decisões 4, 29 a 31, 45 a 47 e 50.
- `vostok/rules/project/frontend.md`: estados de listagem, filtros na URL, cor determinística sem imagem, `Intl` e Optimistic UI.
- `vostok/rules/project/architecture.md`: [project/architecture-07], [project/architecture-10] e [project/architecture-12].
- `vostok/rules/project/code-style.md`: componentes sem regra de negócio, só tokens do tema.
- `vostok/rules/project/testing.md`: Vitest, Testing Library, axe e testes determinísticos.
- `vostok/rules/project/language.md`: textos em arquivo de tradução.
- `vostok/rules/project/naming-convention.md`: arquivos em `kebab-case`, chaves de objetos em `snake_case`.
- `vostok/rules/project/security.md`: [project/security-10] (upload) e [project/security-15].
- `prototype/atria-prototype.html`: estante, tela do livro, artigo e vídeo validados no protótipo.
- `docs/decisoes-do-prototipo.md`: linhas PD-09, PD-10, PD-11, PD-14, PD-19, PD-24, PD-35 a PD-40, PD-57, PD-59, PD-60, PD-61 e PD-62, e a seção "Decisões resolvidas em 30/10 (DEC-002)". As decisões valem sobre o texto antigo desta tarefa.
- `vostok/memory/decisions.md`: DEC-002 (as telas seguem as decisões do protótipo; a capa por upload de livro e artigo entra no MVP), DEC-003 e DEC-004 (a página de retomada muda só pelo modo leitura; a sessão não a altera), consultadas com `vostok memory search decision DEC-002 DEC-003 DEC-004 DEC-008`; DEC-008 (o diálogo de escolha do tipo ao criar e a preferência "Opções do botão de criar" ficam na base do frontend, TASK-05, e as telas importam de lá).
- `vostok/work/tasks/SPEC-001/TASK-13.md`: contrato do Acervo ajustado, consumido por esta tarefa: `GET|PUT|DELETE /books/{id}/cover` e `/articles/{id}/cover` (corpo cru, só PNG, JPEG ou WebP até 5 MiB; 415 `unsupported_file_type`, 413 `file_too_large`, 404 `cover_not_found`; `DELETE` responde 204), `PUT /videos/{id}/thumbnail`, sessão com `pages_read` e `read_on` obrigatórios e `from_page`/`to_page` opcionais, os filtros de listagem `cursor`, `limit`, `q`, `tag`, `visibility`, `reading_status` em livros (`want_to_read`, `reading`, `read`) e artigos (`to_read`, `reading`, `read`) e `watch_status` em vídeos (`to_watch`, `watching`, `watched`), e os campos `reading_status` do livro e `channel` (opcional, até 300 caracteres) e `watch_status` do vídeo (PD-35, PD-37).
- `apps/web/src/shared/url-state/use-list-search.ts`: visualização lembrada por módulo e por aba (PD-24), da TASK-05.
- `apps/web/src/shared/forms/form-fields.tsx`: `FormSelect`, `FormSegmented`, `FormDate` e `FormTags`, ligações dos campos de `@atria/ui` ao `react-hook-form` (PD-62), da TASK-05.
- `apps/web/src/shared/preferences/preferences-context.tsx`: preferência "Opções do botão de criar", `usePreferences().create_layout` (`'grid' | 'list'`, padrão `'grid'`, PD-10, DEC-008), lida pelo `CreateTypeDialog`; esta tarefa não a lê nem grava diretamente.
- `apps/web/src/shared/forms/create-type-dialog.tsx`: `CreateTypeDialog` da TASK-05 (DEC-008), com as props `types` (`{ id, label, description, icon, href }[]`), `focused_type`, `open` e `on_close`, em grade ou lista conforme `create_layout`.
- `apps/web/src/app`: só leitura, para ver o layout e como a TASK-35 registra `routes.tsx` e `nav.ts`.
- `apps/web/src/shared`: cliente da API, mutação otimista, formatação com `Intl`, i18n comum e tipo do item de navegação.
- `packages/ui`: componentes genéricos (página, abas, grade, lista, barra de progresso, formulário, `FormGrid` e `FormActions`, `SegmentedField`, `DateField`, `TagField`, `MenuButton`, `ViewSwitcher`, estados, diálogo de confirmação).
- `packages/theme`: tokens do tema claro e escuro.
- `packages/contracts`: tipos gerados de `/books`, `/books/{id}/cover`, `/books/{id}/reading-sessions`, `/books/{id}/book-notes`, `/articles`, `/articles/{id}/cover`, `/articles/{id}/article-notes`, `/videos`, `/videos/{id}/thumbnail` e `/files/{id}`.

### Mudar

- `apps/web/src/features/library/routes.tsx` (criar): rotas `/library` (com `tab=books|articles|videos` na URL, PD-35), `/library/books/new`, `/library/books/$bookId`, `/library/books/$bookId/edit`, `/library/books/$bookId/sessions/new`, `/library/books/$bookId/sessions/$sessionId/edit`, `/library/articles/new`, `/library/articles/$articleId`, `/library/articles/$articleId/edit`, `/library/videos/new`, `/library/videos/$videoId` e `/library/videos/$videoId/edit`, exportadas por `createLibraryRoutes(parent_route)`.
- `apps/web/src/features/library/nav.ts` (criar): item "Acervo" da sidebar, exportado como `libraryNavItem`.
- `apps/web/src/features/library/i18n/pt-br.json` (criar): textos da feature.
- `apps/web/src/features/library/shelf-page.tsx` (criar): estante com uma aba por tipo (Livros, Artigos e Vídeos, PD-35), filtro de status em chips em cada aba (`reading_status` em Livros e Artigos, `watch_status` em Vídeos, PD-35), busca, modos grade e lista lembrados por aba (PD-24), botão "Relatórios" do módulo (PD-61) e estados.
- `apps/web/src/features/library/library-item-cover.tsx` (criar): capa, miniatura ou gradiente determinístico derivado do id, em 2:3 no livro e 16:9 no artigo e no vídeo (PD-36, PD-38).
- `apps/web/src/features/library/cover-upload-field.tsx` (criar): área de capa para clicar ou arrastar uma imagem (só imagem, até 5 MB), com "Trocar" e "Remover" (PD-36).
- `apps/web/src/features/library/book-progress.tsx` (criar): barra de progresso do livro com rótulo acessível (RF-49).
- `apps/web/src/features/library/book-form-page.tsx` (criar): cadastro e edição do livro com capa por upload à esquerda e campos principais à direita, e PDF opcional (RF-47, RF-51, PD-36, PD-37).
- `apps/web/src/features/library/book-page.tsx` (criar): tela do livro com a visão geral em cartões (dados com a capa e o progresso, e "Registro" na lateral), abas de histórico de leitura e de notas, ler e baixar o PDF (RF-49, RF-50, RF-51, PD-14, PD-59).
- `apps/web/src/features/library/reading-session-form-page.tsx` (criar): registro e edição da sessão de leitura com páginas lidas, data e observação, sem página de início e de fim (RF-48, PD-60).
- `apps/web/src/features/library/reading-history-tab.tsx` (criar): histórico de leitura com "Registrar sessão" em cima e a lista embaixo, cada linha como "50 páginas · 26/10/2026", com editar e excluir cada registro (PD-40, PD-60).
- `apps/web/src/features/library/item-notes-tab.tsx` (criar): histórico de notas do livro, do artigo e do vídeo.
- `apps/web/src/features/library/article-form-page.tsx` (criar): cadastro e edição do artigo com capa por upload, status de leitura e PDF opcional (RF-52, RF-64, PD-36, PD-37).
- `apps/web/src/features/library/article-page.tsx` (criar): tela do artigo com a visão geral em cartões, status, histórico de notas, ler e baixar o PDF (PD-14, PD-59).
- `apps/web/src/features/library/video-form-page.tsx` (criar): cadastro e edição do vídeo com a miniatura à esquerda (envio manual em 16:9) e URL, título, canal e status à direita (RF-53, CB-12, PD-36, PD-37).
- `apps/web/src/features/library/video-page.tsx` (criar): tela do vídeo com a visão geral em cartões (miniatura, canal, status e endereço), e histórico de notas (PD-14, PD-37, PD-59).
- `apps/web/src/features/library/library-overview.tsx` (criar): cartões da visão geral dos detalhes, compartilhados pelas três telas: cartão de dados com a capa à esquerda dos campos e cartão "Registro" na lateral (PD-59).
- `apps/web/src/features/library/pdf-attachment-field.tsx` (criar): campo de anexo de PDF opcional, com tipo e tamanho checados.
- `apps/web/src/features/library/use-library-items.ts` (criar): leitura da estante com filtros, busca e cursor vindos da URL.
- `apps/web/src/features/library/use-book.ts` (criar): leitura do livro e das sessões.
- `apps/web/src/features/library/use-book-progress.ts` (criar): cálculo do progresso exibido, limitado a 100% (RN-14).
- `apps/web/src/features/library/use-reading-sessions.ts` (criar): criar, editar e excluir sessões com Optimistic UI.
- `apps/web/src/features/library/use-item-notes.ts` (criar): leitura e criação otimista das notas do item.
- `apps/web/src/features/library/use-library-mutations.ts` (criar): criar, editar e excluir livros, artigos e vídeos, anexar PDF e enviar, trocar e remover a capa (PD-36).
- `apps/web/src/features/library/shelf-page.test.tsx` (criar): testes da estante.
- `apps/web/src/features/library/cover-upload-field.test.tsx` (criar): testes da capa por upload (PD-36).
- `apps/web/src/features/library/reading-history-tab.test.tsx` (criar): testes do histórico de leitura (PD-40, PD-60).
- `apps/web/src/features/library/book-page.test.tsx` (criar): testes da tela do livro.
- `apps/web/src/features/library/book-form-page.test.tsx` (criar): testes do cadastro do livro.
- `apps/web/src/features/library/reading-session-form-page.test.tsx` (criar): testes do registro de páginas.
- `apps/web/src/features/library/use-book-progress.test.tsx` (criar): testes do progresso.
- `apps/web/src/features/library/article-form-page.test.tsx` (criar): testes do artigo.
- `apps/web/src/features/library/video-form-page.test.tsx` (criar): testes do vídeo, com o canal e o status (PD-37).
- `apps/web/src/features/library/video-page.test.tsx` (criar): testes da visão geral do vídeo com o canal e o status (PD-37, PD-59).
- `apps/web/src/features/library/library.e2e.ts` (criar): fluxos ponta a ponta do CT-28 e do CT-29, rodados só na TASK-35.

### Passos

1. Ler os arquivos de "Ler" e anotar os nomes exportados por `apps/web/src/shared`, `packages/ui` e `packages/contracts` (tipos dos livros, sessões, notas de item, artigos, vídeos, o envio de PDF e as rotas de capa do contexto `library`, conforme a TASK-13). Usar só esses tipos ([project/api-02]).
2. Criar `apps/web/src/features/library/i18n/pt-br.json` com chaves em `snake_case` sob `library`: `nav`, `shelf.*` (título, subtítulo, `tab_books`, `tab_articles` e `tab_videos` (PD-35), busca, `filters_label`, `search_label`, `view_label`, `status_all`, filtro por tag, modos grade e lista, `reports` e os itens `report_read_pages` e `report_lib_status` (PD-61), `empty_title`, `empty_text`, `loading`, `error`), `create.*` (`title`, `book`, `book_hint`, `article`, `article_hint`, `video`, `video_hint`, PD-09), `book.*` (campos, `progress_label`, `tab_overview`, `tab_reading_history`, `tab_notes`, `download_pdf`, `read_pdf`, `edit`, `more_actions`, `delete`, `report_read_pages`), `overview.*` (`record_title` "Registro", `tags`, `visibility`, `created_at`, `updated_at`, PD-59), `session.*` (`register` "Registrar sessão", `pages_read`, `read_on`, `observation`, `history_item` "{{pages}} páginas · {{date}}" com o singular "1 página", salvar, editar, excluir e confirmação, PD-40, PD-60), `book.status.*` (`want_to_read` "Quero ler", `reading` "Lendo", `read` "Lido"), `article.*` (campos e status `to_read` "Para ler", `reading` "Lendo", `read` "Lido"), `video.*` (URL, título, `channel` "Canal", miniatura, `thumbnail_manual_hint` e status `to_watch` "Para assistir", `watching` "Assistindo", `watched` "Assistido", PD-35, PD-37), `cover.*` (`drop_hint` "Clique ou arraste uma imagem", `choose`, `replace` "Trocar", `remove` "Remover", `invalid_type`, `too_large`, `alt`, PD-36), `notes.*`, `pdf.*` (`attach`, `replace`, `invalid_type`, `too_large`) e `undo_notice`. Os textos seguem o protótipo.
3. Escrever os testes antes do código, com o cliente da API simulado e o relógio fixo:
   - `use-book-progress.test.tsx`: `sums the registered pages over the total` (200 páginas, registros 25 e 30, resultado 27,5%), `caps the progress at 100 percent` (CB-05), `formats the percentage with Intl in the user locale`.
   - `reading-session-form-page.test.tsx`: `registers pages read with a note`, `pd60 registers only pages read and date without start and end pages` (o `POST /books/{id}/reading-sessions` leva `pages_read` e `read_on` escolhido no `DateField`, sem `from_page` nem `to_page`, e o formulário não tem campos de página de início e de fim), `pd60 rejects a session without pages read inside the form with role alert`, `edits a registered session`, `deletes a session with confirmation`, `rolls back and shows the undo notice when the server rejects` (RNF-09).
   - `reading-history-tab.test.tsx`: `pd40 shows the register session action above the list`, `pd60 lists each session as pages and date from the most recent` ("50 páginas · 26/10/2026" e "1 página · 25/10/2026", datas com `Intl`), `pd60 sums the sessions in the progress summary`, `shows the empty state with explanatory text`.
   - `cover-upload-field.test.tsx`: `pd36 uploads a cover by click and by drop` (`PUT /books/{id}/cover` com o corpo cru e o `Content-Type` do arquivo), `pd36 replaces and removes the cover` ("Trocar" envia de novo; "Remover" chama `DELETE /books/{id}/cover` e volta ao gradiente), `pd36 rejects a non image and a file over 5 MB inside the form with role alert`, `pd36 shows the server error for unsupported_file_type and file_too_large`, `pd36 uses 2 by 3 for books and 16 by 9 for articles and videos`, `is operable by keyboard only`, `has no axe violations`.
   - `book-form-page.test.tsx`: `creates a book with title, cover, author, publisher, pages and tags`, `pd37 places the cover on the left of the main fields and tags, notes and visibility below`, `pd11 turns tags into pills with Enter and comma`, `attaches an optional pdf`, `rejects a non pdf file inside the form with role alert`, `pd35 saves the book reading status` (`reading_status` no `FormSegmented`, padrão `want_to_read`), `has no axe violations`.
   - `book-page.test.tsx`: `shows the progress bar with an accessible label`, `pd59 shows the data card with the cover beside the fields and the Registro card on the side`, `pd14 keeps Ler beside Editar and Excluir inside Mais ações`, `pd61 opens the pages read report filtered by the book from Mais ações`, `shows reading history and notes in separate tabs`, `links to the reader and downloads the pdf when attached`, `hides read and download without pdf`, `adds a note to the book history`.
   - `article-form-page.test.tsx`: `creates an article with title, url, author, source, tags and reading status`, `pd36 uploads an article cover in 16 by 9`, `attaches an optional pdf`, `keeps the article without a progress bar` (RN-22).
   - `video-form-page.test.tsx`: `creates a video with url and shows the thumbnail on the shelf`, `allows a manual thumbnail when none is fetched` (CB-12), `pd37 places the thumbnail on the left and url, title, channel and status on the right`, `pd37 saves the channel and the watch status` (`watch_status` no `FormSegmented`, padrão `to_watch`; canal em branco não é enviado, mais de 300 caracteres mostra o erro em `role="alert"`).
   - `video-page.test.tsx`: `pd37 shows the channel, the watch status and the url in the data card` e `pd59 shows the Registro card on the side`.
   - `shelf-page.test.tsx`: `pd35 shows one tab per type books articles and videos`, `pd35 filters articles by reading status with chips` (`GET /articles?reading_status=reading`), `pd35 filters books by reading status with chips` (`GET /books?reading_status=want_to_read`), `pd35 filters videos by watch status with chips` (`GET /videos?watch_status=watching`), `pd35 keeps the status chip of each tab in the url`, `pd38 shows book covers in portrait columns of at least 170 px and articles and videos in landscape`, `pd38 uses a deterministic gradient from the id without cover`, `pd39 keeps the progress and status at the foot of the shelf card`, `pd24 remembers the view mode per tab`, `pd61 lists the library reports in the Relatórios menu`, `pd09 offers one card per type with icon and description` ("Novo" abre o `CreateTypeDialog` da base com Livro, Artigo e Vídeo, cada um com ícone e descrição), `pd09 focuses the type of the open tab` (na aba Artigos, o cartão Artigo vem focado), `pd09 opens the form of the chosen type without a type field` (escolher Vídeo leva a `/library/videos/new`, sem campo "Tipo"), `pd10 follows the grid or list preference` (com `create_layout` `list` no `PreferencesProvider`, o diálogo abre em lista), `pd09 has no axe violations with the type dialog open`, `exposes the Filtros, Busca and Visualização controls by accessible name`, `shows the book progress on the shelf`, `reads search, filters and view mode from the URL`, `shows the empty state with explanatory text`, `shows the loading state`, `shows the error state`, `has no axe violations`.
4. Rodar `pnpm --filter @atria/web test -- src/features/library` e confirmar que falham por falta da implementação.
5. Implementar os hooks: `use-library-items.ts` (uma consulta por aba: `GET /books`, `GET /articles` ou `GET /videos`, com `q`, `tag`, `cursor` e o status da aba (`reading_status` em Livros e Artigos, `watch_status` em Vídeos), lidos da URL (parâmetro `status`, descartado ao trocar de aba porque os valores são de cada tipo) pelo `use-list-search` de `apps/web/src/shared` com a visualização lembrada por aba, PD-24, PD-35), `use-book.ts`, `use-book-progress.ts` (soma de `pages_read` das sessões sobre o total, limitada a 1, formatada com `Intl.NumberFormat` em `percent` com até uma casa decimal), `use-reading-sessions.ts` (sessão com `pages_read`, `read_on` e `observation`; nunca envia `from_page` nem `to_page`, que são do modo leitura, e não grava a posição de leitura, DEC-004, PD-60), `use-item-notes.ts` e `use-library-mutations.ts` (capa por `PUT|DELETE /books/{id}/cover` e `/articles/{id}/cover` e miniatura por `PUT /videos/{id}/thumbnail`, com o arquivo no corpo cru e o `Content-Type` dele; ao criar, primeiro o `POST` do item e depois a capa e o PDF, PD-36), todos com o hook de mutação otimista de `apps/web/src/shared` nas mutações.
6. Implementar `library-item-cover.tsx` (imagem por `/api/v1/files/{cover_file_id}` ou `{thumbnail_file_id}` com `alt` do título, ou gradiente determinístico derivado do id pelo utilitário de cor de `apps/web/src/shared` ou de `packages/ui`, [project/frontend-11]; proporção 2:3 no livro e 16:9 no artigo e no vídeo, PD-36, PD-38) e `book-progress.tsx` (barra de `packages/ui` com `role="progressbar"`, `aria-valuenow` e rótulo).
7. Implementar `pdf-attachment-field.tsx`: aceita só `application/pdf`, mostra o erro no formulário com `role="alert"` e permite trocar ou remover o anexo. O PDF é baixado só por `/api/v1/files/{id}` ([project/security-10], RN-25), nunca por URL externa.
8. Implementar `cover-upload-field.tsx` (PD-36): área com a prévia na proporção do tipo (2:3 ou 16:9), que aceita clique (um `<button>` "Escolher imagem" que abre o `<input type="file" accept="image/png,image/jpeg,image/webp">` oculto) e arrastar e soltar; confere no cliente o tipo de imagem e o limite de 5 MB antes de enviar e mostra o erro no formulário com `role="alert"`; os erros `unsupported_file_type` e `file_too_large` do servidor viram as mensagens `cover.invalid_type` e `cover.too_large`; com capa, mostra "Trocar" e "Remover". Na miniatura do vídeo, só "Trocar", porque a TASK-13 não tem rota para remover a miniatura. O servidor não recorta: a prévia usa `object-fit: cover` na proporção do tipo.
9. Montar o diálogo de tipo com o `CreateTypeDialog` de `apps/web/src/shared/forms/create-type-dialog.tsx` (TASK-05, PD-09, PD-10, DEC-008): a constante `LIBRARY_CREATE_TYPES` em `shelf-page.tsx`, passada a `types`, com `book` Livro (`/library/books/new`), `article` Artigo (`/library/articles/new`) e `video` Vídeo (`/library/videos/new`), cada um com `label` e `description` do i18n (`create.*`) e o ícone SVG inline `aria-hidden="true"`; `focused_type` é o tipo da aba aberta (Livros: `book`; Artigos: `article`; Vídeos: `video`). A grade ou a lista vem da preferência `create_layout`, lida pelo próprio componente; foco, Esc e a volta do foco a "Novo" são do componente da base. A feature não tem diálogo próprio. Os formulários não têm o campo "Tipo".
10. Implementar os formulários em rota própria com `react-hook-form`, `zod`, `FormGrid`, `FormActions` e as ligações de `apps/web/src/shared/forms/form-fields.tsx` (PD-19, PD-62): `book-form-page.tsx` e `article-form-page.tsx` com a capa (`cover-upload-field.tsx`) à esquerda e os campos principais à direita (título, autoria, páginas e status de leitura no livro, status e endereço no artigo), e etiquetas (`FormTags`, PD-11), observações e visibilidade (`FormSegmented`) embaixo (PD-37); o status de leitura do livro (`reading_status`, padrão `want_to_read`) e do artigo (`to_read`) em `FormSegmented` (3 opções obrigatórias, PD-62), o artigo sem barra de progresso; `video-form-page.tsx` com a miniatura à esquerda (buscada pelo servidor; sem ela, envio manual com a dica `thumbnail_manual_hint`) e, à direita, URL, título, canal (`TextField`, opcional, até 300 caracteres validados por `zod`, em branco não enviado) e status (`watch_status` em `FormSegmented`, padrão `to_watch`), com etiquetas, observações e visibilidade embaixo (PD-37); e `reading-session-form-page.tsx` com páginas lidas (inteiro maior que zero), data (`FormDate`, calendário próprio, PD-57, padrão hoje no fuso da pessoa) e observação, sem página de início e de fim (PD-60).
11. Implementar `library-overview.tsx` e as telas (PD-59): zona principal com o cartão de dados na mesma estrutura do formulário (PD-37): a capa à esquerda e os campos principais à direita (no livro, autoria, páginas, o status de leitura e a barra de progresso com "50 de 200 páginas"; no artigo, autoria, fonte, status e endereço; no vídeo, a miniatura, o canal ("—" sem canal), o status e o endereço) e o cartão de texto longo quando houver; lateral com o cartão "Registro" (etiquetas, visibilidade, criado e atualizado em). `book-page.tsx` com as abas Visão geral, Histórico de leitura (`reading-history-tab.tsx`) e Notas (`item-notes-tab.tsx`); no cabeçalho, "Ler" para `/library/books/{id}/read` (com PDF) ao lado de "Editar" com ícone de lápis, e o `MenuButton` "Mais ações" com "Baixar PDF" (com PDF), "Relatório de páginas lidas" para `/reports/read-pages?book_id={id}` (PD-61) e "Excluir" em vermelho (PD-14). `reading-history-tab.tsx` com o link "Registrar sessão" para `/library/books/{id}/sessions/new` em cima e a lista embaixo, da data mais recente para a mais antiga, cada linha "50 páginas · 26/10/2026" (PD-40, PD-60). `article-page.tsx` (mesmo cabeçalho, "Ler" para `/library/articles/{id}/read`), `video-page.tsx` e `shelf-page.tsx`: cabeçalho com "Novo" (abre o `CreateTypeDialog` da base com `LIBRARY_CREATE_TYPES`, passo 9) e "Relatórios" (`MenuButton` com "Páginas lidas" para `/reports/read-pages` e "Acervo por status" para `/reports/lib-status`, PD-61); abas Livros, Artigos e Vídeos na URL (`tab`); em cada aba, filtro de status em chips (botões alternáveis com `aria-pressed`, PD-13, PD-35): Livros "Todos · Quero ler · Lendo · Lido" (`reading_status`), Artigos "Todos · Para ler · Lendo · Lido" (`reading_status`) e Vídeos "Todos · Para assistir · Assistindo · Assistido" (`watch_status`); o status também aparece no pé de cada cartão; busca e modos na URL; estante de livros em colunas de pelo menos 170 px com a capa em retrato, e artigos e vídeos com a faixa deitada (PD-38); no cartão, a barra de progresso e o status no pé, alinhados entre cartões de alturas diferentes (PD-39); cartão inteiro clicável pelo título (PD-07); estados vazio, carregando e erro. Os três controles da listagem têm os nomes acessíveis exatos "Filtros", "Busca" e "Visualização" (`aria-label` ou rótulo vindo das chaves `filters_label`, `search_label` e `view_label` da tradução), usados pelos e2e da TASK-35. As telas do livro e do artigo recebem a lista de abas extras por propriedade `extra_tabs`, para a TASK-35 montar as abas Conexões e Destaques sem esta feature importar outras.
12. Criar `routes.tsx` com `createLibraryRoutes(parent_route)` (sem as rotas `/read`, que são da feature `reader`) e `nav.ts` com `libraryNavItem` (destino `/library`, ícone SVG inline com `aria-hidden="true"`).
13. Criar `library.e2e.ts` (Playwright) com o CT-28 (livro de 200 páginas criado pelo diálogo de tipo, com capa enviada, registros de 20 e 30 páginas com data, edição do primeiro para 25, progresso 27,5% na estante e na tela, histórico com "25 páginas · <data>", PDF anexado e baixado, nota no histórico) e o CT-29 (artigo com status e nota, vídeo do YouTube com miniatura na vitrine), em 360 px e desktop, com axe. Não rodar: ele roda na TASK-35.
14. Rodar a Verificação até passar sem nenhum warning de lint.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
pnpm --filter @atria/web test -- src/features/library
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
test -f apps/web/src/features/library/library.e2e.ts
# Diálogo de tipo da base, sem cópia local (PD-09, DEC-008)
test ! -e apps/web/src/features/library/create-item-dialog.tsx
test ! -e apps/web/src/features/library/create-item-dialog.test.tsx
! grep -rnE "create-item-dialog|CreateItemDialog" apps/web/src/features/library
grep -q 'CreateTypeDialog' apps/web/src/features/library/shelf-page.tsx
```

### Evidências

- `library-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/library`
  - Prova: os testes de componente e de hook do Acervo passam, cobrindo livros, sessões, progresso, históricos, PDF, artigos, vídeos, estados, axe e interface otimista (RF-47 a RF-53, RF-64, CT-28, CT-29, RNF-06, RNF-09).
  - Trecho: os arquivos `use-book-progress.test.tsx`, `reading-session-form-page.test.tsx`, `book-page.test.tsx`, `article-form-page.test.tsx`, `video-form-page.test.tsx` e `shelf-page.test.tsx` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `library-prototype-decisions.txt` (automática): `pnpm --filter @atria/web test -- src/features/library -t pd`
  - Prova: as decisões do protótipo do Acervo estão nas telas: abas por tipo com status em chips em cada aba, livros e vídeos inclusive (PD-35), capa por upload com trocar e remover (PD-36), formulário com a capa à esquerda (PD-37), estante em retrato com o pé alinhado (PD-38, PD-39), "Registrar sessão" em cima (PD-40), visão geral em cartões (PD-59), sessão só com páginas e data (PD-60), diálogo de tipo (PD-09, PD-10), "Mais ações" (PD-14), relatórios (PD-61) e visualização por aba (PD-24) (DEC-002, DEC-004).
  - Trecho: os casos `pd35 shows one tab per type books articles and videos`, `pd35 filters books by reading status with chips`, `pd35 filters videos by watch status with chips`, `pd37 saves the channel and the watch status`, `pd37 shows the channel, the watch status and the url in the data card`, `pd36 replaces and removes the cover`, `pd40 shows the register session action above the list`, `pd59 shows the data card with the cover beside the fields and the Registro card on the side` e `pd60 registers only pages read and date without start and end pages` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests`, `No test files found` ou nenhum caso `pd` executado.
- `library-files.txt` (automática): `find apps/web/src/features/library -type f | sort`
  - Prova: a feature tem rotas, item de menu, traduções, telas, hooks, testes e o e2e dos CT-28 e CT-29.
  - Trecho: `routes.tsx`, `nav.ts`, `i18n/pt-br.json`, `cover-upload-field.tsx` e `library.e2e.ts` na lista, e nenhum `create-item-dialog.tsx`.
  - Falha: `No such file or directory`, algum desses arquivos ausente ou `create-item-dialog.tsx` na lista.
- `library-themes-widths.png` (manual): prints da estante (abas Livros e Artigos), da tela do livro com a visão geral em cartões e do formulário do livro com a capa nos temas claro e escuro, em 360 px e em desktop, capturados no app local (`pnpm --filter @atria/web dev`) com as rotas da feature registradas só na cópia de trabalho, sem manter a alteração em `apps/web/src/app`.
  - Prova: identidade visual nos dois temas, capas em 2:3 e 16:9, gradientes determinísticos, estante em retrato com o pé alinhado, visão geral em cartões e layout funcional a partir de 360 px (RNF-08, RNF-10, PD-35 a PD-39, PD-59).
  - Trecho: as capturas com a barra de progresso e o status no pé dos cartões, o cartão "Registro" na lateral, a capa à esquerda dos campos no formulário e nenhuma rolagem horizontal.
  - Falha: grade quebrada em 360 px, capa fora da proporção, imagem sem cor de fundo, pé desalinhado ou contraste baixo no tema escuro.
- `library-states-focus.png` (manual): prints da estante nos estados vazio, carregando e erro, da tela do livro com o foco visível navegando pelas abas só com o teclado, do diálogo de tipo com o cartão da aba focado e da área de capa com o erro de arquivo inválido.
  - Prova: todos os estados da tela, o foco por teclado, o diálogo de tipo e o erro da capa ([project/frontend-10], [project/frontend-12], RNF-06, PD-09, PD-36).
  - Trecho: o texto explicativo do estado vazio, o indicador de carregamento, a mensagem de erro, o anel de foco na aba ativa e no cartão do tipo, e a mensagem de imagem inválida na área de capa.
  - Falha: estado sem texto, foco invisível, aba ou cartão que não recebe foco, ou erro da capa fora do formulário.

### Concluída quando

- [ ] Livros são cadastrados com título, capa, autor, editora, páginas, tags e PDF opcional (RF-47, RF-51, CT-28).

  > Como comprovar: na saída `library-tests.txt`, ver aprovados `creates a book with title, cover, author, publisher, pages and tags` e `attaches an optional pdf`.

- [ ] As páginas lidas são registradas por sessão, só com a quantidade de páginas, a data e a observação, sem página de início e de fim, e cada registro pode ser editado ou excluído; a sessão não muda a página de retomada (RF-48, CT-28, PD-60, DEC-004).

  > Como comprovar: ver aprovados os casos da `reading-session-form-page.test.tsx` na saída `library-tests.txt`, entre eles `pd60 registers only pages read and date without start and end pages`.

- [ ] O histórico de leitura tem "Registrar sessão" em cima e a lista embaixo, cada linha como "50 páginas · 26/10/2026" (PD-40, PD-60).

  > Como comprovar: em `library-prototype-decisions.txt`, ver aprovados `pd40 shows the register session action above the list` e `pd60 lists each session as pages and date from the most recent`.

- [ ] A capa do livro (2:3) e a do artigo (16:9) são enviadas clicando ou arrastando, só imagem até 5 MB, com "Trocar" e "Remover", pelas rotas de capa da TASK-13 (PD-36, DEC-002).

  > Como comprovar: em `library-prototype-decisions.txt`, ver aprovados os casos `pd36` da `cover-upload-field.test.tsx` e `pd36 uploads an article cover in 16 by 9`.

- [ ] O Acervo tem uma aba por tipo, com o status em chips em cada aba (Livros e Artigos por `reading_status`, Vídeos por `watch_status`), a estante de livros em retrato com o pé alinhado e a visualização lembrada por aba (PD-24, PD-35, PD-38, PD-39).

  > Como comprovar: em `library-prototype-decisions.txt`, ver aprovados os casos `pd35`, `pd38`, `pd39` e `pd24` da `shelf-page.test.tsx`, inclusive `pd35 filters books by reading status with chips` e `pd35 filters videos by watch status with chips`.

- [ ] O livro tem o status de leitura e o vídeo tem o canal e o status, no formulário (status em grupo segmentado) e na visão geral, na mesma estrutura do protótipo (PD-35, PD-37, PD-62).

  > Como comprovar: em `library-prototype-decisions.txt`, ver aprovados `pd35 saves the book reading status`, `pd37 places the thumbnail on the left and url, title, channel and status on the right`, `pd37 saves the channel and the watch status` e `pd37 shows the channel, the watch status and the url in the data card`.

- [ ] "Novo" abre o `CreateTypeDialog` da base com Livro, Artigo e Vídeo, o tipo da aba focado e a disposição da preferência, sem diálogo próprio na feature (PD-09, PD-10, DEC-008).

  > Como comprovar: em `library-prototype-decisions.txt`, ver aprovados `pd09 offers one card per type with icon and description`, `pd09 focuses the type of the open tab`, `pd09 opens the form of the chosen type without a type field` e `pd10 follows the grid or list preference`; a Verificação não acha `create-item-dialog` na feature e acha `CreateTypeDialog` em `shelf-page.tsx`.

- [ ] Criar abre o diálogo de tipo, e os formulários e as visões gerais seguem o protótipo: capa à esquerda, "Registro" na lateral, "Ler" ao lado de "Editar" e "Excluir" em "Mais ações", com os relatórios do módulo e do livro (PD-09, PD-10, PD-14, PD-37, PD-59, PD-61).

  > Como comprovar: em `library-prototype-decisions.txt`, ver aprovados os casos `pd09`, `pd10`, `pd14`, `pd37`, `pd59` e `pd61`.

- [ ] O progresso aparece na estante e na tela do livro, com 27,5% no exemplo do CT-28 e limite de 100% (RF-49, CT-28).

  > Como comprovar: ver aprovados `sums the registered pages over the total`, `caps the progress at 100 percent` e `shows the book progress on the shelf`.

- [ ] Os históricos de leitura e de notas ficam em abas separadas, e o PDF anexado baixa (RF-50, RF-51, CT-28).

  > Como comprovar: ver aprovados `shows reading history and notes in separate tabs` e `links to the reader and downloads the pdf when attached`.

- [ ] Artigos têm status de leitura, notas em histórico e PDF opcional, sem barra de progresso (RF-52, RF-64, CT-29).

  > Como comprovar: ver aprovados os casos da `article-form-page.test.tsx` na saída `library-tests.txt`.

- [ ] Vídeos mostram a miniatura na vitrine e aceitam envio manual quando ela não é buscada (RF-53, CT-29).

  > Como comprovar: ver aprovados `creates a video with url and shows the thumbnail on the shelf` e `allows a manual thumbnail when none is fetched`.

- [ ] A estante tem busca, filtros e modos na URL e os estados vazio, carregando e erro; as mudanças são otimistas e desfeitas com aviso na recusa (RNF-09).

  > Como comprovar: ver aprovados os casos da `shelf-page.test.tsx` e `rolls back and shows the undo notice when the server rejects`, e os estados no print `library-states-focus.png`.

- [ ] As telas não têm violações no axe, funcionam só pelo teclado e nos dois temas, a partir de 360 px (RNF-06, RNF-08, RNF-10).

  > Como comprovar: ver aprovados os casos `has no axe violations` e conferir os prints `library-themes-widths.png` e `library-states-focus.png`.

- [ ] Testes, typecheck e lint passam sem warning, e o e2e dos CT-28 e CT-29 está escrito para a TASK-35.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; `library.e2e.ts` aparece em `library-files.txt`.

## Descrição

### Resumo executivo

Entrega as telas do Acervo como no protótipo: uma aba por tipo (livros, artigos e vídeos), capas enviadas pela pessoa, o progresso de leitura pelas sessões de páginas e data, os históricos de leitura e de notas e o anexo opcional de PDF.
Dá à pessoa uma visão calma do que está lendo e do quanto já leu, com resposta imediata na tela.
Perfil padrão, risco baixo: as decisões estão tomadas e o servidor do Acervo já existe.
Libera a integração do frontend e serve de porta de entrada para o modo leitura.

### Detalhes técnicos

- **Abordagem:** feature React em `apps/web/src/features/library`, com rotas próprias para estante, livros, sessões de leitura, artigos e vídeos, TanStack Query nos dados e `react-hook-form` com `zod` nos formulários. A lógica (progresso, filtros na URL, mutações otimistas) fica nos hooks.
- **Componentes:** estante com abas por tipo, diálogo de tipo, capa ou gradiente determinístico, área de capa por upload, cartões da visão geral, barra de progresso, formulários de livro, artigo, vídeo e sessão, abas de histórico de leitura e de notas, campo de PDF; usa `@atria/ui`, `@atria/theme`, `@atria/contracts` e `apps/web/src/shared`.
- **Decisões:** o progresso exibido é calculado no hook com o limite de 100% (RN-14), para a estante e a tela mostrarem o mesmo valor; descartado repetir a conta em cada componente. As telas do livro e do artigo recebem abas extras por propriedade (`extra_tabs`), para a TASK-35 montar Conexões e Destaques (esta da feature `reader`, TASK-29); descartado importar a feature `reader` aqui, que criaria dependência entre tarefas da mesma onda. O registro de sessão tem rota própria ([project/architecture-10]); descartado o formulário em modal. Os botões "Ler" levam às rotas `/library/books/{id}/read` e `/library/articles/{id}/read`, definidas pela TASK-29. O PDF é baixado só por `/files/{id}` com autorização do servidor (RN-25, decisão 50).
- **Decisões do protótipo (DEC-002):** uma aba por tipo, com o status em chips em cada aba, pelos filtros da TASK-13 (`reading_status` em livros e artigos, `watch_status` em vídeos), com o parâmetro `status` da URL descartado ao trocar de aba porque os valores são de cada tipo (PD-35); o livro ganha o status de leitura e o vídeo o canal e o status no formulário, em grupo segmentado (3 opções obrigatórias, PD-62), e na visão geral (PD-37), como a TASK-13 agora expõe; descartado o status só nos artigos, que a versão anterior desta tarefa previa por falta de suporte no servidor; descartada a listagem única com filtro de tipo. Capa por upload no livro (2:3) e no artigo (16:9) pelas rotas `GET|PUT|DELETE /books/{id}/cover` e `/articles/{id}/cover` da TASK-13, com corpo cru, e a miniatura do vídeo por `PUT /videos/{id}/thumbnail`, só com "Trocar" porque não há rota para removê-la (PD-36); a checagem de tipo e tamanho no cliente só antecipa a do servidor, que continua valendo. O componente da capa fica na feature, porque depende das rotas do Acervo; descartado `packages/ui`, que não tem regra de contrato ([project/architecture-08]). Formulário e visão geral com a capa à esquerda (PD-37, PD-59), em cartões compartilhados por `library-overview.tsx`; descartada uma visão geral por tela. Sessão só com `pages_read`, `read_on` e observação (PD-60); `from_page` e `to_page` ficam para o modo leitura (TASK-29), e a sessão nunca grava a posição de leitura (DEC-004). "Registrar sessão" é um link em cima do histórico para a rota do formulário (PD-40), descartado o formulário dentro da aba, que contrariaria [project/architecture-10]. Diálogo de tipo ao criar (PD-09) pelo `CreateTypeDialog` da base (TASK-05, DEC-008), com Livro, Artigo e Vídeo e o tipo da aba focado, e a disposição da preferência `create_layout` (PD-10), lida pelo componente; descartados o campo "Tipo" no formulário e um `create-item-dialog.tsx` próprio, que a DEC-008 troca pelo componente da base, também usado pelo Financeiro (TASK-22). Relatórios pelo menu "Relatórios" do módulo e pelo "Mais ações" do livro, com as rotas `/reports/read-pages` e `/reports/lib-status` e o filtro `book_id` na URL, os mesmos ids e nomes de filtro da TASK-17 (PD-61).
- **Riscos:** miniatura do vídeo indisponível sem internet (CB-12, mitigado com envio manual); arredondamento do progresso (mitigado com `Intl.NumberFormat` e teste do 27,5%).
- **Referências da spec:** RF-47 a RF-53, RF-64, CT-28, CT-29, RN-14, RN-21, RN-22, RN-25, CB-05, CB-12, RNF-06, RNF-08 a RNF-10, decisões 4, 29 a 31, 45 a 47 e 50; PD-07, PD-09 a PD-11, PD-13, PD-14, PD-19, PD-24, PD-35 a PD-40, PD-57, PD-59 a PD-62 de `docs/decisoes-do-prototipo.md`; DEC-002 a DEC-004 e DEC-008 da memória; contrato do Acervo da TASK-13.
- **Arquivos em comum na onda 7:** nenhum. O `CreateTypeDialog` e a preferência `create_layout` vêm da base (TASK-05) e são só importados, também pela TASK-22 (diálogo) e pela TASK-33 (preferência).

### Card

- **Título:** Telas do Acervo
- **Tipo:** historia
- **Descrição:** Telas do Acervo com uma aba por tipo, capas por upload, o progresso pelas sessões de páginas e data, os históricos de leitura e de notas, a visão geral em cartões e o anexo opcional de PDF, como no protótipo.
- **Critérios de aceite:**
  - [ ] Livros com capa, páginas, tags, PDF opcional e progresso de 27,5% no exemplo do CT-28.
  - [ ] Sessões de leitura só com páginas, data e observação, editáveis e excluíveis, com "Registrar sessão" em cima e históricos em abas separadas.
  - [ ] Capa por upload no livro (2:3) e no artigo (16:9), com trocar e remover, só imagem até 5 MB.
  - [ ] Uma aba por tipo, com o status em chips em Livros, Artigos e Vídeos, estante em retrato com o pé alinhado e visão geral em cartões.
  - [ ] Livros com status de leitura; artigos com status, notas e PDF opcional; vídeos com canal, status e miniatura ou envio manual, no formulário e na visão geral.
  - [ ] "Novo" abre o diálogo de tipo da base com Livro, Artigo e Vídeo, o tipo da aba focado e a grade ou lista da preferência, sem diálogo próprio.
  - [ ] Estante com busca, filtros e visualização na URL, estados, interface otimista e sem violações no axe.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler: decisoes-do-prototipo, DEC-002 a DEC-004 e contrato da TASK-13; PD-35: uma aba por tipo, status em chips na aba Artigos (reading_status); PD-36: capa por upload com trocar e remover pelas rotas de capa da TASK-13, 2:3 no livro e 16:9 no artigo e no video; PD-37 e PD-59: capa a esquerda no formulario e visao geral em cartoes com Registro na lateral; PD-38 e PD-39: estante em retrato com pe alinhado e gradiente do id; PD-40: Registrar sessao em cima da lista; PD-60 e DEC-004: sessao so com paginas, data e observacao, sem alterar a retomada; PD-09, PD-10, PD-11, PD-14, PD-24, PD-57, PD-61 e PD-62 aplicados; testes pd novos, evidencia library-prototype-decisions.txt, Concluida quando, Detalhes tecnicos e card |
| 2 | 2026-10-30 | agente | Ler com os filtros reading_status de livros e artigos, watch_status de vídeos e os campos reading_status do livro e channel e watch_status do vídeo da TASK-13; status em chips nas abas Livros (Quero ler, Lendo, Lido) e Vídeos (Para assistir, Assistindo, Assistido), além de Artigos, com o parâmetro status da URL por aba (PD-35); status de leitura do livro no formulário em FormSegmented e na visão geral (PD-35, PD-62); canal e status do vídeo no formulário, à direita da miniatura, e na visão geral, com video-page.test.tsx em Mudar (PD-37); linha de Baseline que citava a pasta criada pela tarefa removida; testes, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 3 | 2026-10-30 | agente | DEC-008: create-item-dialog.tsx e create-item-dialog.test.tsx removidos de Mudar; passo 9 monta o CreateTypeDialog da base com LIBRARY_CREATE_TYPES (Livro, Artigo, Vídeo) e o tipo da aba em focused_type, aberto por Novo na estante; testes pd09 e pd10 do diálogo mantidos em shelf-page.test.tsx, com o axe do diálogo aberto; Ler com create-type-dialog.tsx e create_layout da TASK-05 e DEC-008; Verificação com grep que rejeita create-item-dialog e exige CreateTypeDialog em shelf-page.tsx; Evidências, Concluída quando, Detalhes técnicos e card atualizados |
