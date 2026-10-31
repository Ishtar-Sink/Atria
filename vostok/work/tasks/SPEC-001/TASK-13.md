---
id: TASK-13
spec: SPEC-001
title: "Contexto library"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-47, RF-48, RF-49, RF-50, RF-51, RF-52, RF-53, RF-64, RF-66, RF-67, RF-68, RF-69, RF-70, CT-28, CT-29, CT-35, CT-36, CT-37, CT-38]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: bd7533439d900566f7099cba5780fdeb7432838747451a2b8ea50071e5df93fe
adjustments: 3
adjusted_at: 2026-10-30T21:38:42Z
approved_at: 2026-10-30T14:38:10Z
approved_hash: 514bb12c716fb27cb22164d0c87057b7ed24f78557852c19af2b9fba72cd74a9
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: sonnet
updated_at: 2026-10-30T21:38:42Z
---

# TASK-13: Contexto library

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-47 a RF-53, RF-64, RF-66 a RF-70, RN-14, RN-21 a RN-25, CB-05, CB-06, CB-12, CB-16 a CB-20, CT-28, CT-29, CT-35 a CT-38, contratos de `/books`, `/articles`, `/videos`, `/files/{id}`, `reading-position`, `highlights` e o JSON do destaque, decisões 4, 29, 30, 44 a 51 e 53 a 56.
- `vostok/rules/project/architecture.md`
- `vostok/rules/project/security.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/api.md`
- `vostok/rules/project/stack.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `apps/server/Cargo.toml`: dependências já declaradas pela TASK-04; esta tarefa usa `reqwest` (cliente HTTP com rustls, para o oEmbed) e `sha2` (hash do arquivo), pré-condições da TASK-04. Não alterar.
- `apps/server/src/main.rs`: como os módulos dos contextos são declarados (só leitura; não alterar).
- `apps/server/src/shared/mod.rs`: erro `problem+json`, UUID v7, relógio injetável, visibilidade e paginação por cursor opaco base64url (chave de ordenação + id) da TASK-04.
- `apps/server/src/http/mod.rs`: `AppState`, extrator do usuário autenticado, cabeçalhos de segurança e auxiliar de testes de `apps/server/src/http` da TASK-04, que monta o app com sessão e CSRF e cria sessões de usuários de teste (só leitura; não alterar).
- `apps/server/src/storage/mod.rs`: interface de armazenamento de arquivos (gravar, ler e remover por chave) e o adaptador local da TASK-04.
- `vostok/work/tasks/SPEC-001/TASK-15.md`: contrato do gancho `EntityDeletedHook` (CB-06).
- `vostok/memory/decisions.md`: DEC-002 (o servidor segue as decisões do protótipo; a PD-36 entra no MVP), consultada com `vostok memory search decision DEC-002`.
- `docs/decisoes-do-prototipo.md`: linhas PD-35 (abas por tipo, com filtro por status), PD-36 (capa por upload no livro e no artigo), PD-37 (campos do formulário, inclusive status e canal) e PD-60 (sessão de leitura com páginas e data).
- `prototype/atria-prototype.html`: rótulos `L.book` (Quero ler, Lendo, Lido) e `L.vid` (`to_watch` Para assistir, `watching` Assistindo, `watched` Assistido) e o campo `channel` (Canal) do vídeo, referência de PD-35 e PD-37.
- `apps/server/src/library/`: código parcial já escrito nesta tarefa; mantenha-o e acrescente só o que falta.

### Mudar

- `apps/server/src/library/mod.rs` (criar): declara as camadas e expõe `router()`, `migrator()`, `openapi()` e o `LibrarySearch` para a busca.
- `apps/server/src/library/domain/mod.rs` (criar): módulo do domínio.
- `apps/server/src/library/domain/book.rs` (criar): `Book`, `BookStatus` (`want_to_read`, `reading`, `read`, PD-35) e o cálculo do progresso (RN-14, CB-05), com testes unitários.
- `apps/server/src/library/domain/article.rs` (criar): `Article` com `cover_file_id` opcional (PD-36) e `ReadingStatus` (RN-22), com testes unitários.
- `apps/server/src/library/domain/video.rs` (criar): `Video` com `channel` opcional (PD-37) e `VideoStatus` (`to_watch`, `watching`, `watched`, PD-35), e os provedores oEmbed permitidos, com testes unitários.
- `apps/server/src/library/domain/reading_session.rs` (criar): `ReadingSession` com páginas lidas e data obrigatórias e intervalo opcional para o modo leitura retomar (PD-60), com testes unitários.
- `apps/server/src/library/domain/item_note.rs` (criar): `ItemNote` com trecho, página e comentário (RN-21, RN-24, CB-20), com testes unitários.
- `apps/server/src/library/domain/highlight.rs` (criar): `Highlight` com cor, retângulos e arquivo de origem (CB-19), com testes unitários.
- `apps/server/src/library/domain/library_file.rs` (criar): tipos de arquivo, detecção pelo conteúdo e limites de tamanho, com testes unitários.
- `apps/server/src/library/domain/error.rs` (criar): `LibraryError` tipado com `thiserror`.
- `apps/server/src/library/application/mod.rs` (criar): módulo da aplicação e `ListQuery`, com os filtros de status de livro e de vídeo (PD-35).
- `apps/server/src/library/application/ports.rs` (criar): traits dos repositórios, `ListFilter` com os filtros de status de livro e de vídeo (PD-35), `ThumbnailFetcher` e alias `EntityDeletedHook`.
- `apps/server/src/library/application/books.rs` (criar): casos de uso de livros, sessões, notas, posição, destaques, capa (enviar, trocar, ler e remover, PD-36) e PDF.
- `apps/server/src/library/application/articles.rs` (criar): casos de uso de artigos, notas, posição, destaques, capa (enviar, trocar, ler e remover, PD-36) e PDF.
- `apps/server/src/library/application/videos.rs` (criar): casos de uso de vídeos, miniatura e notas.
- `apps/server/src/library/application/files.rs` (criar): leitura de arquivo só pelo dono (RN-25).
- `apps/server/src/library/application/search.rs` (criar): `LibrarySearch` sobre o `tsvector` para a TASK-16.
- `apps/server/src/library/infrastructure/mod.rs` (criar): módulo da infraestrutura.
- `apps/server/src/library/infrastructure/pg_books.rs` (criar): repositório PostgreSQL de livros e sessões, com `reading_status` e o filtro por ele (PD-35).
- `apps/server/src/library/infrastructure/pg_articles.rs` (criar): repositório PostgreSQL de artigos, com `cover_file_id`.
- `apps/server/src/library/infrastructure/pg_videos.rs` (criar): repositório PostgreSQL de vídeos, com `channel`, `watch_status` e o filtro por status (PD-35, PD-37).
- `apps/server/src/library/infrastructure/pg_item_notes.rs` (criar): repositório PostgreSQL das notas de item e dos destaques.
- `apps/server/src/library/infrastructure/pg_files.rs` (criar): metadados dos arquivos em PostgreSQL e conteúdo pelo storage.
- `apps/server/src/library/infrastructure/oembed_thumbnail_fetcher.rs` (criar): busca da miniatura por oEmbed, com tempo limite e lista de provedores.
- `apps/server/src/library/interface/mod.rs` (criar): montagem do `router()`, com o limite de corpo nas rotas de envio, e `list_query`.
- `apps/server/src/library/interface/dto.rs` (criar): corpos de requisição e resposta com `utoipa::ToSchema`.
- `apps/server/src/library/interface/books.rs` (criar): handlers de `/books`, inclusive `GET|PUT|DELETE /books/{id}/cover` e o filtro `?reading_status=` da listagem (PD-35).
- `apps/server/src/library/interface/articles.rs` (criar): handlers de `/articles`, inclusive `GET|PUT|DELETE /articles/{id}/cover`.
- `apps/server/src/library/interface/videos.rs` (criar): handlers de `/videos`, com o filtro `?watch_status=` da listagem (PD-35).
- `apps/server/src/library/interface/files.rs` (criar): handler de `/files/{id}`.
- `apps/server/src/library/interface/openapi.rs` (criar): `LibraryApi` (`utoipa::OpenApi`) do contexto, com os esquemas `BookStatus` e `VideoStatus`.
- `apps/server/src/library/migrations/20261101130001_create-library.sql` (criar): tabelas do acervo, `tsvector`, índices e Row Level Security, com `articles.cover_file_id` (PD-36), `books.reading_status`, `videos.watch_status` e `videos.channel` (PD-35, PD-37), editada no próprio arquivo enquanto não aplicada.
- `apps/server/src/library/tests/mod.rs` (criar): módulo de testes de integração e apoio comum (PDF e imagens mínimos, `ThumbnailFetcher` falso).
- `apps/server/src/library/tests/books.rs` (criar): testes de integração de livros, inclusive capa (PD-36), sessões (PD-60) e status de leitura (PD-35).
- `apps/server/src/library/tests/articles.rs` (criar): testes de integração de artigos, inclusive capa (PD-36).
- `apps/server/src/library/tests/videos.rs` (criar): testes de integração de vídeos, inclusive status e canal (PD-35, PD-37).
- `apps/server/src/library/tests/files.rs` (criar): testes de integração de arquivos, limites, RLS e busca.

### Passos

1. Leia os arquivos de "Ler" e anote os nomes reais que a TASK-04 criou: `AppState` e seus campos (pool, storage, relógio, gerador de ids, cliente HTTP), extrator do usuário autenticado, erro `problem+json`, enum de visibilidade, paginação por cursor opaco base64url (chave de ordenação + id), transação que abre com `set_config('app.current_user_id', $1, true)`, interface do storage e auxiliar de testes de `apps/server/src/http` (sessões de usuários de teste com CSRF, pool em container, app de teste, requisição autenticada com CSRF, storage em pasta temporária). Use esses nomes; não crie equivalentes. O código parcial já existente em `apps/server/src/library/` é mantido: compare-o com estes passos e acrescente só o que falta, sem reescrever o que já atende. Se `reqwest` ou `sha2` não estiverem declarados diretamente em `apps/server/Cargo.toml`, **PARE** e peça o ajuste da TASK-04 ou desta tarefa (skill `adjust-task`): nenhuma tarefa de contexto altera `apps/server/Cargo.toml`. Use `reqwest::Url` para as URLs.
2. Crie `apps/server/src/library/migrations/20261101130001_create-library.sql`, todas as tabelas com `id UUID PRIMARY KEY`, `owner_id UUID NOT NULL`, `visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal','shared'))`, `created_at` e `updated_at TIMESTAMPTZ NOT NULL`:
   - `library_files`: `kind TEXT CHECK (kind IN ('pdf','image'))`, `content_type TEXT`, `size_bytes BIGINT CHECK (size_bytes > 0)`, `sha256 TEXT`, `storage_key TEXT UNIQUE`, `deleted_at`.
   - `books`: `title` (1 a 300), `author`, `publisher` (até 300, nulos), `page_count INT CHECK (page_count > 0)`, `tags TEXT[] NOT NULL DEFAULT '{}'`, `reading_status TEXT NOT NULL DEFAULT 'want_to_read' CHECK (reading_status IN ('want_to_read','reading','read'))` (PD-35), `cover_file_id` e `pdf_file_id` (FK para `library_files`, nulos), `last_read_page INT NULL CHECK (last_read_page > 0)`, `deleted_at`, e `search_vector tsvector GENERATED ALWAYS AS (...) STORED` com título, autor, editora e tags.
   - `articles`: `title`, `url` (até 2048), `author`, `source`, `tags`, `reading_status TEXT CHECK (reading_status IN ('to_read','reading','read')) DEFAULT 'to_read'`, `cover_file_id` (FK para `library_files`, nulo, PD-36), `pdf_file_id`, `last_read_page`, `deleted_at`, `search_vector` com título, autor, fonte e tags.
   - `videos`: `url`, `title` (nulo), `channel TEXT NULL CHECK (channel IS NULL OR char_length(channel) BETWEEN 1 AND 300)` (PD-37), `watch_status TEXT NOT NULL DEFAULT 'to_watch' CHECK (watch_status IN ('to_watch','watching','watched'))` (PD-35), `tags`, `thumbnail_file_id`, `deleted_at`, `search_vector` com título, canal e tags.
   - `reading_sessions`: `book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE`, `read_on DATE NOT NULL`, `pages_read INT NOT NULL CHECK (pages_read > 0)`, `from_page` e `to_page INT NULL` com `CHECK (from_page IS NULL OR to_page IS NULL OR to_page > from_page)`, `observation TEXT NULL` (até 2000).
   - `item_notes`: `book_id`, `article_id`, `video_id` (FKs nulas com `ON DELETE CASCADE`) e `CHECK (num_nonnulls(book_id, article_id, video_id) = 1)`, `quote TEXT NULL` (até 5000), `page INT NULL CHECK (page > 0)`, `comment TEXT NULL` (até 5000), `CHECK (quote IS NOT NULL OR comment IS NOT NULL)`.
   - `highlights`: `book_id` ou `article_id` (FK nula, `CHECK (num_nonnulls(book_id, article_id) = 1)`), `file_id UUID NOT NULL REFERENCES library_files(id)`, `page INT CHECK (page > 0)`, `color TEXT CHECK (color IN ('accent','primary','success','warning','info'))`, `text TEXT NOT NULL` (até 5000), `rects JSONB NOT NULL`.
   - Índices em todas as FKs e em `(owner_id, created_at DESC, id DESC) WHERE deleted_at IS NULL` nas três entidades, GIN em `search_vector` e em `tags`, e `books_owner_status_idx ON books (owner_id, reading_status) WHERE deleted_at IS NULL` e `videos_owner_status_idx ON videos (owner_id, watch_status) WHERE deleted_at IS NULL` para o filtro por status ([project/database-06], [project/database-07]).
   - Para o `tsvector`, crie na própria migração `CREATE EXTENSION IF NOT EXISTS unaccent` e as funções `IMMUTABLE` `library_unaccent(text)` e `library_search_text(text[])`, usadas na expressão gerada com a configuração `portuguese`.
   - `ENABLE` e `FORCE ROW LEVEL SECURITY` em todas as tabelas, com políticas `<tabela>_owner_isolation` comparando `owner_id` a `current_setting('app.current_user_id', true)::uuid` (`USING` e `WITH CHECK`). Sem FK para tabelas de outro contexto.
