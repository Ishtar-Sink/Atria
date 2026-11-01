### Ler

- `vostok/work/specs/refined/SPEC-003-financeiro-pronto-para-o-lancamento.md`: "Estado atual" (Cores), RF-19, RF-20, RN-09, CT-13, CT-14, RNF-01, os contratos `HighlightResponse.color`, `CreateHighlightRequest.color` e `UpdateHighlightRequest.color` e a migração `20261103010003_highlights-color-hex.sql` em "Contratos e interfaces", e as decisões 10 (inferência B) e 12 (inferência D) do "Registro de decisões".
- `docs/decisoes-do-prototipo.md`: PD-12 (a cor gravada é um HEX livre).
- `vostok/rules/project/database.md`: [project/database-05] e [project/database-09].
- `vostok/rules/project/development-methodology.md`: [project/development-methodology-02] e [project/development-methodology-03].
- `vostok/rules/project/code-style.md`: [project/code-style-03], [project/code-style-07] e [project/code-style-11].
- `vostok/rules/project/testing.md`: [project/testing-01], [project/testing-02], [project/testing-03] e [project/testing-07].
- `vostok/memory/knowledge.md` (KNW-007 e KNW-009): uma compilação pesada do servidor por vez e como lidar com a `.sqlx`.
- `vostok/work/tasks/SPEC-003/TASK-05/execucao.md`: a mesma conversão feita nas categorias (tabela de HEX, migração com `NO FORCE ROW LEVEL SECURITY` e testes `ct12_`, `rn09_` e `rnf01_`), que esta tarefa repete nos destaques.
- `apps/server/src/projects/domain/lane.rs`: `LaneColor::parse`, `as_str` e o teste `lane_color_accepts_only_hex_rrggbb`, o molde da cor HEX.
- `packages/theme/src/tokens.css` (linhas 12 a 31, primeiro bloco, tema claro): `--primary`, `--accent`, `--success`, `--warning` e `--info`.
- `apps/server/src/library/migrations/20261101130001_create-library.sql` (linhas 175 a 193 e 233 a 240): tabela `highlights`, `CHECK (color IN (...))` na linha 183 (nome gerado `highlights_color_check`), `FORCE ROW LEVEL SECURITY` e a política `highlights_owner_isolation`.
- `apps/server/src/library/migrations/20261102010003_add-highlights-deleted-at.sql`: coluna `deleted_at`.
- `apps/server/src/shared/test_support.rs` (fn `create_app_role`, `test_pool`): os testes rodam as migrações com o papel `atria_app`, dono das tabelas, sem superusuário e sem `BYPASSRLS`.
- `apps/server/src/library/domain/highlight.rs`: `HighlightColor`, `Highlight`, `NewHighlight`, `recolor` e o `mod tests` (`new_highlight`, `highlight_color_accepts_only_palette`, `recolor_changes_only_the_color`).
- `apps/server/src/library/application/mod.rs` (struct `HighlightInput`, linhas 120 a 130; fns `create_highlight` e `update_highlight`, linhas 266 a 325).
- `apps/server/src/library/infrastructure/pg_item_notes.rs` (struct `HighlightRow`, fn `into_highlight`, fns `insert_highlight` e `update_highlight_color`): já leem e gravam a cor por `HighlightColor::parse` e `as_str()`, sem mudar.
- `apps/server/src/library/interface/dto.rs` (structs `CreateHighlightRequest`, `UpdateHighlightRequest` e `HighlightResponse`, linhas 445 a 498).
- `apps/server/src/library/interface/mod.rs` (fns `create_highlight_of` e `update_highlight_of`, linhas 540 a 570): passam `body.color` ao caso de uso e continuam iguais.
- `apps/server/src/library/interface/openapi.rs`: `use` e lista de `schemas` com `HighlightColor`.
- `apps/server/src/library/tests/mod.rs` (`Harness`, `create`, `expect`, `get`, `ALICE`, `BOB`, `minimal_pdf`, `book_body`).
- `apps/server/src/library/tests/highlights.rs`: auxiliares `rect`, `book_with_pdf`, `article_with_pdf`, `highlight`, `id_of` e `assert_color_changes`, e os testes `invalid_highlight_color_is_rejected` e `rnf01_highlights_migration_keeps_existing_rows`.
- `apps/server/src/library/tests/books.rs` (fn `highlight` e testes `ct38_book_highlights_with_two_colors_are_listed`, `cb19_highlights_of_replaced_pdf_are_marked_as_other_file`, `highlight_on_book_without_pdf_is_rejected` e a lista de rotas perto da linha 528) e `apps/server/src/library/tests/articles.rs` (linhas 190 a 215 e 298 a 308): cores por nome nos corpos.
- `apps/server/src/reports/infrastructure/mod.rs` (busque por `highlights_table` e `highlight.color.as_str()`, perto das linhas 1372 e 1564): a exportação grava `highlight.color.as_str()` e passa a exportar o HEX sem mudar o código.

