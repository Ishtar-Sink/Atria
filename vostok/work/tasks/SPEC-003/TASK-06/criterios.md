### Concluída quando

- [x] A pessoa cria um destaque de livro ou de artigo e troca a cor dele com uma cor HEX livre, e a listagem do leitor devolve essa cor para marcar o PDF (RF-19, CT-13).

  > Como comprovar: em `highlight-color-tests.txt`, ver `ct13_book_highlight_is_created_and_recolored_with_hex` e `ct13_article_highlight_is_created_and_recolored_with_hex` com `ok`.

- [x] A cor do destaque é sempre guardada como `#rrggbb` em minúsculas, e um nome de tom ou um HEX malformado é recusado com 422 no campo `color` (RF-19, RN-09).

  > Como comprovar: em `highlight-color-tests.txt`, ver `rn09_highlight_color_is_stored_in_lowercase`, `named_highlight_color_is_rejected` e `highlight_color_accepts_only_hex_rrggbb` com `ok`.

- [x] A migração converte cada cor por nome dos destaques existentes, inclusive dos excluídos, no HEX do tema claro, sem perder nenhuma linha, e o banco passa a aceitar só `#rrggbb`; as migrações antigas não foram editadas (RF-20, CT-14, RNF-01).

  > Como comprovar: em `highlight-color-tests.txt`, ver `rnf01_highlight_color_migration_converts_names_to_hex` e `rnf01_highlights_migration_keeps_existing_rows` com `ok`; rodar `git status --porcelain -- apps/server/src/library/migrations` e ver só o arquivo novo `20261103010003_highlights-color-hex.sql`.

- [x] O servidor compila sem banco, sem aviso de formatação ou do clippy, e os testes do Acervo, dos relatórios e do `http` continuam passando (RF-19, RF-20).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminarem sem erro.
