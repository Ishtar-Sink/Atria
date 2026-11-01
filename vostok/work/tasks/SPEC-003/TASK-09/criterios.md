### Concluída quando

- [x] A página tem uma única rolagem, a da janela, no painel e nos formulários, sem rolagem dentro da área da página (RF-23, CT-17).

  > Como comprovar: no vídeo `rolagem-unica.webm`, ver uma só barra de rolagem, na borda da janela; em `rolagem-chromium-e2e.txt` e `rolagem-firefox-e2e.txt`, `7 passed`, com os casos `ct17` entre eles.

- [x] A barra lateral fica na altura da tela e a topbar no topo durante toda a rolagem, sem espaço em branco no fim (RF-23, CT-17).

  > Como comprovar: no vídeo, ver a sidebar e a topbar paradas enquanto o conteúdo passa; no print `rolagem-firefox-zen.png` do Zen, ver a sidebar inteira e a topbar no topo com a página rolada até o fim.

- [x] O cabeçalho fixo continua compactando depois de 48 px, colado logo abaixo da topbar, com o fundo de ponta a ponta (RF-24, CT-17).

  > Como comprovar: no vídeo e no print do Zen, ver o título compacto logo abaixo da topbar, sem faixa entre os dois; em `layout-tests.txt`, ver aprovados `rf24 follows the window scroll without a page area` e `rf24 sticks right below the topbar`; nas saídas e2e, os quatro casos do fundo do cabeçalho continuam aprovados.

- [x] As abas do Financeiro ficam presas sob o título durante a rolagem, e o conteúdo não aparece por trás do cabeçalho, mesmo no navegador que não desenha o desfoque; o fundo vai da barra lateral à borda da janela e termina numa linha logo abaixo das abas, sem faixa em degradê (RF-24, CT-17).

  > Como comprovar: no print `rolagem-firefox-zen.png` do Zen, ver as abas logo abaixo do título compacto e nenhuma linha da página por trás dele; no vídeo, ver as abas paradas enquanto o conteúdo passa; nas saídas e2e, o caso `ct17` do painel aprovado no Chromium e no Firefox.

- [x] Numa página mais curta que a tela, não aparece rolagem e a barra lateral ocupa a altura da tela (CB-11).

  > Como comprovar: no `pagina-curta.png`, ver a lista de notas vazia, a sidebar de cima a baixo e nenhuma barra de rolagem; nas saídas e2e, o caso `cb11` aprovado no Chromium e no Firefox.

- [x] A rolagem única funciona no Chromium e no Firefox (RNF-06).

  > Como comprovar: abrir `rolagem-chromium-e2e.txt` e `rolagem-firefox-e2e.txt` e ver `7 passed` nos dois.

- [x] O leitor, o quadro de Projetos e a paleta de comandos continuam com a própria rolagem (RF-23).

  > Como comprovar: abrir um livro no leitor, rolar as páginas do PDF e o painel lateral; no quadro de Projetos, rolar as raias para o lado; abrir a paleta com uma busca longa e rolar a lista: tudo rola como antes.

- [x] Testes, lint, Prettier e checagem de tipos passam sem warning.

  > Como comprovar: rodar o bloco de "Verificação" e ver código 0.
