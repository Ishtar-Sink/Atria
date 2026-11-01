<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## O que a tarefa entregou

Os gráficos do painel passaram a usar o recharts 3.10.1 (MIT), com o `react-is` 19.3.1 como dependência par, ambos em versão exata. A tarefa cobre RF-13, RF-14, RF-15, RF-16, CT-09, CT-10 e CB-08.

## Como foi feito

- `panel-charts.tsx`: `ExpectedVsSettledColumns` deu lugar a `ExpectedVsSettledBars`, um `BarChart` com `layout="vertical"` e `accessibilityLayer`.
  - Cada barra recebe a cor do grupo (`--success` ou `--accent`) pela prop `shape`, que desenha um `Rectangle`. O previsto usa `EXPECTED_OPACITY` (0,45), que é exportado.
  - O valor fica num `<text>` 4 px acima da barra, desenhado por `LabelList` com `content`.
  - A dica `ExpectedTooltip` (`data-chart-tooltip`) mostra o previsto, o realizado e "Diferença: …".
  - A tabela acessível ganhou a coluna Diferença.
  - `HorizontalBars` não mudou.
- `monthly-chart.tsx` (novo): `MonthlyChart` em colunas, nos modos `flow` (entradas e saídas) e `balance` (saldo em `--success`, ou em `--warning` quando negativo).
  - Os meses projetados usam `EXPECTED_OPACITY`.
  - O `MonthTick` escreve o mês abreviado e, no primeiro mês e em janeiro, o ano numa segunda linha. Abaixo de 560 px, medidos pelo `onResize`, o rótulo fica inclinado em -60°.
  - O eixo Y usa moeda compacta do `Intl`.
  - A legenda é própria, com `.dotProjected`, e a tabela acessível tem as colunas Mês, Situação e as séries do modo.
- `finance-panel-screen.tsx`:
  - Os três gráficos são carregados com `lazy` e `Suspense`, e o painel só importa o tipo `BarItem`.
  - O card `Monthly` tem um `SegmentedField` ("Mostrar").
  - `monthly` entrou no `panelSearchSchema` com `catch('flow')`.
  - A zona principal ficou Fechamento, Mês a mês, Para onde foi e Previsto x realizado, também no estado de erro, que passou a ter 7 blocos.
- CSS, só com tokens:
  - Saíram as colunas antigas, a legenda de valores, `.fillExpected` e `.fillSettled`.
  - Entraram `.chartFrame` (contorno de foco no gráfico), `.chartTooltip` (com largura máxima e quebra de linha, para 360 px), `.dotProjected` e `.monthlyHead`.
- `use-financial-summary.ts`: entraram os tipos `MonthlyPoint` e `MonthlyMode`. O i18n do Financeiro ganhou os textos do card, da dica e da diferença.
- `check-chart-chunk.mjs` (novo): lê o `dist`, monta os chunks iniciais pelos imports estáticos (com aspas ou crase) e confere que nenhum deles tem `recharts-surface`. Também confere que o chunk da biblioteca é importado com `import()` a partir do chunk do painel.
- `evidence-finance.mjs`:
  - A fixture ganhou `monthly`, e `where_it_went` passou a usar HEX.
  - O modo `graficos` tem 5 cenários nos 4 temas e larguras, e centraliza o card antes da captura.
  - O modo `graficos-video` grava o vídeo com o mouse, o teclado e a troca para Saldo.

## Decisões

- O recharts foi escolhido pela camada de acessibilidade pronta (foco no gráfico e dica pelas setas) e pelas barras nos dois sentidos. O peso dele fica fora do carregamento inicial graças ao `lazy`.
- O valor fica acima da barra, sobre o fundo do card. Dentro da barra cheia, o texto não teria contraste AA nos dois temas (RNF-02).
- `Cell` está obsoleto no recharts 3 e é recusado pelo `@typescript-eslint/no-deprecated`, por isso a cor por barra vai pela prop `shape`.
- Doze rótulos "jun. de 26" se sobrepunham no eixo, então o rótulo virou duas linhas. A dica e a tabela continuam com o mês completo.
- Esses desvios dos passos originais foram registrados no ajuste 1 da tarefa, aprovado pelo usuário.

## Verificação

- A Verificação inteira passou: 33 testes dos gráficos e do painel, 142 do Financeiro, tipos, ESLint, Prettier e o build. `charts-chunk.txt` mostra `biblioteca nos iniciais: 0`.
- A regressão não bloqueou. Houve só o acréscimo dos 9 testes novos e a mudança esperada das dependências.
- A prancha `finance-graficos.png` e o vídeo `finance-graficos.webm` deram 0 falha e foram conferidos pelo usuário.

## Pontos de atenção

- No jsdom, os gráficos só se desenham com um `ResizeObserver` falso que informe uma largura ao observar. Os dois arquivos de teste fazem isso no `beforeEach`.
- O recharts 3 desenha os rótulos dos eixos numa camada à parte (`.recharts-*Axis-tick-labels`) e não desenha barra de valor zero. Os testes contam as barras com isso em mente.
- O foco no gráfico já ativa a dica do primeiro item, e cada seta avança um.
- O `check-chart-chunk.mjs` identifica o chunk do painel pelo texto `finance.panel.monthly_label`. Renomear essa chave exige atualizar o script.