3. Escreva primeiro os testes unitários do domínio, que devem falhar: em `book.rs`, `progress_is_sum_of_pages_over_total`, `progress_has_one_decimal_27_5`, `progress_is_capped_at_100_percent` (CB-05), `page_count_must_be_positive`, `title_is_required`; em `reading_session.rs`, `session_pages_must_be_positive`, `session_range_requires_to_after_from`, `session_beyond_total_is_accepted`, `pd60_session_with_only_pages_and_date_is_valid`; em `article.rs`, `reading_status_accepts_only_known_values`; em `video.rs`, `youtube_and_vimeo_urls_have_oembed_endpoint`, `other_hosts_have_no_oembed_endpoint`, `non_https_url_has_no_oembed_endpoint`; em `item_note.rs`, `item_note_requires_quote_or_comment`, `item_note_with_quote_and_page_without_comment_is_valid` (RN-24), `item_note_with_page_and_comment_without_quote_is_valid` (CB-20); em `highlight.rs`, `highlight_color_accepts_only_palette`, `highlight_rects_must_be_within_unit_square`, `highlight_requires_1_to_50_rects`, `highlight_is_from_current_file_only_when_file_matches` (CB-19); em `library_file.rs`, `pdf_is_detected_by_magic_bytes`, `non_pdf_is_rejected_even_with_pdf_content_type`, `png_jpeg_and_webp_are_detected_by_magic_bytes`, `pdf_over_50_mib_is_rejected`, `image_over_5_mib_is_rejected`.
4. Implemente o domínio sem `sqlx`, `axum` nem storage: progresso em inteiros, `progress_percent = (min(pages_read_total, page_count) * 1000 / page_count) / 10` com uma casa decimal, devolvido só para livros (RN-14, RN-22); limites `PDF_MAX_BYTES = 50 * 1024 * 1024` e `IMAGE_MAX_BYTES = 5 * 1024 * 1024`; detecção por assinatura (`%PDF-`, PNG, JPEG `FF D8 FF`, WebP `RIFF....WEBP`) ([project/security-10]); provedores oEmbed fixos: `youtube.com`, `www.youtube.com`, `m.youtube.com` e `youtu.be` para `https://www.youtube.com/oembed?format=json&url=`, e `vimeo.com` para `https://vimeo.com/api/oembed.json?url=`. `LibraryError` em `error.rs`. Rode `cargo test -p atria-server library::domain` até passar.
5. Escreva os testes de integração em `apps/server/src/library/tests/` (registrados em `tests/mod.rs` e em `mod.rs` com `#[cfg(test)] mod tests;`), com `library::router()` sobre o `AppState` de teste, `library::migrator()` aplicado no container, storage em pasta temporária, relógio e ids fixos, um PDF mínimo válido e um PNG mínimo gerados em `tests/mod.rs`, e um `ThumbnailFetcher` falso injetado:
   - `tests/books.rs`: `ct28_book_progress_27_5_after_editing_first_session` (livro de 200 páginas, sessões de 20 e 30, primeira editada para 25: `progress_percent` 27.5 na listagem e no detalhe), `cb05_session_beyond_total_caps_progress_at_100`, `rf48_reading_session_can_be_edited_and_deleted`, `rf50_reading_sessions_and_book_notes_are_listed_separately`, `rf47_book_cover_upload_is_served_as_image`, `rf51_book_pdf_upload_and_download`, `ct35_book_reading_position_resumes_at_page_12`, `cb18_reading_position_accepts_page_before_previous`, `ct36_session_with_page_range_40_to_62_enters_history_and_progress`, `ct37_book_note_from_quote_with_and_without_comment`, `cb20_book_note_with_page_and_comment_only`, `ct38_book_highlights_with_two_colors_are_listed`, `cb19_highlights_of_replaced_pdf_are_marked_as_other_file`, `highlight_on_book_without_pdf_is_rejected`, `book_deletion_calls_entity_deleted_hook` (espera `(owner_id, "book", id)`), `other_user_book_resources_return_404`; capa (PD-36): `pd36_book_cover_upload_read_and_replace` (envia PNG, `GET /books/{id}/cover` devolve `image/png` com `nosniff` e `inline`; troca por JPEG e o arquivo antigo passa a responder 404 em `/files/{id}`), `pd36_book_cover_remove` (`DELETE` responde 204, `cover_file_id` fica nulo, `GET .../cover` responde 404 `cover_not_found` e o arquivo antigo, 404; um segundo `DELETE` também responde 204), `pd36_book_cover_rejects_non_image_with_415` (PDF como capa), `pd36_book_cover_over_5_mib_is_rejected_with_413`; sessão (PD-60): `pd60_session_with_only_pages_and_date_counts_in_progress` (livro de 200 páginas, sessão de 50 páginas só com `read_on`: 201, sem intervalo, e `progress_percent` 25.0), `pd60_session_without_pages_read_is_rejected` (corpo sem `pages_read` recusado com 422), `pd60_sessions_add_up_in_progress` (sessões de 50 e 30, uma com intervalo e outra sem: `pages_read_total` 80 e 40.0%), `pd60_session_history_lists_pages_and_date` (a listagem traz `pages_read` e `read_on` de cada sessão, da data mais recente para a mais antiga, e `from_page`/`to_page` só quando enviados).
   - `tests/articles.rs`: `ct29_article_with_status_and_note_history`, `rf64_article_pdf_upload_and_download`, `ct35_article_reading_position_resumes_at_page_12`, `rn22_article_response_has_no_progress`, `ct37_article_note_from_quote`, `ct38_article_highlights_are_listed`, `article_deletion_calls_entity_deleted_hook`, `other_user_article_resources_return_404`; capa (PD-36): `pd36_article_cover_upload_read_and_replace`, `pd36_article_cover_remove`, `pd36_article_cover_rejects_non_image_with_415`, `pd36_article_cover_over_5_mib_is_rejected_with_413` e `pd36_other_user_article_cover_returns_404`, com os mesmos cenários dos do livro.
   - `tests/videos.rs`: `ct29_video_gets_thumbnail_from_oembed`, `cb12_video_without_internet_is_created_without_thumbnail` (o falso devolve erro de rede), `cb12_manual_thumbnail_upload`, `rf53_video_notes_history`, `video_from_unknown_provider_skips_oembed`, `video_deletion_calls_entity_deleted_hook`, `other_user_video_returns_404`. A miniatura do vídeo não muda com a PD-36.
   - `tests/files.rs`: `rn25_file_is_served_only_to_owner` (outra pessoa recebe 404), `ct38_file_download_has_attachment_disposition`, `file_response_has_nosniff_and_inline_disposition`, `upload_with_wrong_magic_is_rejected_with_415`, `upload_over_limit_is_rejected_with_413`, `rls_is_enabled_on_library_tables`, `library_search_finds_book_by_unaccented_author`, `listing_filters_by_tag_status_and_cursor`.
   Rode e confirme que falham.
