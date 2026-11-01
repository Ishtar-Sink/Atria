---
id: TASK-12
spec: SPEC-002
title: "Editar e excluir destaques no servidor"
profile: julgamento
persona: desenvolvedor
depends_on: []
wave: 1
covers: [RF-32, CT-31]
type: tarefa
labels: [SPEC-002, julgamento]
status: done
content_hash: 886db0ee4b7d94e4b14d7156cfc8736e27308bdecdc7c1f0b66c425703ac189c
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 97c3f74592a49c5abb8eb9c3e14c5230134bc3eb0a3a1de87e707b96670741da
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-opus-5-5
---

# TASK-12: Editar e excluir destaques no servidor

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Acervo e leitor: destaques só têm GET e POST, `highlights` sem `deleted_at`), RF-32, CT-31, RN-08, RNF-01, os contratos `PATCH`/`DELETE /books/{id}/highlights/{highlight_id}` e `/articles/{id}/highlights/{highlight_id}` e a migração `20261102010003_add-highlights-deleted-at.sql` em "Contratos e interfaces", e a decisão 16 (inferência H) do "Registro de decisões".
- `vostok/rules/project/api.md`: [project/api-01], [project/api-02] e [project/api-03].
- `vostok/rules/project/database.md`: [project/database-08].
- `vostok/rules/project/code-style.md`: [project/code-style-03], [project/code-style-07] e [project/code-style-11].
- `vostok/rules/project/testing.md`: [project/testing-02], [project/testing-03] e [project/testing-09].
- `vostok/memory/knowledge.md` (KNW-007 e KNW-009): uma compilação pesada por vez e como regenerar a `.sqlx`.
- `apps/server/src/library/migrations/20261101130001_create-library.sql` (linhas 17 a 30 e 175 a 240): `library_files`, `books`, `highlights` e RLS.
- `apps/server/src/library/domain/highlight.rs`: `HighlightColor`, `Highlight`, `Highlight::new` e `is_from_current_file`.
- `apps/server/src/library/domain/error.rs`: `LibraryError` (`ItemNoteNotFound`, `HighlightFileMismatch`).
- `apps/server/src/library/application/mod.rs` (struct `ItemOps`, fns `update_note`, `delete_note`, `list_highlights` e `create_highlight`, linhas 120 a 300): molde de editar e excluir.
- `apps/server/src/library/application/ports.rs` (trait `ItemRepository`, linhas 160 a 225).
- `apps/server/src/library/infrastructure/pg_item_notes.rs` (struct `HighlightRow`, fns `note_keys`, `update_note`, `delete_note`, `insert_highlight` e `list_highlights`).
- `apps/server/src/library/interface/mod.rs` (impl `From<LibraryError> for ApiError`, macro `child_extractor`, fn `router` e fns `update_note_of`, `delete_note_of`, `list_highlights_of` e `create_highlight_of`).
- `apps/server/src/library/interface/books.rs` (fns `update_book_note`, `delete_book_note`, `list_book_highlights` e `create_book_highlight`, linhas 384 a 493) e `apps/server/src/library/interface/articles.rs` (fns de notas e destaques de artigo).
- `apps/server/src/library/interface/dto.rs` (structs `CreateHighlightRequest`, `HighlightResponse` e `HighlightList`, linhas 440 a 491).
- `apps/server/src/library/interface/openapi.rs`: lista de `paths` e `schemas` do `LibraryApi`.
- `apps/server/src/library/tests/mod.rs` (`Harness`, `ALICE`, `BOB`, `minimal_pdf`, `book_body`, `create_book`, `create_article`, `upload_ok`) e `apps/server/src/library/tests/books.rs` (fns `rect`, `book_with_pdf` e `highlight`, teste `ct38_book_highlights_with_two_colors_are_listed`).
- `apps/server/src/reports/infrastructure/mod.rs` (fn que monta a tabela `highlights` da exportação, linhas 1530 a 1570): usa `list_highlights` e passa a não exportar os excluídos.
- `apps/server/src/http/tests/routes.rs` (teste `every_openapi_path_is_routed`): toda rota documentada precisa estar montada.

