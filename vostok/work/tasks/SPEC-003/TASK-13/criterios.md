### Concluída quando

- [ ] A cor da categoria é escolhida no color picker, ao criar e ao editar, e gravada como `#rrggbb` em minúsculas (RF-18, RN-09, CT-12).

  > Como comprovar: em `category-color-tests.txt`, ver aprovados `creates and renames a category`, `rf18 starts a new category with the default hex color` e `rn09 normalizes the hex color to lowercase`; no vídeo `category-color.webm`, ver o diálogo "Escolher cor" e as linhas `ok` do POST com `#0ea5e9` e do PATCH com `#f59e0b`.

- [ ] A cor HEX aparece em Configurações, no detalhe da categoria e nas barras do "Para onde foi" (RF-18, CT-12, FA-04).

  > Como comprovar: em `category-color-tests.txt`, ver aprovados `rf18 shows the hex color of the category in the detail`, `rf18 paints each bar in the hex color of its category` e `rf18 shows where it went in the category colors`; na prancha `category-color.png`, ver cada categoria com a própria cor nas três telas.

- [ ] O texto sobre uma cor clara fica escuro e sobre uma cor escura fica claro, com contraste AA nos dois temas (CB-09, RNF-02).

  > Como comprovar: em `category-color-tests.txt`, ver aprovados `cb09 writes dark text on a light category color and light text on a dark one` e `cb09 picks the text color with more contrast on the category color`; na prancha, as amostras de "Clara" e "Noite" legíveis, com as linhas `ok` do axe nos dois temas.

- [ ] As cores por nome saíram do Financeiro: sem `tone.ts`, sem a lista de seis cores e sem cor literal no CSS (RF-18, [project/code-style-10]).

  > Como comprovar: rodar a "Verificação" e ver que `test ! -e .../tone.ts` e os dois `grep` terminam sem erro.

- [ ] Testes do Financeiro, tipos, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a "Verificação" inteira e ver que termina com código 0.