### Mudar

- `apps/server/src/library/migrations/20261103010003_highlights-color-hex.sql` (criar): converte as cores por nome dos destaques no HEX do tema claro e troca o `CHECK` por `^#[0-9a-f]{6}$` (RF-20, RN-09, CT-14).
- `apps/server/src/library/domain/highlight.rs` (alterar): `HighlightColor` vira HEX `#rrggbb` em minúsculas, sem `Serialize`, `Deserialize` nem `ToSchema` (RF-19, RN-09).
- `apps/server/src/library/application/mod.rs` (alterar): `HighlightInput.color` e `update_highlight` recebem a cor em texto e a validam com `HighlightColor::parse` (RF-19).
- `apps/server/src/library/interface/dto.rs` (alterar): `color` passa a `String` em `CreateHighlightRequest`, `UpdateHighlightRequest` e `HighlightResponse` (RF-19).
- `apps/server/src/library/interface/openapi.rs` (alterar): tira `HighlightColor` do `use` e dos `schemas` ([project/development-methodology-03]).
- `apps/server/src/library/tests/highlights.rs` (alterar): testes da cor HEX, da recusa de nomes, das minúsculas e da migração, e cores HEX nos testes existentes (RF-19, RF-20, CT-13, CT-14).
- `apps/server/src/library/tests/books.rs` (alterar): cores HEX nos destaques; necessário porque cor por nome passa a ser recusada.
- `apps/server/src/library/tests/articles.rs` (alterar): cores HEX nos destaques; necessário pelo mesmo motivo.

### Passos

Tabela de conversão usada em todos os passos (tokens do tema claro em `packages/theme/src/tokens.css`, a mesma da TASK-05): `accent` → `#0e7490`, `primary` → `#6d28d9`, `success` → `#047857`, `warning` → `#92400e`, `info` → `#0369a1`.

1. Leia os arquivos de "Ler". Confira em `vostok task status SPEC-003` que a TASK-05 está `done`; se não estiver, **PARE** e registre o bloqueio. Não rode outra compilação do `atria-server` em paralelo (KNW-007). Nenhuma query muda de texto nesta tarefa, então a `.sqlx` não é regenerada.
2. `apps/server/src/library/migrations/20261103010003_highlights-color-hex.sql` (criar), com um comentário em pt-br no topo (cor do destaque em HEX `#rrggbb` livre, PD-12, RF-19; cada tom antigo vira o HEX do token do tema claro, RF-20, inferência B; sempre minúsculas, RN-09; o `NO FORCE` temporário deixa o dono da tabela, que roda a migração, atualizar os destaques de todas as pessoas apesar da RLS) e exatamente:
   ```sql
   ALTER TABLE highlights DROP CONSTRAINT highlights_color_check;
   ALTER TABLE highlights NO FORCE ROW LEVEL SECURITY;
   UPDATE highlights SET color = CASE color
       WHEN 'accent' THEN '#0e7490'
       WHEN 'primary' THEN '#6d28d9'
       WHEN 'success' THEN '#047857'
       WHEN 'warning' THEN '#92400e'
       WHEN 'info' THEN '#0369a1'
       ELSE color
   END;
   ALTER TABLE highlights FORCE ROW LEVEL SECURITY;
   ALTER TABLE highlights ADD CONSTRAINT highlights_color_check CHECK (color ~ '^#[0-9a-f]{6}$');
   ```
   Não edite `20261101130001_create-library.sql` nem `20261102010003_add-highlights-deleted-at.sql`. Confira: `git status --porcelain -- apps/server/src/library/migrations` lista só o arquivo novo como `??`.
