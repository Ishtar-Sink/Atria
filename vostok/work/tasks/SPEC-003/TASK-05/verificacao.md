### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | grep -vE 'category_color_accepts_only_|ct12_|rn09_|rnf01_category_color_|invalid_category_color_|system_category_colors_are_theme_hex' | sort`
- `cargo test -p atria-server reports:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
test -z "$(git status --porcelain -- apps/server/src/finance/migrations/20261101070002_create-finance-categories.sql apps/server/src/finance/migrations/20261102010001_add-categories-system-key.sql)"
# evidência: category-color-tests.txt
cargo test -p atria-server -- finance::tests::categories:: finance::domain::category:: finance::tests::summaries::where_it_went finance::tests::transfers::category_has_kind_and_color reports::tests::export_json_contains_all_user_entities
cargo test -p atria-server finance::
cargo test -p atria-server reports::
cargo test -p atria-server http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` sem mudança, as migrações antigas intocadas e `test result: ok` nos testes da cor da categoria, do Financeiro, dos relatórios e do `http` (migrações em ordem, OpenAPI juntado e rotas).

### Evidências

- `category-color-tests.txt` (automática, da verificação)
  - Prova: a categoria é criada e editada com uma cor HEX livre, que aparece no detalhe e no "Para onde foi"; a cor é guardada em minúsculas; nome de tom e HEX malformado são recusados com 422; as categorias padrão nascem com o HEX do tema claro; a migração converte cada nome antigo no HEX do tema claro, inclusive nas excluídas, sem perder nenhuma linha, e o banco passa a recusar cor por nome; a exportação traz o HEX (RF-18, RF-20, RN-09, CT-12, CT-14, RNF-01).
  - Trecho: as linhas `test finance::tests::categories::ct12_category_is_created_and_edited_with_hex_color ... ok`, `ct12_default_categories_have_theme_hex_colors ... ok`, `rn09_category_color_is_stored_in_lowercase ... ok`, `invalid_category_color_is_rejected ... ok`, `rnf01_category_color_migration_converts_names_to_hex ... ok`, `test finance::domain::category::tests::category_color_accepts_only_hex_rrggbb ... ok`, `where_it_went_groups_top_six_categories_plus_others_with_color ... ok` e `export_json_contains_all_user_entities ... ok`, e `test result: ok` sem falhas.
  - Falha: `FAILED`, `test result: FAILED`, `panicked` ou a ausência dos testes `ct12_` e `rnf01_category_color_` (só os testes antigos rodando).