### Mudar

- `apps/server/src/library/migrations/20261102010003_add-highlights-deleted-at.sql` (criar): `ALTER TABLE highlights ADD COLUMN deleted_at TIMESTAMPTZ NULL`, só acrescentando a coluna (RNF-01).
- `apps/server/src/library/domain/highlight.rs` (alterar): troca de cor do destaque, com teste unitário (RF-32).
- `apps/server/src/library/application/mod.rs` (alterar): casos de uso `update_highlight` e `delete_highlight` em `ItemOps` (RF-32, RN-08).
- `apps/server/src/library/application/ports.rs` (alterar): `find_highlight`, `update_highlight_color` e `soft_delete_highlight` em `ItemRepository`.
- `apps/server/src/library/infrastructure/pg_item_notes.rs` (alterar): listagem sem os excluídos, busca, troca de cor e exclusão lógica do destaque.
- `apps/server/src/library/interface/books.rs` (alterar): handlers `update_book_highlight` e `delete_book_highlight`.
- `apps/server/src/library/interface/articles.rs` (alterar): handlers `update_article_highlight` e `delete_article_highlight`.
- `apps/server/src/library/interface/dto.rs` (alterar): `UpdateHighlightRequest` com a cor.
- `apps/server/src/library/domain/error.rs` (alterar): `LibraryError::HighlightNotFound`; necessário para o 404 `highlight_not_found` das rotas novas.
- `apps/server/src/library/interface/mod.rs` (alterar): rotas `PATCH`/`DELETE` de `/books/{id}/highlights/{highlight_id}` e `/articles/{id}/highlights/{highlight_id}`, funções comuns `update_highlight_of` e `delete_highlight_of` e o 404 `highlight_not_found`; necessário para as rotas existirem (a TASK-13 muda o mesmo arquivo depois, na onda 2).
- `apps/server/src/library/interface/openapi.rs` (alterar): documenta as quatro operações novas e o `UpdateHighlightRequest` ([project/development-methodology-03]).
- `apps/server/src/library/tests/highlights.rs` (criar): testes de integração de trocar a cor e excluir destaques e da migração sobre dados existentes.
- `apps/server/src/library/tests/mod.rs` (alterar): declara `mod highlights;`.
- `.sqlx` (alterar): dados offline das queries alteradas e novas, regenerados com `cargo sqlx prepare --workspace` (KNW-009).

### Passos

1. Leia os arquivos de "Ler". Não rode outra compilação do `atria-server` em paralelo (KNW-007).
2. Crie `apps/server/src/library/migrations/20261102010003_add-highlights-deleted-at.sql` com um comentário em pt-br (exclusão lógica do destaque, RN-08) e só `ALTER TABLE highlights ADD COLUMN deleted_at TIMESTAMPTZ NULL;`.
3. Suba o PostgreSQL só para as macros e aplique as migrações com o binário compilado offline, antes de mudar qualquer query:
   - `docker rm -f atria-sqlx-postgres 2>/dev/null; docker run -d --name atria-sqlx-postgres --shm-size=512m -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17-alpine` e espere `docker exec atria-sqlx-postgres pg_isready -U postgres` responder `accepting connections`.
   - `SQLX_OFFLINE=true ATRIA_DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres ATRIA_PUBLIC_URL=http://localhost ATRIA_ENCRYPTION_KEY_FILE=/dev/null cargo run -q -p atria-server -- migrate`.
   - Nos passos 6 a 10, rode os comandos `cargo` com `DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres` no ambiente.