3. Testes primeiro, em `apps/server/src/library/tests/highlights.rs`. No topo, acrescente `const THEME_HEX: [(&str, &str); 5] = [("accent", "#0e7490"), ("primary", "#6d28d9"), ("success", "#047857"), ("warning", "#92400e"), ("info", "#0369a1")];` com o comentário "Tons antigos e o HEX do tema claro (RF-20)" e atualize o `//!` citando RF-19, RF-20, RN-09 e CT-14. Escreva:
   - `ct13_book_highlight_is_created_and_recolored_with_hex`: `POST /api/v1/books/{id}/highlights` com `"color": "#1a2b3c"` devolve 201 com `color` `#1a2b3c`; `PATCH /api/v1/books/{id}/highlights/{highlight_id}` com `{ "color": "#ffcc00" }` devolve 200 com `color` `#ffcc00` e os mesmos `text`, `page` e `rects`; a listagem mostra `#ffcc00`.
   - `ct13_article_highlight_is_created_and_recolored_with_hex`: o mesmo em `/api/v1/articles/{id}/highlights`.
   - `rn09_highlight_color_is_stored_in_lowercase`: `POST` com `"color": "#AABBCC"` devolve `color` `#aabbcc`; lendo por SQL com `begin_for_user(&h.ctx.state.pool, ALICE)` (`SELECT color FROM highlights WHERE id = $1`), a coluna é `#aabbcc`; `PATCH` com `"#00FF7F"` devolve `#00ff7f`.
   - `named_highlight_color_is_rejected`: `POST` com cada cor de `["accent", "#fff", "#12345g", "123456", ""]` devolve 422 com `code` `validation_failed` e `errors[0]` igual a `{ "field": "color", "code": "invalid" }`; `PATCH` de um destaque existente com `{ "color": "primary" }` devolve 422 com o mesmo erro, e a listagem continua com a cor anterior.
   - `rnf01_highlight_color_migration_converts_names_to_hex`: copie a montagem de `rnf01_highlights_migration_keeps_existing_rows` (arquivo e livro por SQL), com o filtro `migration.version < 20261103010003`; grave um destaque por item de `THEME_HEX` (`id` `Uuid::from_u128(10 + índice)`, `text` `format!("trecho {índice}")`, `color` o nome), com `deleted_at` `CASE WHEN $8 THEN now() END` e `$8` `true` só no último (excluído); conte as linhas; rode `library::migrator()` inteiro; leia `SELECT color FROM highlights ORDER BY id` e confira a mesma contagem (5) e as cores iguais aos HEX de `THEME_HEX`, na ordem, todas com 7 caracteres, começando por `#` e só com `0-9a-f`; depois, numa transação nova da Alice, confira que `INSERT` de um destaque com `color` `'accent'` falha (o `CHECK` novo) e descarte essa transação sem `commit`.
   - No `mod tests` de `apps/server/src/library/domain/highlight.rs`, troque `highlight_color_accepts_only_palette` por `highlight_color_accepts_only_hex_rrggbb` (`parse("#1A2b3C")` dá `as_str()` `#1a2b3c`; `parse` de `"accent"`, `"#fff"`, `"#12345g"`, `"123456"`, `"#1234567"` e `""` dá `Err(LibraryError::Validation { .. })`).
   Rode `cargo test -p atria-server library::tests::highlights` e confira que os testes novos falham (ou não compilam).
