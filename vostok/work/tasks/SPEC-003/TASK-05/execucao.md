### Ler

- `vostok/work/specs/refined/SPEC-003-financeiro-pronto-para-o-lancamento.md`: "Estado atual" (Cores), RF-18, RF-20, RN-09, CT-12, CT-14, CB-09, RNF-01, os contratos `CategoryResponse.color`, `CreateCategoryRequest.color`, `UpdateCategoryRequest.color` e `WhereItemDto.color` e a migração `20261103010002_categories-color-hex.sql` em "Contratos e interfaces", e as decisões 10 (inferência B) e 11 (inferência C) do "Registro de decisões".
- `docs/decisoes-do-prototipo.md`: PD-12 (a cor gravada é um HEX livre).
- `vostok/rules/project/database.md`: [project/database-05] e [project/database-09].
- `vostok/rules/project/development-methodology.md`: [project/development-methodology-02] (migração aplicada nunca é editada).
- `vostok/rules/project/code-style.md`: [project/code-style-03], [project/code-style-07] e [project/code-style-11].
- `vostok/rules/project/testing.md`: [project/testing-01], [project/testing-02], [project/testing-03] e [project/testing-07].
- `vostok/memory/knowledge.md` (KNW-007 e KNW-009): uma compilação pesada do servidor por vez e como lidar com a `.sqlx`.
- `apps/server/src/projects/domain/lane.rs`: `LaneColor::parse`, `as_str` e o teste `lane_color_accepts_only_hex_rrggbb`, o molde da cor HEX.
- `apps/server/src/projects/migrations/20261101140001_create-projects.sql` (linha 39): `CHECK (color ~ '^#[0-9a-f]{6}$')`.
- `packages/theme/src/tokens.css` (linhas 12 a 31, primeiro bloco, tema claro) e `apps/server/src/reports/infrastructure/palette.rs` (constantes `PRIMARY`, `ACCENT`, `SUCCESS`, `WARNING`, `INFO`): os HEX do tema claro usados na conversão.
- `apps/server/src/finance/migrations/20261101070002_create-finance-categories.sql`: coluna `color` com `CHECK (color IN (...))` (nome gerado `categories_color_check`), `FORCE ROW LEVEL SECURITY` e a política `categories_owner`.
- `apps/server/src/shared/test_support.rs` (fn `create_app_role`, `test_pool`): os testes rodam as migrações com o papel `atria_app`, dono das tabelas, sem superusuário e sem `BYPASSRLS`.
- `apps/server/src/finance/domain/category.rs`: `CategoryColor`, `Category`, `SystemCategory::color`, `default_categories` e o `mod tests` (teste `category_color_accepts_only_theme_tones`).
- `apps/server/src/finance/application/categories.rs`: `NewCategory`, `CategoryPatch`, `create` e `update`.
- `apps/server/src/finance/infrastructure/pg_categories.rs`: `CategoryRow::into_domain` (linha com `CategoryColor::parse`) e as queries que gravam `category.color.as_str()` (o texto SQL não muda).
- `apps/server/src/finance/interface/dto.rs` (busque por `CategoryColorDto`, `CreateCategoryRequest`, `UpdateCategoryRequest`, `CategoryResponse` e `WhereItemDto`): o enum de cores e os campos que passam a `String`.
- `apps/server/src/finance/interface/handlers.rs` (fns `create_category` e `update_category`): onde a cor do corpo vira a do caso de uso.
- `apps/server/src/finance/interface/openapi.rs`: lista de `schemas` com `CategoryColorDto`.
- `apps/server/src/finance/tests/mod.rs` (`FinanceTest`, `create_category`, `post`, `patch`, `get`, `items`, `pool`, `ALICE`, `BOB`, `id_of`).
- `apps/server/src/finance/tests/categories.rs`: auxiliares `with_key` e `ids` e o teste `rnf01_system_key_migration_keeps_existing_categories`, o molde do teste de migração.
- `apps/server/src/finance/tests/transfers.rs` (testes `creates_renames_and_deletes_category` e `category_has_kind_and_color`, que hoje recusa `#ff0000`).
- `apps/server/src/finance/tests/summaries.rs` (teste `where_it_went_groups_top_six_categories_plus_others_with_color`).
- `apps/server/src/finance/tests/authorization.rs` (o `INSERT INTO categories` com `'info'` do teste de RLS), `apps/server/src/finance/tests/transactions.rs` e `apps/server/src/finance/tests/listings.rs`: chamadas de `create_category` com cor por nome.
- `apps/server/src/reports/infrastructure/mod.rs` (busque por `categories_table`, perto da linha 780): a exportação grava `category.color.as_str()` e passa a exportar o HEX sem mudar o código.
- `apps/server/src/reports/tests.rs` (fn `category` do auxiliar, perto da linha 199, e teste `export_json_contains_all_user_entities`).

