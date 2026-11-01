## O que mudou

Antes, o conteúdo das telas rolava dentro de uma área fixa da página, e a janela do navegador não rolava. Agora a rolagem é única, a da própria janela. A barra de navegação lateral e a barra do topo ficam sempre no lugar, e só o conteúdo se move.

O título de cada tela cola logo abaixo da barra do topo. Quando a pessoa desce a página, o título diminui para ocupar menos espaço, e volta ao tamanho normal ao subir.

Nas telas do Financeiro, as abas de navegação entre as seções ficam presas junto com o título, então continuam ao alcance durante a rolagem.

O fundo do título passou a ser sólido e cobre o conteúdo que passa por trás dele, com uma linha separando o título da área de conteúdo. Antes, em alguns navegadores, como o Zen (baseado no Firefox), o efeito de transparência não aparecia, e os textos da página se misturavam ao título.

Em páginas curtas, a barra lateral ocupa exatamente a altura da tela, sem rolagem sobrando.

Nos formulários, o campo que a pessoa está preenchendo aparece abaixo da barra do topo e do título, sem ficar escondido atrás deles.

As telas que já tinham rolagem própria, como o leitor de livros, o quadro de Projetos e a paleta de comandos, não foram alteradas.

## Valor

- Navegação mais estável: a barra lateral e a barra do topo não saem da tela ao rolar.
- Menos perda de contexto em telas longas, porque o título e as abas continuam visíveis.
- Títulos e abas legíveis também no navegador Zen, onde antes o conteúdo aparecia por trás do título.
- Páginas curtas sem rolagem desnecessária.

## Ajustes feitos durante o trabalho

Durante a execução, o usuário pediu três ajustes:

- uma pequena folga de medição nas verificações automáticas do Firefox, porque o navegador arredonda a posição no fim da página;
- as abas do Financeiro passaram para dentro do título fixo;
- o fundo do título ficou sólido, de ponta a ponta, com uma linha sob as abas.

## Situação

Tarefa concluída. Os testes automáticos passaram. Uma diferença visual esperada na verificação de regressão foi aceita pelo usuário. O usuário conferiu o vídeo da rolagem e o print da página curta.

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

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T18:04:46Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 6 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 6 comando(s) iguais ao baseline |
| 5 | 2026-11-01 | evidências | erro | evidência automática com erro |
| 6 | 2026-11-01 | evidências | erro | evidência automática com erro |
| 7 | 2026-11-01 | ajuste | in_progress | Tolerância de 1 px no top da sidebar e da topbar nos casos ct17 do e2e (Firefox mede -0,4 px no fim da rolagem) |
| 8 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 9 | 2026-11-01 | regressão | passed | 6 comando(s) iguais ao baseline |
| 10 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 11 | 2026-11-01 | conferência | usuário | print rolagem-unica.webm conferido pelo usuário (sha256 e1b3d652) |
| 12 | 2026-11-01 | conferência | usuário | print pagina-curta.png conferido pelo usuário (sha256 10cd482c) |
| 13 | 2026-11-01 | evidências | pending | evidência manual sem arquivo |
| 14 | 2026-11-01 | ajuste | in_progress | Abas do Financeiro dentro do cabeçalho fixo (prop below); fundo do cabeçalho cobre o conteúdo sem depender do desfoque; critério e passo 10b com testes unitários e checagem no e2e |
| 15 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 16 | 2026-11-01 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 17 | 2026-11-01 | retomada | validating | decisão do usuário: Usuário aceitou: o teste do fundo tingido a 55% virou o do fundo que cobre o conteúdo e entrou o caso do slot below (opção A, abas no cabeçalho fixo); aceito(s): 1 |
| 18 | 2026-11-01 | regressão | passed | 5 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 19 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 20 | 2026-11-01 | conferência | usuário | print rolagem-unica.webm conferido pelo usuário (sha256 b9fac280) |
| 21 | 2026-11-01 | conferência | usuário | print pagina-curta.png conferido pelo usuário (sha256 ab4253bd) |
| 22 | 2026-11-01 | evidências | passed | 7 evidência(s) em TASK-09/evidencias/ |
| 23 | 2026-11-01 | ajuste | in_progress | Fundo do cabeçalho sólido de ponta a ponta com linha sob as abas; faixa em degradê abaixo das abas removida |
| 24 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 25 | 2026-11-01 | regressão | passed | 5 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 26 | 2026-11-01 | evidências | erro | evidência automática com erro |
| 27 | 2026-11-01 | evidências | erro | evidência automática com erro |
| 28 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 29 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 30 | 2026-11-01 | regressão | passed | 5 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 31 | 2026-11-01 | conferência | usuário | print rolagem-unica.webm conferido pelo usuário (sha256 5dd6b4e4) |
| 32 | 2026-11-01 | conferência | usuário | print pagina-curta.png conferido pelo usuário (sha256 8c57e0a9) |
| 33 | 2026-11-01 | evidências | passed | 7 evidência(s) em TASK-09/evidencias/ |
| 34 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Tolerância de 1 px no top da sidebar e da topbar nos casos ct17 do e2e (Firefox mede -0,4 px no fim da rolagem) |
| 2 | 2026-11-01 | agente | Abas do Financeiro dentro do cabeçalho fixo (prop below); fundo do cabeçalho cobre o conteúdo sem depender do desfoque; critério e passo 10b com testes unitários e checagem no e2e |
| 3 | 2026-11-01 | agente | Fundo do cabeçalho sólido de ponta a ponta com linha sob as abas; faixa em degradê abaixo das abas removida |