6. Em `application/ports.rs`, declare os traits dos repositórios (livros e sessões, artigos, vídeos, notas de item e destaques, arquivos), `ThumbnailFetcher` (`async fn fetch(&self, video_url: &reqwest::Url) -> Result<Option<FetchedThumbnail { title: Option<String>, bytes, content_type }>, ThumbnailError>`) e o alias `pub type EntityDeletedHook = std::sync::Arc<dyn Fn(uuid::Uuid, &'static str, uuid::Uuid) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;`, com os argumentos `(owner_id, entity_type, entity_id)`, escrito exatamente como na TASK-15, com um comentário dizendo por que a grafia tem de ser idêntica.
7. Implemente os casos de uso em `application/`: livros (CRUD, sessões com edição e exclusão, notas de livro, posição de leitura, destaques, capa e PDF), artigos (CRUD, notas, posição, destaques, capa e PDF), vídeos (CRUD; ao criar, chama o `ThumbnailFetcher` só para provedor permitido e, em qualquer erro, cria o vídeo sem miniatura; envio manual da miniatura), arquivos (leitura só pelo dono) e `LibrarySearch::search(owner_id, query, limit) -> Vec<LibrarySearchHit { entity_type, id, title, rank }>` com `websearch_to_tsquery('portuguese', library_unaccent(query))` sobre as três entidades, para a TASK-16. Ao trocar o PDF, o arquivo antigo recebe `deleted_at`, o conteúdo é removido do storage e os destaques continuam ligados a ele, voltando com `is_current_file: false` (CB-19). Destaque só é aceito com `file_id` igual ao PDF atual do item. Capa do livro e do artigo (PD-36): `set_cover` aceita só imagem (PNG, JPEG ou WebP pela assinatura, até `IMAGE_MAX_BYTES`), e a troca marca a capa antiga com `deleted_at` e remove o conteúdo do storage, como já faz o `replace_file` do livro; `remove_cover` limpa `cover_file_id` e descarta o arquivo do mesmo jeito, sem erro quando não há capa; `get_cover` devolve o arquivo atual ou `cover_not_found`. Reaproveite o mesmo caminho de gravação do PDF (`store_upload` e `discard` do repositório de arquivos, sobre o `FileStorage` de `apps/server/src/storage`), sem criar outro. Sessão (PD-60): `pages_read` e `read_on` são obrigatórios; `from_page` e `to_page` continuam opcionais, vêm juntos ou não vêm, e não alteram `last_read_page`; o progresso soma `pages_read` de todas as sessões.
8. Implemente a infraestrutura: repositórios `pg_*.rs` com queries parametrizadas com `sqlx::query`/`sqlx::query_as` e `.bind` (checadas em execução, sem SQL montado por concatenação; a troca pelas macros checadas na compilação, exigidas por [project/stack-04], fica com a TASK-18, que gera a pasta `.sqlx`), dentro do transação que abre com `set_config('app.current_user_id', $1, true)` e sempre filtrando por `owner_id` ([project/security-04]); exclusão lógica com `deleted_at` em livros, artigos e vídeos ([project/database-08]) e física em sessões e notas de item (RF-48); `pg_files.rs` grava o conteúdo no storage com chave `library/<owner_id>/<file_id>` gerada pelo servidor; `oembed_thumbnail_fetcher.rs` usa o cliente HTTP do `AppState`, só `https`, tempo limite de 3 s, aceita a miniatura só de `https`, até 2 MiB e com assinatura de imagem válida, e nunca registra a URL do vídeo em log ([project/security-13]).
9. Em `interface/dto.rs`, declare os DTOs em `snake_case` com `utoipa::ToSchema`/`IntoParams`: livro (campos comuns + `title`, `author`, `publisher`, `page_count`, `tags`, `reading_status`, `cover_file_id`, `pdf_file_id`, `pages_read_total`, `progress_percent`), artigo (`title`, `url`, `author`, `source`, `tags`, `reading_status`, `cover_file_id`, `pdf_file_id`, sem progresso), vídeo (`url`, `title`, `channel`, `watch_status`, `tags`, `thumbnail_file_id`), sessão (`read_on`, `pages_read`, `from_page`, `to_page`, `observation`), nota de item (`quote`, `page`, `comment`), posição (`page`), destaque (`file_id`, `page`, `color`, `text`, `rects`, `is_current_file`) e as consultas de listagem (`cursor`, `limit` de 1 a 100 com padrão 50, `q`, `tag`, `visibility` e o status de cada tipo: `reading_status` em livros e artigos, `watch_status` em vídeos).
10. Implemente os handlers com `#[utoipa::path]` e caminhos relativos (a TASK-18 monta sob `/api/v1`):
    - `GET|POST /books`, `GET|PATCH|DELETE /books/{id}`, `GET|PUT|DELETE /books/{id}/cover`, `PUT /books/{id}/pdf`, `GET|POST /books/{id}/reading-sessions`, `PATCH|DELETE /books/{id}/reading-sessions/{session_id}`, `GET|POST /books/{id}/book-notes`, `PATCH|DELETE /books/{id}/book-notes/{note_id}`, `GET|PUT /books/{id}/reading-position`, `GET|POST /books/{id}/highlights`;
    - `GET|POST /articles`, `GET|PATCH|DELETE /articles/{id}`, `GET|PUT|DELETE /articles/{id}/cover`, `PUT /articles/{id}/pdf`, `GET|POST /articles/{id}/article-notes`, `PATCH|DELETE /articles/{id}/article-notes/{note_id}`, `GET|PUT /articles/{id}/reading-position`, `GET|POST /articles/{id}/highlights`;
    - `GET|POST /videos`, `GET|PATCH|DELETE /videos/{id}`, `PUT /videos/{id}/thumbnail`, `GET|POST /videos/{id}/video-notes`, `PATCH|DELETE /videos/{id}/video-notes/{note_id}`;
    - `GET /files/{id}`, com `?download=true` para `Content-Disposition: attachment` (RF-70) e, sem ele, `inline`; sempre `Content-Type` gravado, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` e nome de arquivo gerado pelo servidor (`<id>.pdf`, `<id>.png`...).
    `GET .../cover` serve a imagem com os mesmos cabeçalhos de `GET /files/{id}` sem `download` (`inline`, `nosniff`, `Cache-Control: private, no-store`); `DELETE .../cover` responde 204. A descrição do `#[utoipa::path]` das rotas de capa e do campo `cover_file_id` diz o formato de exibição, 2:3 no livro e 16:9 no artigo, só como dica para a tela: o servidor não recorta nem confere dimensões.
    Os envios (`PUT .../pdf`, `.../cover`, `.../thumbnail`) recebem o corpo cru (`Bytes`), com `DefaultBodyLimit::max` de 50 MiB no PDF e 5 MiB nas imagens; tipo errado responde 415 `unsupported_file_type` e tamanho acima 413 `file_too_large`. O `DELETE` de livro, artigo e vídeo extrai `Option<Extension<EntityDeletedHook>>` e chama o gancho depois do commit com `"book"`, `"article"` ou `"video"`. Erros só aqui convertidos em `problem+json`: `book_not_found`, `article_not_found`, `video_not_found`, `file_not_found`, `reading_session_not_found`, `item_note_not_found`, `cover_not_found` (404, também para dado de outro usuário), `pdf_required`, `highlight_file_mismatch` e `validation_failed` (422).