### Mudar

- `apps/server/src/finance/migrations/20261103010002_categories-color-hex.sql` (criar): converte as cores por nome no HEX do tema claro e troca o `CHECK` por `^#[0-9a-f]{6}$` (RF-20, RN-09, CT-14).
- `apps/server/src/finance/domain/category.rs` (alterar): `CategoryColor` vira HEX `#rrggbb` em minúsculas e as categorias padrão recebem o HEX do tema claro (RF-18, RN-09).
- `apps/server/src/finance/application/categories.rs` (alterar): `create` e `update` recebem a cor em texto e a validam com `CategoryColor::parse` (RF-18).
- `apps/server/src/finance/infrastructure/pg_categories.rs` (alterar): a leitura da linha usa o novo `CategoryColor::parse`, que devolve `Result`.
- `apps/server/src/finance/interface/dto.rs` (alterar): sai o `CategoryColorDto`; `color` passa a `String` nos pedidos, na resposta e no `WhereItemDto` (RF-18).
- `apps/server/src/finance/interface/handlers.rs` (alterar): `create_category` e `update_category` passam a cor em texto ao caso de uso.
- `apps/server/src/finance/interface/openapi.rs` (alterar): tira `CategoryColorDto` dos `schemas`; necessário porque o enum deixa de existir ([project/development-methodology-03]).
- `apps/server/src/finance/tests/categories.rs` (alterar): testes da cor HEX, da recusa de nomes, das minúsculas, das cores padrão e da migração (RF-18, RF-20, CT-12, CT-14).
- `apps/server/src/finance/tests/transfers.rs` (alterar): cores em HEX e `#ff0000` passa a ser aceito (RF-18).
- `apps/server/src/finance/tests/summaries.rs` (alterar): "Para onde foi" com cores HEX (CT-12); necessário porque cor por nome passa a ser recusada.
- `apps/server/src/finance/tests/authorization.rs` (alterar): cor HEX na categoria criada e no `INSERT` do teste de RLS; necessário pelo mesmo motivo.
- `apps/server/src/finance/tests/transactions.rs` (alterar): cores HEX nas chamadas de `create_category`; necessário pelo mesmo motivo.
- `apps/server/src/finance/tests/listings.rs` (alterar): cores HEX nas chamadas de `create_category`; necessário pelo mesmo motivo.
- `apps/server/src/http/tests/isolation.rs` (alterar): `overrides` manda uma cor HEX válida ao criar a categoria, porque a amostra gerada do OpenAPI deixou de ser um valor do enum (decisão do usuário na execução); necessário porque cor fora do HEX passa a ser recusada.
- `apps/server/src/reports/tests.rs` (alterar): cor HEX no auxiliar `category` e conferência de que a exportação traz a cor da categoria em HEX (RF-20); necessário porque cor por nome passa a ser recusada.

### Passos

Tabela de conversão usada em todos os passos (tokens do tema claro em `packages/theme/src/tokens.css`): `primary` → `#6d28d9`, `accent` → `#0e7490`, `success` → `#047857`, `warning` → `#92400e`, `danger` → `#be123c`, `info` → `#0369a1`.

1. Leia os arquivos de "Ler". Confira em `vostok task status SPEC-003` que a TASK-04 está `done`; se não estiver, **PARE** e registre o bloqueio. Não rode outra compilação do `atria-server` em paralelo (KNW-007). Nenhuma query muda de texto nesta tarefa, então a `.sqlx` não é regenerada.
2. `apps/server/src/finance/migrations/20261103010002_categories-color-hex.sql` (criar), com um comentário em pt-br no topo (cor da categoria em HEX `#rrggbb` livre, PD-12, RF-18; cada tom antigo vira o HEX do token do tema claro, RF-20, inferência B; sempre minúsculas, RN-09; o `NO FORCE` temporário deixa o dono da tabela, que roda a migração, atualizar as linhas de todas as pessoas apesar da RLS) e exatamente:
   ```sql
   ALTER TABLE categories DROP CONSTRAINT categories_color_check;
   ALTER TABLE categories NO FORCE ROW LEVEL SECURITY;
   UPDATE categories SET color = CASE color
       WHEN 'primary' THEN '#6d28d9'
       WHEN 'accent' THEN '#0e7490'
       WHEN 'success' THEN '#047857'
       WHEN 'warning' THEN '#92400e'
       WHEN 'danger' THEN '#be123c'
       WHEN 'info' THEN '#0369a1'
       ELSE color
   END;
   ALTER TABLE categories FORCE ROW LEVEL SECURITY;
   ALTER TABLE categories ADD CONSTRAINT categories_color_check CHECK (color ~ '^#[0-9a-f]{6}$');
   ```
   Não edite `20261101070002_create-finance-categories.sql` nem `20261102010001_add-categories-system-key.sql`. Confira: `git status --porcelain -- apps/server/src/finance/migrations` lista só o arquivo novo como `??`.
