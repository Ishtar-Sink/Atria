<!-- Escrito na finalização da tarefa. -->

## Objetivo

Trocar a rolagem interna do `AppLayout` pela rolagem da janela, mantendo a barra lateral e a topbar fixas, e fazer o cabeçalho fixo de página (`StickyPageHeader`) colar logo abaixo da topbar (RF-23, RF-24, CB-11, PD-20).

## O que foi feito, por arquivo

## Decisões

- Rolagem na janela, e não numa área interna: o `position: sticky` da barra lateral, da topbar e do cabeçalho passa a ser relativo à janela, que é o requisito RF-23.
- Altura da topbar em variável CSS medida por JavaScript: a topbar quebra linha abaixo de 720 px e muda de altura. O cabeçalho usa `--topbar-h` para colar sempre logo abaixo. É o mesmo papel da `syncTopbar` do protótipo.
- Telas com rolagem própria não mudaram: leitor (`position: fixed`, rotas `bare` fora do `AppLayout`), quadro de Projetos (`overflow-x: auto`, só horizontal) e paleta de comandos (`position: fixed`).
- Fundo do cabeçalho sólido em vez de desfoque. O Zen não desenhava o `backdrop-filter`, e o conteúdo aparecia por trás do título. O desfoque foi mantido sem prefixo, para o build prefixar (ISS-001). A ordem da mudança foi decidida pelo usuário na conferência do print do Zen.
- Abas dentro do cabeçalho fixo pela prop `below`, sem reescrever a `nav`.
- `scroll-margin-top` dos campos focados soma a topbar, porque agora ela também fica sobre a janela.

## Pontos de atenção

- `.sticky::before` foi alterado, embora a ISS-001 peça para não mexer nele. A alteração foi pedida pelo usuário e preserva o `backdrop-filter` sem prefixo. Quem mexer nele depois deve manter esse ponto.
- `data-scroll-area` não existe mais no código (`grep -rn 'data-scroll-area' apps/web/scripts apps/web/src` sem saída, segundo o plano). Qualquer script novo que role a área precisa rolar a janela.
- O Playwright usa `reuseExistingServer`. Por isso, a prévia (`vite build --mode e2e` e `vite preview --port 4173`) precisa ser gerada de novo a partir do código atual, senão o e2e roda contra o build antigo.
- Firefox mede frações no fim da rolagem: por isso a tolerância de 1 px nos casos `ct17`.
- A conferência manual do leitor, do quadro de Projetos e da paleta de comandos estava no passo 11 do plano, mas o registro não a documenta. Não há confirmação registrada para essas telas.

## Verificação

- Testes unitários (`vitest` em `src/app/layout`, `src/shared/layout` e `src/features/finance/components`): passaram, sem falhas. Saída em `validation/tests.out`.
- Regressão: passou, com 5 comandos iguais ao baseline e 1 diferença aceita pelo usuário (o teste do fundo tingido a 55% foi trocado pelo do fundo que cobre o conteúdo). Antes disso, a regressão foi bloqueada uma vez por comandos diferentes do baseline, e a retomada foi decidida pelo usuário.
- Evidências: passaram na última execução, com 7 arquivos em `TASK-09/evidencias/`, entre eles `rolagem-chromium-e2e.txt` e `rolagem-firefox-e2e.txt` (automáticas), `rolagem-unica.webm` e `pagina-curta.png` (prints) e `rolagem-firefox-zen.png` (manual). Houve duas falhas de evidência automática antes da passagem final.
- Conferência do usuário: `rolagem-unica.webm` (sha256 `5dd6b4e4`) e `pagina-curta.png` (sha256 `8c57e0a9`).