11. Em `interface/openapi.rs`, declare `#[derive(utoipa::OpenApi)] pub struct LibraryApi`; em `interface/mod.rs`, monte o `Router<AppState>`; em `mod.rs`, exponha `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator` (`sqlx::migrate!("src/library/migrations")`), `pub fn openapi() -> utoipa::openapi::OpenApi` e `pub use application::search::{LibrarySearch, LibrarySearchHit}`. O `router()` usa o `OembedThumbnailFetcher` real; os testes injetam o falso pelo mesmo ponto (`Extension<Arc<dyn ThumbnailFetcher>>` com padrão no real).
12. Não altere `apps/server/src/main.rs`, `apps/server/src/http` nem `apps/server/src/storage`: o `mod library;` já é declarado em `apps/server/src/main.rs` pela TASK-04, e esta tarefa só cria `apps/server/src/library/mod.rs`. Se `cargo test -p atria-server library:: -- --list` não listar os testes por falta dessa declaração, **PARE** e peça o ajuste da tarefa (skill `adjust-task`).
13. Status do livro e do vídeo e canal do vídeo (PD-35, PD-37, DEC-002), sobre o código já pronto, sem reescrever o resto:
    - Testes primeiro, que devem falhar: em `domain/book.rs`, `pd35_book_status_accepts_only_known_values` (`want_to_read`, `reading` e `read` aceitos; `wishlist`, `finished`, `to_read` e `Read` recusados; padrão `want_to_read`); em `domain/video.rs`, `pd35_video_status_accepts_only_known_values` (`to_watch`, `watching` e `watched`; `to_read` e `done` recusados; padrão `to_watch`) e `pd37_video_channel_is_optional_and_limited_to_300_chars` (em branco vira `None`, 301 caracteres recusado); em `tests/books.rs`, `pd35_book_reading_status_defaults_to_want_to_read_and_can_be_changed` (`POST` sem status responde 201 com `want_to_read`; `PATCH` para `reading` e depois `read` aparece no detalhe e na listagem), `pd35_books_listing_filters_by_reading_status` (livros da Alice em `want_to_read`, `reading` e `read` e um do Bob em `reading`: `GET /books?reading_status=reading` traz só o da Alice, e combinado com `tag` filtra pelos dois) e `pd35_book_rejects_unknown_reading_status_with_422` (`POST` com `wishlist` e `GET /books?reading_status=finished` respondem 422 `validation_failed`); em `tests/videos.rs`, `pd35_video_watch_status_defaults_to_to_watch_and_can_be_changed`, `pd35_videos_listing_filters_by_watch_status` (mesmos cenários com `to_watch`, `watching` e `watched`), `pd35_video_rejects_unknown_watch_status_with_422` (`to_read` no corpo e na consulta), `pd37_video_channel_is_saved_edited_and_cleared` (`POST` com `channel` "Canal Céu Aberto" devolve o canal; `PATCH` muda; `PATCH` com `null` limpa; 301 caracteres responde 422) e `pd37_videos_listing_finds_by_channel_text` (`GET /videos?q=ceu aberto` encontra o vídeo pelo canal, sem acento). Rode e confirme que falham.
    - Domínio: `BookStatus` em `book.rs` e `VideoStatus` em `video.rs`, no mesmo molde de `ReadingStatus` de `article.rs` (`#[serde(rename_all = "snake_case")]`, `ToSchema`, `Default`, `as_str` e `parse` com `LibraryError::validation("reading_status" | "watch_status", "invalid")`). `Book`, `NewBook` e `BookChanges` ganham `reading_status` (em `BookChanges`, `Option<BookStatus>`); `Video`, `NewVideo` e `VideoChanges` ganham `watch_status` e `channel: Option<String>` (em `VideoChanges`, `Option<Option<String>>`), normalizado com `optional_text(..., FIELD_MAX_CHARS)` como o `author` do livro. O canal é sempre digitado: o oEmbed não o preenche.
    - Aplicação: `CreateBook` ganha `reading_status: BookStatus`; `CreateVideo` ganha `channel` e `watch_status`. `ListQuery` (`application/mod.rs`) e `ListFilter` (`application/ports.rs`) ganham `book_status: Option<BookStatus>` e `video_status: Option<VideoStatus>`, ao lado do `reading_status` do artigo, que não muda. A assinatura de `list_query` em `interface/mod.rs` não muda: os handlers de `/books` e `/videos` chamam `list_query(..., None)` e preenchem `book_status` ou `video_status` no `ListQuery` devolvido.
    - Infraestrutura: em `pg_books.rs`, `reading_status` entra no `SELECT`, no `INSERT` e no `UPDATE`, e a listagem ganha `AND ($N::text IS NULL OR reading_status = $N)` com `.bind(filter.book_status.map(BookStatus::as_str))`, no próximo parâmetro livre; em `pg_videos.rs`, o mesmo com `watch_status` e `filter.video_status`, e `channel` no `SELECT`, no `INSERT` e no `UPDATE`. Sempre `sqlx::query`/`query_as` com `.bind`.
    - Interface: `BookResponse` ganha `reading_status`; o corpo de criação do livro aceita `reading_status` opcional (padrão `want_to_read`) e o de edição, `reading_status` opcional; `BookListQuery` ganha `reading_status: Option<BookStatus>`. `VideoResponse` ganha `channel` e `watch_status`; criação aceita `channel` e `watch_status` opcionais (padrão `to_watch`); edição aceita `watch_status` e `channel` anulável com o desserializador `nullable` já usado em `author`; `VideoListQuery` ganha `watch_status: Option<VideoStatus>`. Valor desconhecido no corpo ou na consulta responde 422 `validation_failed` pelo mesmo `ValidQuery`/corpo validado dos artigos. Registre `BookStatus` e `VideoStatus` nos `components` de `LibraryApi`.
    - Migração: aplique as colunas e índices do passo 2 editando `20261101130001_create-library.sql` no próprio arquivo, sem migração nova.
