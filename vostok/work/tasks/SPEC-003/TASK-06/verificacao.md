### Baseline

- `cargo test -p atria-server library:: 2>&1 | grep ' \.\.\. ' | grep -vE 'highlight_color_accepts_only_|ct13_|rn09_|named_highlight_color_|rnf01_highlight_color_' | sort`
- `cargo test -p atria-server reports:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
test -z "$(git status --porcelain -- apps/server/src/library/migrations/20261101130001_create-library.sql apps/server/src/library/migrations/20261102010003_add-highlights-deleted-at.sql)"
# evidência: highlight-color-tests.txt
cargo test -p atria-server -- library::tests::highlights:: library::domain::highlight:: library::tests::books::ct38_ library::tests::articles::
cargo test -p atria-server library::
cargo test -p atria-server reports::
cargo test -p atria-server http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` sem mudança, as migrações antigas intocadas e `test result: ok` nos testes da cor do destaque, do Acervo, dos relatórios e do `http` (migrações em ordem, OpenAPI juntado e rotas).

### Evidências

- `highlight-color-tests.txt` (automática, da verificação)
  - Prova: o destaque de livro e de artigo é criado e trocado de cor com um HEX livre, e a listagem do leitor devolve essa cor para marcar o PDF; a cor é guardada em minúsculas; nome de tom e HEX malformado são recusados com 422; a migração converte cada nome antigo no HEX do tema claro, inclusive nos destaques excluídos, sem perder nenhuma linha, e o banco passa a recusar cor por nome (RF-19, RF-20, RN-09, CT-13, CT-14, RNF-01).
  - Trecho: as linhas `test library::tests::highlights::ct13_book_highlight_is_created_and_recolored_with_hex ... ok`, `ct13_article_highlight_is_created_and_recolored_with_hex ... ok`, `rn09_highlight_color_is_stored_in_lowercase ... ok`, `named_highlight_color_is_rejected ... ok`, `rnf01_highlight_color_migration_converts_names_to_hex ... ok`, `rnf01_highlights_migration_keeps_existing_rows ... ok` e `test library::domain::highlight::tests::highlight_color_accepts_only_hex_rrggbb ... ok`, e `test result: ok` sem falhas.
  - Falha: `FAILED`, `test result: FAILED`, `panicked` ou a ausência dos testes `ct13_` e `rnf01_highlight_color_` (só os testes antigos rodando).