3. Testes primeiro, em `apps/server/src/finance/tests/categories.rs`. No topo, acrescente `const THEME_HEX: [(&str, &str); 6] = [("primary", "#6d28d9"), ("accent", "#0e7490"), ("success", "#047857"), ("warning", "#92400e"), ("danger", "#be123c"), ("info", "#0369a1")];` com o comentário "Tons antigos e o HEX do tema claro (RF-20)" e atualize o `//!` do arquivo citando RF-18, RF-20, RN-09 e CT-14. Escreva:
   - `ct12_category_is_created_and_edited_with_hex_color`: `POST /categories` com `{ "name": "Viagem", "kind": "expense", "color": "#1a2b3c" }` devolve 201 com `color` `#1a2b3c`; `PATCH /categories/{id}` com `{ "color": "#ffcc00" }` devolve 200 com `color` `#ffcc00` e o mesmo `name`; `GET /categories/{id}` devolve `color` `#ffcc00`.
   - `rn09_category_color_is_stored_in_lowercase`: `POST` com `"color": "#AABBCC"` devolve `color` `#aabbcc`; lendo por SQL com `begin_for_user(t.pool(), ALICE)` (`SELECT color FROM categories WHERE id = $1`), a coluna é `#aabbcc`; `PATCH` com `"#00FF7F"` devolve `#00ff7f`.
   - `invalid_category_color_is_rejected`: `POST` com cada cor de `["primary", "#fff", "#12345g", "123456", "#1234567", ""]` devolve 422 com `code` `validation_failed` e `errors[0]` igual a `{ "field": "color", "code": "invalid" }`; `PATCH` de uma categoria existente com `{ "color": "info" }` devolve 422 com o mesmo erro, e a categoria continua com a cor anterior.
   - `ct12_default_categories_have_theme_hex_colors`: a primeira listagem `GET /categories` da Alice traz, por `system_key`: `salary` `#047857`, `freelance` `#0e7490`, `housing` `#6d28d9`, `groceries` `#047857`, `transport` `#0369a1`, `leisure` `#0e7490`, `health` `#be123c` (use `with_key`).
   - `rnf01_category_color_migration_converts_names_to_hex`: copie a montagem de `rnf01_system_key_migration_keeps_existing_categories`, com o filtro `migration.version < 20261103010002`; dentro de `begin_for_user(&ctx.state.pool, ALICE)`, grave uma categoria por item de `THEME_HEX` (`id` `Uuid::from_u128(índice + 1)`, `name` `format!("Categoria {índice}")`, `kind` `'expense'`, `color` o nome), por `INSERT INTO categories (id, owner_id, name, kind, color, created_at, updated_at, deleted_at) VALUES ($1, $2, $3, 'expense', $4, now(), now(), CASE WHEN $5 THEN now() END)`, com `$5` `true` só na última (excluída); conte as linhas; rode `finance::migrator()` inteiro; leia `SELECT color FROM categories ORDER BY id` e confira a mesma contagem (6) e as cores iguais aos HEX de `THEME_HEX`, na ordem, todas com 7 caracteres, começando por `#` e só com `0-9a-f`; depois, numa transação nova da Alice, confira que `INSERT` de uma categoria nova com `color` `'primary'` falha (o `CHECK` novo) e descarte essa transação sem `commit`; por fim, pelo app (`ctx.app(finance::router())` e `ctx.sign_in_as(ALICE)`), `GET /api/v1/categories` devolve as 5 vivas com os HEX dos 5 primeiros itens de `THEME_HEX`, sem semear as padrão.
   - No `mod tests` de `apps/server/src/finance/domain/category.rs`, troque `category_color_accepts_only_theme_tones` por `category_color_accepts_only_hex_rrggbb` (`parse("#1A2b3C")` dá `as_str()` `#1a2b3c`; `parse` de `"primary"`, `"#fff"`, `"#12345g"`, `"123456"`, `"#1234567"` e `""` dá `Err(FinanceError::Validation(_))`) e acrescente `system_category_colors_are_theme_hex` (as sete padrão com os HEX do item anterior).
   Rode `cargo test -p atria-server finance::tests::categories` e confira que os testes novos falham (ou não compilam).