14. Rode os comandos da Verificação até todos passarem, com Docker disponível para o testcontainers.

### Baseline

- `test -d apps/server/src/library && echo existe || echo ausente`
- `cargo test -q -p atria-server shared:: 2>/dev/null`
- `cargo test -q -p atria-server storage:: 2>/dev/null`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
cargo test -p atria-server library:: -- --list | grep -q 'library::tests::books::ct28_book_progress_27_5_after_editing_first_session'
cargo test -p atria-server library:: -- --list | grep -q 'library::tests::articles::pd36_article_cover_remove'
cargo test -p atria-server library:: -- --list | grep -q 'library::tests::books::pd60_session_history_lists_pages_and_date'
cargo test -p atria-server library:: -- --list | grep -q 'library::tests::books::pd35_books_listing_filters_by_reading_status'
cargo test -p atria-server library:: -- --list | grep -q 'library::tests::videos::pd37_video_channel_is_saved_edited_and_cleared'
cargo test -p atria-server library::
cargo test -p atria-server library::tests::files::rn25_file_is_served_only_to_owner -- --exact
cargo test -p atria-server -- pd36_ pd60_
cargo test -p atria-server library:: -- pd35_ pd37_
```

Resultado esperado: formatação e clippy sem aviso, `test result: ok` em todos os testes do contexto o teste de arquivo só para o dono passando e os testes de capa (PD-36), de sessão (PD-60) e de status e canal (PD-35, PD-37) passando, com nenhum `running 0 tests`.

### Evidências

- `library-tests.txt` (automática): `cargo test -p atria-server library::`
  - Prova: os testes unitários e de integração do Acervo passam: livros com progresso, sessões, notas de item, capa e PDF, artigos, vídeos com miniatura, posição de leitura, destaques, arquivos e busca (RF-47 a RF-53, RF-64, RF-66 a RF-70, CT-28, CT-29, CT-35 a CT-38, CB-05, CB-12, CB-18 a CB-20).
  - Trecho: as linhas `test library::tests::books::ct28_book_progress_27_5_after_editing_first_session ... ok`, `test library::tests::books::pd36_book_cover_remove ... ok`, `test library::tests::videos::cb12_video_without_internet_is_created_without_thumbnail ... ok`, `test library::tests::books::cb19_highlights_of_replaced_pdf_are_marked_as_other_file ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED` ou `running 0 tests` (contexto inexistente).
- `library-file-owner.txt` (automática): `cargo test -p atria-server library::tests::files::rn25_file_is_served_only_to_owner -- --exact`
  - Prova: o PDF e as imagens só são servidos ao dono; outra pessoa recebe 404 (RN-25, RNF-02).
  - Trecho: `test library::tests::files::rn25_file_is_served_only_to_owner ... ok` e `test result: ok. 1 passed`.
  - Falha: `FAILED`, ou `0 passed` (teste ausente).
- `library-covers-sessions.txt` (automática): `cargo test -p atria-server -- pd36_ pd60_`
  - Prova: a capa do livro e do artigo é enviada, lida, trocada e removida, aceita só imagem de até 5 MiB, e a sessão de leitura grava páginas e data, soma no progresso e aparece no histórico (PD-36, PD-60, DEC-002; RF-47, RF-48, RF-49, RF-52, RF-67).
  - Trecho: as linhas `test library::tests::articles::pd36_article_cover_remove ... ok`, `test library::tests::books::pd36_book_cover_rejects_non_image_with_415 ... ok`, `test library::tests::books::pd60_sessions_add_up_in_progress ... ok`, `test library::tests::books::pd60_session_history_lists_pages_and_date ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED` ou `running 0 tests` (testes ausentes).
- `library-statuses.txt` (automática): `cargo test -p atria-server library:: -- pd35_ pd37_`
  - Prova: livro e vídeo têm status próprio, com padrão, troca, recusa de valor desconhecido e filtro na listagem, e o vídeo grava, edita, limpa e busca pelo canal (PD-35, PD-37, DEC-002; RF-47, RF-53).
  - Trecho: as linhas `test library::tests::books::pd35_books_listing_filters_by_reading_status ... ok`, `test library::tests::videos::pd35_videos_listing_filters_by_watch_status ... ok`, `test library::tests::videos::pd37_video_channel_is_saved_edited_and_cleared ... ok`, `test library::domain::book::tests::pd35_book_status_accepts_only_known_values ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED` ou `running 0 tests` (testes ausentes).

### Concluída quando

- [x] O Acervo cadastra livros com título, capa, autor, editora, páginas e tags, registra sessões com observação, edita e exclui cada registro, e mostra o progresso limitado a 100% na listagem e no detalhe (RF-47, RF-48, RF-49, CT-28).

  > Como comprovar: em `library-tests.txt`, ver `ok` em `ct28_book_progress_27_5_after_editing_first_session` (progresso 27,5%), `cb05_session_beyond_total_caps_progress_at_100`, `rf48_reading_session_can_be_edited_and_deleted` e `rf47_book_cover_upload_is_served_as_image`.

- [x] A capa do livro e a do artigo são enviadas, lidas, trocadas e removidas por rota própria, aceitam só imagem de até 5 MiB e usam o mesmo armazenamento do PDF; a miniatura do vídeo não muda (PD-36, DEC-002, RF-47, RF-52).

  > Como comprovar: em `library-covers-sessions.txt`, ver `ok` em `pd36_book_cover_upload_read_and_replace`, `pd36_book_cover_remove`, `pd36_book_cover_rejects_non_image_with_415`, `pd36_book_cover_over_5_mib_is_rejected_with_413`, `pd36_article_cover_upload_read_and_replace`, `pd36_article_cover_remove` e `pd36_other_user_article_cover_returns_404`.

- [x] A sessão de leitura exige as páginas lidas e a data, aceita sem as páginas de início e fim, soma no progresso do livro, e o histórico lista páginas e data (PD-60, DEC-002, RF-48, RF-49).

  > Como comprovar: em `library-covers-sessions.txt`, ver `ok` em `pd60_session_with_only_pages_and_date_counts_in_progress`, `pd60_session_without_pages_read_is_rejected`, `pd60_sessions_add_up_in_progress`, `pd60_session_history_lists_pages_and_date` e `pd60_session_with_only_pages_and_date_is_valid`.

- [x] O livro tem status de leitura Quero ler, Lendo ou Lido (`want_to_read`, `reading`, `read`, padrão `want_to_read`) e o vídeo, Para assistir, Assistindo ou Assistido (`to_watch`, `watching`, `watched`, padrão `to_watch`); as listagens de livros e de vídeos filtram pelo status, como a de artigos, e valor desconhecido responde 422 (PD-35, DEC-002, RF-47, RF-53).

  > Como comprovar: em `library-statuses.txt`, ver `ok` em `pd35_book_status_accepts_only_known_values`, `pd35_book_reading_status_defaults_to_want_to_read_and_can_be_changed`, `pd35_books_listing_filters_by_reading_status`, `pd35_book_rejects_unknown_reading_status_with_422`, `pd35_video_status_accepts_only_known_values`, `pd35_video_watch_status_defaults_to_to_watch_and_can_be_changed`, `pd35_videos_listing_filters_by_watch_status` e `pd35_video_rejects_unknown_watch_status_with_422`.

- [x] O vídeo tem canal opcional, de até 300 caracteres, gravado, editado e limpo pela API e encontrado pela busca (PD-37, DEC-002, RF-53).

  > Como comprovar: em `library-statuses.txt`, ver `ok` em `pd37_video_channel_is_optional_and_limited_to_300_chars`, `pd37_video_channel_is_saved_edited_and_cleared` e `pd37_videos_listing_finds_by_channel_text`.

- [x] O histórico de leitura e o de notas do livro vêm em listas separadas, e as notas de item não aparecem em Notas (RF-50).

  > Como comprovar: ver `rf50_reading_sessions_and_book_notes_are_listed_separately ... ok` em `library-tests.txt`.

- [x] O PDF é anexado de forma opcional ao livro e ao artigo, conferido pelo conteúdo e pelo tamanho, e servido só ao dono, com botão de baixar (RF-51, RF-64, RF-70, RN-25).

  > Como comprovar: ver `ok` em `rf51_book_pdf_upload_and_download`, `rf64_article_pdf_upload_and_download`, `ct38_file_download_has_attachment_disposition`, `upload_with_wrong_magic_is_rejected_with_415` e `upload_over_limit_is_rejected_with_413` em `library-tests.txt`, e `rn25_file_is_served_only_to_owner ... ok` em `library-file-owner.txt`.

- [x] Artigos têm título, URL, autor, fonte, tags, status de leitura e notas em histórico, sem barra de progresso (RF-52, CT-29).

  > Como comprovar: ver `ct29_article_with_status_and_note_history ... ok` e `rn22_article_response_has_no_progress ... ok` em `library-tests.txt`.

- [x] Vídeos têm URL, notas em histórico e miniatura buscada por oEmbed; sem internet, o vídeo é criado sem miniatura e a pessoa envia a imagem à mão (RF-53, CT-29).

  > Como comprovar: ver `ok` em `ct29_video_gets_thumbnail_from_oembed`, `cb12_video_without_internet_is_created_without_thumbnail`, `cb12_manual_thumbnail_upload` e `rf53_video_notes_history` em `library-tests.txt`.

- [x] A última página lida do livro e do artigo é gravada e devolvida, inclusive quando é anterior à anterior (RF-66, CT-35).

  > Como comprovar: ver `ok` em `ct35_book_reading_position_resumes_at_page_12`, `ct35_article_reading_position_resumes_at_page_12` e `cb18_reading_position_accepts_page_before_previous` em `library-tests.txt`.

- [x] A sessão confirmada ao fechar o leitor, com o intervalo de páginas, entra no histórico e no progresso (RF-67, CT-36).

  > Como comprovar: ver `ct36_session_with_page_range_40_to_62_enters_history_and_progress ... ok` em `library-tests.txt`.

- [x] A nota criada a partir de um trecho guarda o trecho e a página, com comentário opcional, e sem texto guarda só a página e o comentário (RF-68, CT-37).

  > Como comprovar: ver `ok` em `ct37_book_note_from_quote_with_and_without_comment`, `ct37_article_note_from_quote` e `cb20_book_note_with_page_and_comment_only` em `library-tests.txt`.

- [x] Os destaques com cor são gravados e listados no livro e no artigo, e os do PDF antigo continuam, marcados como de outro arquivo (RF-69, CT-38).

  > Como comprovar: ver `ok` em `ct38_book_highlights_with_two_colors_are_listed`, `ct38_article_highlights_are_listed` e `cb19_highlights_of_replaced_pdf_are_marked_as_other_file` em `library-tests.txt`.

- [x] Dados de outra pessoa respondem 404, as tabelas têm Row Level Security ativa, a exclusão de livro, artigo e vídeo avisa o contexto de ligações, e a busca encontra itens do próprio dono sem acento (RF-47, RF-52, RF-53).

  > Como comprovar: ver `ok` em `other_user_book_resources_return_404`, `other_user_article_resources_return_404`, `other_user_video_returns_404`, `rls_is_enabled_on_library_tables`, `book_deletion_calls_entity_deleted_hook` e `library_search_finds_book_by_unaccented_author` em `library-tests.txt`.

- [x] O contexto expõe `router()`, `migrator()` e `openapi()`, não altera `main.rs`, `http` nem `storage`, passa limpo em `cargo fmt --check` e `cargo clippy -- -D warnings`, e as camadas `domain` e `application` têm pelo menos 80% de cobertura (RF-47).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminando sem erro; abrir `apps/server/src/library/mod.rs` e ver as três funções públicas; rodar `cargo llvm-cov -p atria-server --summary-only -- library::` e ver 80% ou mais nos arquivos de `library/domain` e `library/application`.

## Descrição

### Resumo executivo

Entrega no servidor o Acervo: livros e artigos com capa enviada pela pessoa, livros com progresso somado das sessões de leitura, livros, artigos e vídeos com status próprio e filtro por ele, vídeos com canal e miniatura, históricos de leitura e de notas, PDF opcional, última página lida e destaques.
Dá ao modo leitura tudo o que ele precisa no servidor e garante que cada PDF só chegue ao próprio dono.
Perfil padrao: muitas partes, mas com as decisões já tomadas; o risco é médio, concentrado no envio de arquivos e na busca da miniatura.
Depende do núcleo do servidor e libera a busca global, os relatórios de leitura, a integração do servidor, as telas do Acervo e o modo leitura.

### Detalhes técnicos

**Abordagem.** Contexto DDD `apps/server/src/library` com três agregações (`Book`, `Article`, `Video`) e seus registros (sessões, notas de item, destaques, posição), arquivos atrás da interface de storage da TASK-04 ([project/stack-11]) e TDD contra PostgreSQL real em container. O leitor é frontend (TASK-29); aqui ficam só os dados e os arquivos. Rotas relativas, montadas sob `/api/v1` pela TASK-18; a TASK-18 registra `router()`, `migrator()` e `openapi()`.

**Divergência com a spec (DEC-002).** A spec SPEC-001 está `planned` e não muda; esta tarefa segue as decisões do protótipo por decisão do usuário (DEC-002, `docs/decisoes-do-prototipo.md`):

- PD-36: capa por upload também no artigo, que não tem capa na spec (RF-52), com troca, leitura e remoção por `GET|PUT|DELETE /books/{id}/cover` e `/articles/{id}/cover`. Só imagem (PNG, JPEG ou WebP pela assinatura), até 5 MiB (`IMAGE_MAX_BYTES`), no mesmo armazenamento e com a mesma troca do PDF. O formato 2:3 do livro e 16:9 do artigo é só dica para a tela, na descrição do OpenAPI; descartado recortar ou validar dimensões no servidor, que a PD não pede e exigiria uma biblioteca de imagem em `apps/server/Cargo.toml`. A miniatura do vídeo (RF-53) não muda; descartado trocá-la pela capa, porque a PD-36 só a cita como formato.
- PD-60: a sessão registra `pages_read` e `read_on`, obrigatórios; `from_page` e `to_page` continuam opcionais, só para o modo leitura preencher e retomar a oferta (RF-67, CT-36), e o histórico lista páginas e data. Descartado remover o intervalo do modelo, que o leitor ainda usa.

- PD-35 e PD-37: o livro ganha `reading_status` (`want_to_read`, `reading`, `read`; rótulos Quero ler, Lendo e Lido) e o vídeo, `watch_status` (`to_watch`, `watching`, `watched`; Para assistir, Assistindo e Assistido, valores do protótipo) e `channel` opcional, todos com filtro na listagem, para as telas da TASK-28. O artigo já tinha `reading_status` (`to_read`, `reading`, `read`) e não muda. No livro, os valores seguem o pedido do usuário, e não as chaves `wishlist`/`finished` do protótipo, que só servem de rótulo; descartado um `status` único para os três tipos, porque cada tipo tem valores próprios e o artigo já expõe `reading_status`. O canal é sempre digitado; descartado preenchê-lo pelo `author_name` do oEmbed, que mudaria o contrato do `ThumbnailFetcher` sem pedido. Os filtros entram como campos novos do `ListQuery`/`ListFilter`, sem mudar a assinatura de `list_query`; descartado acrescentar parâmetros a ela, que passaria do limite de argumentos do clippy.

**Decisões locais já tomadas.**

- Progresso calculado em inteiros a partir da soma das sessões, com uma casa decimal e teto de 100% (RN-14, CB-05); descartado guardar o progresso numa coluna, que dessincroniza ao editar uma sessão.
- Notas de livro, artigo e vídeo numa só tabela `item_notes` com três FKs e `CHECK` de exatamente uma; descartadas três tabelas iguais. Ficam no Acervo, nunca em Notas (RN-21). A rota `/videos/{id}/video-notes` segue o padrão de `/books/{id}/book-notes` para cumprir o RF-53, que a lista de recursos da spec não detalha.
- Nota de trecho com `quote`, `page` e `comment`, exigindo trecho ou comentário (RN-24, CB-20).
- Destaque guarda o `file_id` do PDF em que foi feito; ao trocar o PDF, o antigo é marcado como excluído e removido do storage, e o destaque volta com `is_current_file: false` (CB-19); descartado apagar os destaques.
- Posição de leitura como coluna `last_read_page` em livro e artigo, sobrescrita a cada `PUT` (CB-18); descartada tabela própria, desnecessária para um valor por item. O artigo não tem progresso (RN-22).
- Sessão do leitor só entra quando o frontend envia o `POST` depois da confirmação (RN-23); o servidor aceita `from_page` e `to_page` opcionais (CT-36, PD-60), que não alteram a posição de leitura (`last_read_page`), gravada só pelo `PUT .../reading-position`; descartado acoplar as duas, que mudaria o CB-18.
- Remover a capa é idempotente (204 também sem capa) e ler sem capa responde 404 `cover_not_found`; descartado 404 no `DELETE`, que obrigaria a tela a saber se havia capa.
- Envio de arquivo com corpo cru (`Bytes`) e limite por rota; descartado `multipart`, que exigiria um recurso novo do `axum` em `apps/server/Cargo.toml`, fora do escopo desta tarefa. Tipo pelo conteúdo, tamanho limitado, nome gerado e `nosniff` ([project/security-10]).
- `GET /files/{id}` fica neste contexto porque PDFs, capas e miniaturas são os únicos arquivos do MVP; a consulta filtra por dono e responde 404 a qualquer outro (RN-25, [project/testing-03]).
- Miniatura por oEmbed só de YouTube e Vimeo, com `https`, tempo limite e tamanho máximo, e a imagem copiada para o storage, porque a CSP não permite imagem externa e o app precisa funcionar sem internet ([project/architecture-12], CB-12); descartado guardar a URL externa da miniatura.
- `tsvector` gerado com `unaccent` por funções `IMMUTABLE` prefixadas `library_`, para não colidir com outros contextos, e `LibrarySearch` exposto à TASK-16, que não lê as tabelas do Acervo ([project/architecture-04], [project/database-06]).
- Exclusão de livro, artigo e vídeo avisa o contexto de ligações pelo gancho `EntityDeletedHook` (CB-06), como nas TASK-11 e TASK-12.

**Riscos técnicos.** PDFs grandes pesam na memória ao enviar com corpo cru (limite de 50 MiB por envio). A busca da miniatura pode atrasar o cadastro do vídeo (tempo limite de 3 s). **Pré-condição da TASK-04:** `reqwest` (com rustls) e `sha2` declarados em `apps/server/Cargo.toml`; sem eles, a tarefa para e pede ajuste, porque contextos não alteram esse arquivo. A rota `/files/{id}` não pode ser registrada também por outro contexto; o alias do gancho tem de ter a mesma grafia da TASK-15.

**Referências da spec.** DEC-002, PD-35, PD-36, PD-37 e PD-60 (origem da divergência); RF-47 a RF-53, RF-64, RF-66 a RF-70, RN-14, RN-21 a RN-25, CB-05, CB-06, CB-12, CB-16 a CB-20 (CB-16 e CB-17 ficam com o frontend), CT-28, CT-29, CT-35 a CT-38; decisões 4, 29, 30, 44 a 51 e 53 a 56.

**Arquivos em comum na onda 4.** Nenhum: a tarefa só cria arquivos sob `apps/server/src/library/`.

### Card

- **Título:** Contexto library
- **Tipo:** historia
- **Descrição:** Acervo no servidor: livros e artigos com capa por upload, livros com progresso por sessões de páginas e data, livros, artigos e vídeos com status próprio e filtro, vídeos com canal, vídeos com miniatura, notas de item, PDF opcional servido só ao dono, posição de leitura e destaques para o modo leitura.
- **Critérios de aceite:**
  - [ ] Livro de 200 páginas com sessões de 25 e 30 mostra 27,5%, e o progresso para em 100%.
  - [ ] Sessões e notas do livro ficam em históricos separados, com edição e exclusão.
  - [ ] Capa do livro e do artigo: enviar, ver, trocar e remover, só imagem de até 5 MB.
  - [ ] Sessão com páginas lidas e data soma no progresso, e o histórico mostra páginas e data.
  - [ ] PDF do livro e do artigo é conferido, baixado e servido só ao dono.
  - [ ] Artigo com status e notas; vídeo com miniatura por oEmbed ou envio manual.
  - [ ] Livro (Quero ler, Lendo, Lido) e vídeo (Para assistir, Assistindo, Assistido) com status e filtro na listagem; vídeo com canal.
  - [ ] Posição de leitura, notas de trecho e destaques com cor funcionam no livro e no artigo.
  - [ ] Dados de outra pessoa respondem 404, com Row Level Security ativa.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
| 2 | 2026-10-30 | baseline | coletado | 3 comando(s); códigos de saída: 0, 0, 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | ajuste | in_progress | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
| 4 | 2026-10-30 | ajuste | in_progress | PD-36 (DEC-002): capa por upload no livro e no artigo, só imagem até 5 MiB, com GET\|PUT\|DELETE de capa no storage do PDF, formato 2:3/16:9 só como dica no OpenAPI e miniatura do vídeo inalterada, em Ler, Mudar, Passos, Verificação, Evidências, Concluída quando, Detalhes técnicos e card; PD-60 (DEC-002): sessão com pages_read e read_on obrigatórios, intervalo opcional para o leitor retomar, soma no progresso e histórico com páginas e data, com testes pd60_ novos; código parcial de apps/server/src/library mantido |
| 5 | 2026-10-30 | ajuste | in_progress | PD-35 (DEC-002): status do livro want_to_read\|reading\|read (padrão want_to_read) e do vídeo to_watch\|watching\|watched (padrão to_watch, valores do protótipo), com filtro ?reading_status= em /books e ?watch_status= em /videos, colunas e índices editados na migração no próprio arquivo; PD-37: canal opcional do vídeo (até 300, na busca); novo passo 13 com testes pd35_/pd37_ antes do código, Ler, Mudar, passos 2 e 9, Verificação, evidência library-statuses.txt, Concluída quando, Detalhes técnicos e card; Baseline inalterado |
| 6 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-31 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 8 | 2026-10-31 | retomada | validating | decisão do usuário: aceite do usuário (KNW-005): pasta library criada pela própria tarefa (defeito da issue 6); aceito(s): 1 |
| 9 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 10 | 2026-10-31 | regressão | passed | 2 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 11 | 2026-10-31 | evidências | erro | evidência automática com erro |
| 12 | 2026-10-31 | evidências | passed | 4 evidência(s) em evidence/TASK-13/ |
| 13 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
| 2 | 2026-10-30 | agente | PD-36 (DEC-002): capa por upload no livro e no artigo, só imagem até 5 MiB, com GET\|PUT\|DELETE de capa no storage do PDF, formato 2:3/16:9 só como dica no OpenAPI e miniatura do vídeo inalterada, em Ler, Mudar, Passos, Verificação, Evidências, Concluída quando, Detalhes técnicos e card; PD-60 (DEC-002): sessão com pages_read e read_on obrigatórios, intervalo opcional para o leitor retomar, soma no progresso e histórico com páginas e data, com testes pd60_ novos; código parcial de apps/server/src/library mantido |
| 3 | 2026-10-30 | agente | PD-35 (DEC-002): status do livro want_to_read\|reading\|read (padrão want_to_read) e do vídeo to_watch\|watching\|watched (padrão to_watch, valores do protótipo), com filtro ?reading_status= em /books e ?watch_status= em /videos, colunas e índices editados na migração no próprio arquivo; PD-37: canal opcional do vídeo (até 300, na busca); novo passo 13 com testes pd35_/pd37_ antes do código, Ler, Mudar, passos 2 e 9, Verificação, evidência library-statuses.txt, Concluída quando, Detalhes técnicos e card; Baseline inalterado |