4. Testes primeiro, em `apps/server/src/library/tests/highlights.rs` (com `//!` em pt-br citando RF-32, RN-08 e RNF-01; copie de `books.rs` os auxiliares `rect` e o de criar livro com PDF, e escreva o de criar artigo com PDF como em `articles.rs`), e declare `mod highlights;` em `apps/server/src/library/tests/mod.rs`, em ordem alfabética:
   - `ct31_book_highlight_color_changes`: cria um destaque `accent`; `PATCH /api/v1/books/{id}/highlights/{highlight_id}` com `{ "color": "warning" }` devolve 200 com `color` `warning` e os mesmos `text`, `page` e `rects`; a listagem mostra `warning`.
   - `ct31_article_highlight_color_changes`: o mesmo em `/api/v1/articles/{id}/highlights/{highlight_id}`.
   - `ct31_deleted_book_highlight_leaves_lists_and_keeps_deleted_at`: `DELETE` devolve 204; a listagem do livro não tem mais o destaque; lendo a linha por SQL com `begin_for_user(&h.ctx.state.pool, ALICE)` (`SELECT deleted_at FROM highlights WHERE id = $1`), ela existe com `deleted_at` preenchido.
   - `ct31_deleted_article_highlight_leaves_lists`: o mesmo no artigo.
   - `deleted_highlight_cannot_be_changed_or_deleted_again`: depois do `DELETE`, `PATCH` e `DELETE` do mesmo id devolvem 404 com `code` `highlight_not_found`.
   - `highlight_of_other_item_or_user_returns_404`: o Bob recebe 404 em `PATCH` e `DELETE` do destaque da Alice; a Alice recebe 404 `highlight_not_found` ao usar o id do destaque do livro no caminho de outro livro dela.
   - `invalid_highlight_color_is_rejected`: `PATCH` com `{ "color": "danger" }` e com `{ "color": "warning", "text": "x" }` devolve 422 `validation_failed`.
   - `rnf01_highlights_migration_keeps_existing_rows`: com `TestContext::new()`, rode `library::migrator()` sem a versão nova (`let mut before = library::migrator(); before.migrations = std::borrow::Cow::Owned(before.migrations.iter().filter(|m| m.version < 20261102010003).cloned().collect());`); dentro de `begin_for_user(pool, ALICE)`, grave por `sqlx::query` com `.bind` um `library_files` (`kind` `pdf`, `content_type` `application/pdf`, `size_bytes` 10, `sha256` qualquer, `storage_key` `library/<owner>/<id>`), um `books` com esse `pdf_file_id` e dois `highlights` desse livro e arquivo; conte as linhas de `highlights`, rode `library::migrator()` inteiro e confira a mesma contagem, as mesmas cores e textos e `deleted_at IS NULL` nas duas.
   Rode `cargo test -p atria-server library::tests::highlights` e confira que os testes falham.
5. No domínio:
   - Em `apps/server/src/library/domain/error.rs`, acrescente `HighlightNotFound` a `LibraryError`, com a mensagem `#[error("destaque não encontrado")]`, ao lado de `ItemNoteNotFound`.
   - Em `apps/server/src/library/domain/highlight.rs`, acrescente `pub fn recolor(&mut self, color: HighlightColor)` (o destaque guarda só a cor que muda; texto, página e retângulos ficam) e o teste `recolor_changes_only_the_color` no `mod tests` do arquivo.
6. Em `apps/server/src/library/application/ports.rs`, acrescente a `ItemRepository`: `fn find_highlight(&self, owner_id: Uuid, item: ItemRef, id: Uuid) -> impl Future<Output = Result<Option<Highlight>, LibraryError>> + Send;` (só o vivo do item), `fn update_highlight_color(&self, highlight: &Highlight, now: DateTime<Utc>) -> impl Future<Output = Result<bool, LibraryError>> + Send;` e `fn soft_delete_highlight(&self, owner_id: Uuid, item: ItemRef, id: Uuid, now: DateTime<Utc>) -> impl Future<Output = Result<bool, LibraryError>> + Send;` (doc: marca `deleted_at`; `false` se não existe ou já foi excluído).
7. Em `apps/server/src/library/infrastructure/pg_item_notes.rs`:
   - `list_highlights`: acrescente `AND deleted_at IS NULL` ao `WHERE`.
   - `find_highlight`: o mesmo `SELECT` de `list_highlights` com `AND id = $4 AND deleted_at IS NULL`, por `fetch_optional`.
   - `update_highlight_color`: `UPDATE highlights SET color = $1, updated_at = $2 WHERE owner_id = $3 AND id = $4 AND book_id IS NOT DISTINCT FROM $5 AND article_id IS NOT DISTINCT FROM $6 AND deleted_at IS NULL`, devolvendo `rows_affected() == 1`.
   - `soft_delete_highlight`: `UPDATE highlights SET deleted_at = $1, updated_at = $1 WHERE owner_id = $2 AND id = $3 AND book_id IS NOT DISTINCT FROM $4 AND article_id IS NOT DISTINCT FROM $5 AND deleted_at IS NULL`, devolvendo `rows_affected() == 1`.
   Todas dentro de `begin_for_user` e com `note_keys(item)`, como as de notas.