4. `apps/server/src/finance/domain/category.rs` (alterar):
   - Troque o enum por `/// Cor da categoria: HEX `#rrggbb` livre (PD-12, RF-18), sempre em minúsculas (RN-09).` `#[derive(Debug, Clone, PartialEq, Eq)] pub struct CategoryColor(String);`, com `pub fn parse(text: &str) -> Result<Self, FinanceError>` igual a `LaneColor::parse` (sem `#` e seis dígitos HEX, senão `FinanceError::invalid("color", "invalid")`; guarda `text.to_ascii_lowercase()`) e `pub fn as_str(&self) -> &str`.
   - `SystemCategory::color` devolve `CategoryColor(hex.to_owned())` com o doc "HEX dos tokens do tema claro, os mesmos tons do protótipo (RF-20)": `Salary` `#047857`, `Freelance` `#0e7490`, `Housing` `#6d28d9`, `Groceries` `#047857`, `Transport` `#0369a1`, `Leisure` `#0e7490`, `Health` `#be123c`.
   - Atualize o `//!` do arquivo ("cor HEX livre" no lugar de "cor do tema"). Confira: `cargo test -p atria-server finance::domain::category`.
5. `apps/server/src/finance/application/categories.rs` (alterar): `NewCategory.color` passa a `String` e `CategoryPatch.color` a `Option<String>`; em `create`, `let color = CategoryColor::parse(&input.color)?;` antes de montar a `Category`, que recebe `color`; em `update`, `let color = patch.color.as_deref().map(CategoryColor::parse).transpose()?;` antes de `repo.get`, e `if let Some(color) = color { category.color = color; }`.
6. `apps/server/src/finance/infrastructure/pg_categories.rs` (alterar): em `CategoryRow::into_domain`, `color: CategoryColor::parse(&self.color).map_err(|_| corrupt("color"))?`. Não mude o texto de nenhuma query.
7. `apps/server/src/finance/interface/dto.rs` (alterar): remova `CategoryColorDto` e os dois `From`, e tire `CategoryColor` do `use` da linha 13; `CreateCategoryRequest.color: String` e `UpdateCategoryRequest.color: Option<String>`, com `/// HEX `#rrggbb`; guardado em minúsculas (RN-09).` e `#[schema(example = "#6d28d9")]`; `CategoryResponse.color: String` (`category.color.as_str().to_owned()`) e `WhereItemDto.color: Option<String>` (`view.category.map(|category| category.color.as_str().to_owned())`), com o doc "HEX `#rrggbb`".
8. `apps/server/src/finance/interface/handlers.rs` (alterar): em `create_category`, `color: body.color,`; em `update_category`, `color: body.color,`. `apps/server/src/finance/interface/openapi.rs` (alterar): tire `CategoryColorDto` da lista de `schemas`.
9. Testes existentes, trocando cada cor por nome pelo HEX da tabela do início, sem renomear nenhum teste:
   - `apps/server/src/finance/tests/transfers.rs`: as chamadas de `create_category` e os corpos com `"color"`; em `creates_renames_and_deletes_category`, `assert_eq!(renamed["color"], "#be123c")`; em `category_has_kind_and_color`, `created["color"]` `#047857` e `hex_color` passa a `StatusCode::CREATED` (RF-18).
   - `apps/server/src/finance/tests/summaries.rs`: em `where_it_went_groups_top_six_categories_plus_others_with_color`, `colors` passa a `["#6d28d9", "#0e7490", "#047857", "#92400e", "#be123c", "#0369a1", "#6d28d9", "#0e7490"]` e a chamada de `Salário` usa `#047857`.
   - `apps/server/src/finance/tests/authorization.rs`, `transactions.rs` e `listings.rs`: as chamadas de `create_category`; no `INSERT INTO categories` do teste de RLS de `authorization.rs`, `'info'` vira `'#0369a1'` (a recusa continua vindo só da política).
   - `apps/server/src/reports/tests.rs`: no auxiliar `category`, `"color": "#6d28d9"`; em `export_json_contains_all_user_entities`, acrescente antes de `let text = ...`: para cada item de `export["contexts"]["finance"]["categories"]` (array não vazio), `color` é texto de 7 caracteres começando por `#`, e ao menos um é `#6d28d9`.
   Confira: `grep -nE '"(primary|accent|success|warning|danger|info)"' apps/server/src/finance/tests/transfers.rs apps/server/src/finance/tests/summaries.rs apps/server/src/finance/tests/authorization.rs apps/server/src/finance/tests/transactions.rs apps/server/src/finance/tests/listings.rs apps/server/src/reports/tests.rs` não lista nada.
9a. `apps/server/src/http/tests/isolation.rs` (alterar): em `overrides`, acrescente o braço `"categories" => json!({"color": "#6d28d9"}),` antes de `_ => json!({})`, com o comentário: a cor é HEX livre e a amostra gerada do schema seria recusada. Confira: `cargo test -p atria-server http::tests::`.
10. `apps/server/src/reports/infrastructure/mod.rs` não muda: `json!(category.color.as_str())` passa a exportar o HEX. Rode `cargo test -p atria-server finance::` e `cargo test -p atria-server reports::` até passarem.
11. Rode `cargo fmt` e a Verificação inteira, sem `DATABASE_URL` no ambiente.
