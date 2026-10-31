# Frontend

Define a interface do Atria conforme a identidade do Ishtar Sink, com o painel do Translunar como referência visual.

[project/frontend-01]: Tema claro como padrão (`<html data-theme="light">`); o botão de alternar fica no rodapé da sidebar e a escolha é salva no navegador; sem escolha salva, vale o `prefers-color-scheme`.
[project/frontend-02]: Contraste WCAG AA; `textFaint` nunca é usado como texto de leitura; o fundo de um estado é sempre o token `*Soft` correspondente.
[project/frontend-03]: Fontes Inter e Outfit variáveis, servidas pelo app com `font-display: swap`, com a licença OFL ao lado (`fonts/OFL-*.txt`).
[project/frontend-04]: Animações só com tokens `--motion-*`, até 320 ms, respeitando `prefers-reduced-motion`.
[project/frontend-05]: Sidebar com a marca no topo (ícone e nome em Outfit), navegação em `<nav aria-label="Principal">` e rodapé com alternar tema e sair.
[project/frontend-06]: Topbar com busca global (todas as entidades ou contextos escolhidos), breadcrumbs e informações da tela.
[project/frontend-07]: Toda página tem um cabeçalho com título (`page-heading`) e subtítulo ou eyebrow.
[project/frontend-08]: Ícones em SVG inline com `aria-hidden="true"`; botão só com ícone tem `aria-label`.
[project/frontend-09]: Erro de formulário aparece no próprio formulário, com `role="alert"`, nunca num alerta do navegador.
[project/frontend-10]: Tudo navegável por teclado, com foco visível e HTML semântico.
[project/frontend-11]: Itens sem imagem própria recebem uma cor determinística derivada do id.
[project/frontend-12]: Toda tela de listagem tem filtros, modos de visualização e busca, e mostra os estados vazio (com texto explicativo), carregando e erro.
[project/frontend-13]: Filtros, visualização e busca ficam na URL.
[project/frontend-14]: Tom calmo: sem gamificação, sem contador de urgência e sem vermelho para uma pendência comum.
[project/frontend-15]: Notificações do navegador só depois de o usuário dar permissão.
[project/frontend-16]: Datas, números e moeda formatados com `Intl`, no locale do usuário.
[project/frontend-17]: Layout responsivo com pontos de quebra em 720 px e 480 px, funcional a partir de 360 px.
[project/frontend-18]: Optimistic UI nas mutações: a tela reflete a mudança na hora e, se o servidor recusar, desfaz a mudança e avisa o usuário.