8. Em `apps/server/src/library/application/mod.rs`, acrescente a `ItemOps`, depois de `create_highlight`:
   - `pub async fn update_highlight(&self, owner_id: Uuid, item: ItemRef, id: Uuid, color: HighlightColor) -> Result<HighlightView, LibraryError>`: `ensure_item` (guarda o PDF atual), `find_highlight` ou `HighlightNotFound`, `recolor`, `update_highlight_color` (falso vira `HighlightNotFound`) e devolve `HighlightView` com `is_current_file: highlight.is_from_current_file(current)`.
   - `pub async fn delete_highlight(&self, owner_id: Uuid, item: ItemRef, id: Uuid) -> Result<(), LibraryError>`: `ensure_item` e `soft_delete_highlight` com `self.env.clock.now()`; falso vira `HighlightNotFound`.
9. Na interface:
   - `dto.rs`: `#[derive(Debug, Clone, Deserialize, ToSchema)] #[serde(deny_unknown_fields)] pub struct UpdateHighlightRequest { pub color: HighlightColor }`, com doc "Só a cor muda; texto, página e retângulos ficam".
   - `mod.rs`: no `From<LibraryError>`, `LibraryError::HighlightNotFound => Self::not_found("highlight_not_found")`; funções `pub(crate) async fn update_highlight_of(state, owner_id, item, highlight_id, body: UpdateHighlightRequest) -> Result<Json<HighlightResponse>, ApiError>` e `pub(crate) async fn delete_highlight_of(state, owner_id, item, highlight_id) -> Result<StatusCode, ApiError>` (204), ao lado de `create_highlight_of`; em `router()`, `.route("/books/{id}/highlights/{highlight_id}", patch(books::update_book_highlight).delete(books::delete_book_highlight))` e o mesmo para artigos, logo depois das rotas de listagem de destaques.
   - `books.rs` e `articles.rs`: `update_*_highlight` e `delete_*_highlight` com `BookChild(id, highlight_id)` / `ArticleChild(id, highlight_id)`, chamando as funções comuns, e o `#[utoipa::path]` com `params` `id` e `highlight_id`, `request_body = UpdateHighlightRequest` no `patch` e as respostas `200` `HighlightResponse` (ou `204`), `404` (`book_not_found` ou `article_not_found` e `highlight_not_found`) e `422` `validation_failed` no `patch`.
   - `openapi.rs`: acrescente as quatro funções aos `paths` (depois de `create_book_highlight` e `create_article_highlight`) e `UpdateHighlightRequest` aos `schemas`.
10. Rode `cargo test -p atria-server library::` até passar, com `DATABASE_URL` do passo 3.
11. Regenere os dados offline: `cp -a .sqlx "${TMPDIR:-/tmp}/atria-sqlx-backup-task12"` e, com `DATABASE_URL`, `cargo sqlx prepare --workspace`. Se falhar, restaure com `rm -rf .sqlx && cp -a "${TMPDIR:-/tmp}/atria-sqlx-backup-task12" .sqlx`, corrija e repita. Tire `DATABASE_URL` do ambiente, remova o banco das macros (`docker rm -f atria-sqlx-postgres`) e confira que `SQLX_OFFLINE=true cargo build -p atria-server` compila.
12. Rode `cargo fmt` e a Verificação inteira, sem `DATABASE_URL` no ambiente.

### Baseline

