### Concluída quando

- [x] A pessoa cria e edita uma categoria com uma cor HEX livre, e a cor gravada aparece no detalhe e no "Para onde foi" do resumo (RF-18, CT-12).

  > Como comprovar: em `category-color-tests.txt`, ver `ct12_category_is_created_and_edited_with_hex_color` e `where_it_went_groups_top_six_categories_plus_others_with_color` com `ok`.

- [x] A cor é sempre guardada como `#rrggbb` em minúsculas, e um nome de tom ou um HEX malformado é recusado com 422 no campo `color` (RF-18, RN-09).

  > Como comprovar: em `category-color-tests.txt`, ver `rn09_category_color_is_stored_in_lowercase`, `invalid_category_color_is_rejected` e `category_color_accepts_only_hex_rrggbb` com `ok`.

- [x] As categorias padrão de uma pessoa nova nascem com o HEX do tema claro equivalente ao tom que tinham (RF-18, RF-20).

  > Como comprovar: em `category-color-tests.txt`, ver `ct12_default_categories_have_theme_hex_colors` e `system_category_colors_are_theme_hex` com `ok`.

- [x] A migração converte cada cor por nome das categorias existentes, inclusive das excluídas, no HEX do tema claro, sem perder nenhuma linha, e o banco passa a aceitar só `#rrggbb`; as migrações antigas não foram editadas (RF-20, CT-14, RNF-01).

  > Como comprovar: em `category-color-tests.txt`, ver `rnf01_category_color_migration_converts_names_to_hex ... ok`; rodar `git status --porcelain -- apps/server/src/finance/migrations` e ver só o arquivo novo `20261103010002_categories-color-hex.sql`.

- [x] A exportação de dados traz a cor da categoria em HEX, e o servidor compila sem banco, sem aviso de formatação ou do clippy, com os testes do Financeiro, dos relatórios e do `http` passando (RF-18, RF-20).

  > Como comprovar: em `category-color-tests.txt`, ver `export_json_contains_all_user_entities ... ok`; rodar a Verificação e ver todos os comandos terminarem sem erro.