4. `apps/server/src/library/domain/highlight.rs` (alterar):
   - Troque o enum por `/// Cor do destaque: HEX `#rrggbb` livre (PD-12, RF-19), sempre em minúsculas (RN-09).` `#[derive(Debug, Clone, PartialEq, Eq)] pub struct HighlightColor(String);`, com `pub fn parse(text: &str) -> Result<Self, LibraryError>` igual a `LaneColor::parse` (sem `#` e seis dígitos HEX, senão `LibraryError::validation("color", "invalid")`; guarda `text.to_ascii_lowercase()`) e `pub fn as_str(&self) -> &str`. Tire `Serialize`, `Deserialize` e `ToSchema` só de `HighlightColor` (o `HighlightRect` continua com eles).
   - No `mod tests`: `new_highlight` usa `HighlightColor::parse("#0e7490").unwrap()`; `recolor_changes_only_the_color` usa `HighlightColor::parse("#92400e").unwrap()` e `color: original.color.clone()` no `Highlight { .. }` da comparação. Confira: `cargo test -p atria-server library::domain::highlight`.
5. `apps/server/src/library/application/mod.rs` (alterar): `HighlightInput.color` passa a `String`; em `create_highlight`, `let color = HighlightColor::parse(&input.color)?;` como primeira linha, e o `NewHighlight` recebe `color`; `update_highlight` recebe `color: String` e começa com `let color = HighlightColor::parse(&color)?;`. `apps/server/src/library/interface/mod.rs` não muda: `body.color` já é a `String` do pedido.
6. `apps/server/src/library/interface/dto.rs` (alterar): tire `HighlightColor` do `use` da linha 11; `CreateHighlightRequest.color: String` e `UpdateHighlightRequest.color: String`, com `/// HEX `#rrggbb`; guardado em minúsculas (RN-09).` e `#[schema(example = "#0e7490")]`; `HighlightResponse.color: String` (`highlight.color.as_str().to_owned()`), com o doc "HEX `#rrggbb`".
7. `apps/server/src/library/interface/openapi.rs` (alterar): tire `HighlightColor` do `use` da linha 16 e da lista de `schemas`.
8. Testes existentes, trocando cada cor por nome pelo HEX da tabela do início, sem renomear nenhum teste:
   - `apps/server/src/library/tests/highlights.rs`: o auxiliar `highlight` usa `#0e7490`; `assert_color_changes` usa `#92400e` no `PATCH` e nas conferências; os `{ "color": "info" }` viram `#0369a1`; a conferência `list["items"][0]["color"]` de `highlight_of_other_item_or_user_returns_404` passa a `#0e7490`; em `invalid_highlight_color_is_rejected`, `{ "color": "danger" }` fica (nome continua inválido) e `{ "color": "warning", "text": "x" }` vira `{ "color": "#92400e", "text": "x" }` (campo desconhecido); em `rnf01_highlights_migration_keeps_existing_rows`, os nomes gravados antes continuam `accent` e `info`, e o resultado esperado depois de todas as migrações passa a `("#0e7490", "primeiro", true)` e `("#0369a1", "segundo", true)`.
   - `apps/server/src/library/tests/books.rs`: em `ct38_book_highlights_with_two_colors_are_listed`, `#0e7490` e `#92400e` nas chamadas e na conferência de `colors`; os `"info"` viram `#0369a1`.
   - `apps/server/src/library/tests/articles.rs`: `"success"` vira `#047857`, `"primary"` vira `#6d28d9` e `"info"` vira `#0369a1`.
   Confira: `grep -nE '"(primary|accent|success|warning|info)"' apps/server/src/library/tests/books.rs apps/server/src/library/tests/articles.rs` não lista nada, e em `highlights.rs` sobram só o `THEME_HEX` e os nomes gravados antes da migração em `rnf01_highlights_migration_keeps_existing_rows`.
9. `apps/server/src/library/infrastructure/pg_item_notes.rs` e `apps/server/src/reports/infrastructure/mod.rs` não mudam: `HighlightColor::parse` e `as_str()` mantêm a assinatura, e a exportação passa a gravar o HEX. Rode `cargo test -p atria-server library::` e `cargo test -p atria-server reports::` até passarem.
10. Rode `cargo fmt` e a Verificação inteira, sem `DATABASE_URL` no ambiente.