- `cargo test -p atria-server library:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server reports:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
test -z "$(git status --porcelain -- apps/server/src/library/migrations/20261101130001_create-library.sql)"
# evidência: highlight-tests.txt
cargo test -p atria-server -- library::tests::highlights library::domain::highlight::tests::recolor
cargo test -p atria-server library::
cargo test -p atria-server reports::
cargo test -p atria-server http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` regenerada, a migração antiga intocada e `test result: ok` nos testes dos destaques, do Acervo, dos relatórios e do `http`, inclusive `every_openapi_path_is_routed` com as quatro operações novas.

### Evidências

- `highlight-tests.txt` (automática, da verificação)
  - Prova: trocar a cor de um destaque de livro e de artigo muda só a cor; excluir tira o destaque das listas e mantém a linha no banco com `deleted_at`; o excluído não é editado de novo; outra pessoa e outro item recebem 404; cor inválida é recusada; e a migração só acrescenta a coluna, sem mexer nos destaques existentes (RF-32, CT-31, RN-08, RNF-01).
  - Trecho: as linhas `test library::tests::highlights::ct31_book_highlight_color_changes ... ok`, `ct31_article_highlight_color_changes ... ok`, `ct31_deleted_book_highlight_leaves_lists_and_keeps_deleted_at ... ok`, `highlight_of_other_item_or_user_returns_404 ... ok`, `rnf01_highlights_migration_keeps_existing_rows ... ok` e `test library::domain::highlight::tests::recolor_changes_only_the_color ... ok`, e `test result: ok. 9 passed`.
  - Falha: `FAILED`, `test result: FAILED` ou `running 0 tests` (testes ausentes).

### Concluída quando

- [x] A pessoa troca a cor de um destaque de livro e de artigo, e só a cor muda (RF-32, CT-31).

  > Como comprovar: em `highlight-tests.txt`, ver `ct31_book_highlight_color_changes`, `ct31_article_highlight_color_changes` e `recolor_changes_only_the_color` com `ok`.

- [x] Excluir um destaque o tira do leitor e das listas, e a linha continua no banco com `deleted_at` preenchido (RF-32, CT-31, RN-08).

  > Como comprovar: em `highlight-tests.txt`, ver `ct31_deleted_book_highlight_leaves_lists_and_keeps_deleted_at`, `ct31_deleted_article_highlight_leaves_lists` e `deleted_highlight_cannot_be_changed_or_deleted_again` com `ok`.

- [x] Destaque de outra pessoa ou de outro item responde 404, e cor fora das cinco do tema responde 422 (RF-32).

  > Como comprovar: em `highlight-tests.txt`, ver `highlight_of_other_item_or_user_returns_404` e `invalid_highlight_color_is_rejected` com `ok`.

- [x] A migração só acrescenta a coluna `deleted_at`, nula, e os destaques que já existiam continuam iguais depois dela (RNF-01, RN-08).

  > Como comprovar: em `highlight-tests.txt`, ver `rnf01_highlights_migration_keeps_existing_rows ... ok`; abrir a migração nova e ver só o `ALTER TABLE ... ADD COLUMN`.

- [x] As quatro operações novas estão no OpenAPI e montadas no servidor, que compila sem banco com os dados offline regenerados, sem aviso de formatação ou do clippy, e os testes do Acervo, dos relatórios e do `http` continuam passando (RF-32).

  > Como comprovar: rodar a Verificação e ver `test http::tests::routes::every_openapi_path_is_routed ... ok` na saída de `cargo test -p atria-server http::tests::` e todos os comandos terminarem sem erro.

## Descrição

### Resumo executivo

O servidor passa a permitir trocar a cor de um destaque e excluí-lo, nos livros e nos artigos.
O destaque excluído some do leitor e das listas, mas fica guardado no banco, como as demais exclusões do app.
Perfil julgamento: mexe no banco de produção (só acrescenta uma coluna) e cria quatro operações novas no contrato.
Desbloqueia o envio parcial de arquivos (TASK-13), a geração do contrato (TASK-15) e a tela de destaques (TASK-25).

