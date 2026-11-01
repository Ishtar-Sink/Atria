### Concluída quando

- [ ] O destaque é criado numa cor livre escolhida no color picker do leitor, além dos cinco atalhos, e gravado como `#rrggbb` em minúsculas (RF-19, RN-09, CT-13).

  > Como comprovar: em `highlight-color-tests.txt`, ver aprovados `rf19 highlights with a preset hex color` e `rf19 highlights with the hex chosen in the color panel`; no vídeo `reader-highlight-color.webm`, ver o trecho destacado em `#DB2777` e a linha `ok` do POST com `#db2777`.

- [ ] A marca no PDF usa a cor HEX do destaque (RF-19, CT-13).

  > Como comprovar: no vídeo `reader-highlight-color.webm`, ver a marca na cor escolhida e a linha `ok` de "marca na cor escolhida"; em `highlight-color-e2e-list.txt`, ver o caso `CT-13 highlights with a hex color from the picker and marks the pdf with it`.

- [ ] A cor de um destaque é trocada na aba Destaques pelos atalhos ou pelo color picker, e o item mostra o nome do atalho ou o HEX (RF-19, CT-13).

  > Como comprovar: em `highlight-color-tests.txt`, ver aprovados `rf19 changes the color of a highlight in the color picker`, `rf19 shows the preset name for a preset hex color` e os dois `rf32 changes the color of …`; na prancha `highlights-color.png`, ver o ponto e o nome `#db2777` depois da troca.

- [ ] O leitor e a aba Destaques seguem acessíveis nos dois temas, sem cor por nome no CSS (RNF-02, [project/code-style-10]).

  > Como comprovar: em `highlight-color-tests.txt`, ver aprovados os testes de axe; no vídeo e na prancha, as linhas `ok` do axe nos dois temas; os `grep` da "Verificação" terminam sem erro.

- [ ] Testes do leitor, tipos, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a "Verificação" inteira e ver que termina com código 0.
