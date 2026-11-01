### Concluída quando

- [x] O filtro de categoria de Entradas, de Saídas e do relatório Gastos por categoria é o autocomplete com seleção única, e os outros filtros não mudam (RF-22).

  > Como comprovar: no `filtro-categoria.png`, ver o campo Categoria ao lado de Conta, com a mesma altura; em `filtro-categoria-tests.txt`, ver aprovados os casos `ct15` de `transactions-screens.test.tsx` (inclusive Entradas) e de `report-page.test.tsx`.

- [x] Digitando, a lista filtra; as setas e o Enter escolhem uma só categoria, que filtra a lista ou o relatório e fica na URL (CT-15, RNF-05).

  > Como comprovar: no vídeo `filtro-categoria.webm`, ver a lista encolher a cada letra e a escolha pelo teclado em Saídas e no relatório; em `filtro-categoria-e2e.txt`, `12 passed`.

- [x] Uma busca sem resultado mostra "Nenhuma categoria encontrada", e o Esc fecha mantendo o filtro anterior (CB-10).

  > Como comprovar: no vídeo, ver a mensagem e o campo voltar a "Mercado" depois do Esc; em `filtro-categoria-tests.txt`, ver aprovados `cb10 keeps the previous category when nothing matches` e `cb10 keeps the report category when nothing matches`.

- [x] O filtro funciona em 360 px sem rolagem horizontal e sem violações de acessibilidade (CT-15).

  > Como comprovar: em `filtro-categoria-e2e.txt`, ver aprovado o caso `ct15` em `relatorios em 360`, que confere a lista dentro da tela, a ausência de rolagem horizontal e o axe.

- [x] Testes, lint, Prettier e checagem de tipos passam sem warning.

  > Como comprovar: rodar o bloco de "Verificação" e ver código 0.