### Detalhes técnicos

**Abordagem.** Coluna nova `highlights.deleted_at` (nula), listagem filtrando os vivos, e `PATCH` (só `color`) e `DELETE` (lógico) em `/books/{id}/highlights/{highlight_id}` e `/articles/{id}/highlights/{highlight_id}`, no mesmo molde das notas de item: handler fino por tipo de item, função comum em `interface/mod.rs` e caso de uso em `ItemOps`, que confere o item antes do destaque.

**Decisões (perfil julgamento: alternativas e critério).**

| Decisão | Escolhida | Alternativas descartadas | Critério |
|---|---|---|---|
| Exclusão | Lógica, com `deleted_at` | Definitiva (`DELETE FROM`) | Inferência H e RN-08; [project/database-08]. |
| O que o `PATCH` muda | Só `color`, com `deny_unknown_fields` | Também texto, página e retângulos | O contrato só tem `color`; os demais vêm da seleção no PDF e não são editáveis. |
| Erro do destaque inexistente | 404 `highlight_not_found` | Reaproveitar `item_note_not_found` | Código estável próprio ([project/api-03]); o item inexistente continua `book_not_found` ou `article_not_found`. |
| Onde montar as rotas | Nesta tarefa, em `interface/mod.rs` e `interface/openapi.rs` | Deixar a montagem e a documentação para a TASK-13 (que também lista esses arquivos) | Sem a montagem os handlers ficam inalcançáveis e os testes de integração e o `every_openapi_path_is_routed` não comprovam a entrega; a TASK-13 depende desta e muda os mesmos arquivos depois, só na parte de arquivos. |
| Exportação de dados | Passa a não incluir os excluídos, porque usa `list_highlights` | Exportar os excluídos | RN-08: o excluído some das listas; a exportação é uma lista do usuário. |

**Componentes fora do plano.** `domain/error.rs` (variante nova), `interface/mod.rs` e `interface/openapi.rs` (rotas e documentação), `tests/highlights.rs` e `tests/mod.rs` (testes) e `.sqlx` (dados offline das queries, KNW-009) entram em "Mudar" porque a entrega não compila ou não é alcançável sem eles.

**Riscos técnicos.** Falha no `cargo sqlx prepare` apaga a `.sqlx` (backup no passo 11). A migração roda em produção: o teste `rnf01_*` aplica a versão nova sobre destaques já gravados. O extrator `BookChild`/`ArticleChild` trata um `highlight_id` malformado como item inexistente (404 do item), como nas notas.

**Referências da spec.** RF-32, CT-31, RN-08, RNF-01; contratos `PATCH`/`DELETE` de destaques; decisão 16 (inferência H).

**Arquivos em comum na onda 1.** `.sqlx` com a TASK-09 e a TASK-11 (as três regeneram os dados offline: executar em sequência, cada uma com a migração da anterior já aplicada no banco das macros). As demais tarefas de servidor da onda compilam o `atria-server` e rodam uma por vez (KNW-007). `interface/mod.rs` e `interface/openapi.rs` são mudados de novo pela TASK-13, na onda 2.

### Card

- **Título:** Editar e excluir destaques no servidor
- **Tipo:** tarefa
- **Descrição:** Destaques de livros e artigos ganham `PATCH` de cor e `DELETE` lógico no servidor, documentados no OpenAPI, com uma migração que só acrescenta a coluna `deleted_at`.
- **Critérios de aceite:**
  - [ ] Trocar a cor de um destaque de livro e de artigo muda só a cor.
  - [ ] O destaque excluído some das listas e fica no banco com `deleted_at`.
  - [ ] Outra pessoa ou outro item recebe 404; cor inválida recebe 422.
  - [ ] A migração só acrescenta a coluna e preserva os destaques existentes.
  - [ ] Rotas novas documentadas e montadas; build offline, fmt, clippy e testes sem falha.
- **Rótulos:** SPEC-002, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 com acréscimo |
| 5 | 2026-11-01 | evidências | passed | 1 evidência(s) em evidence/TASK-12/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
