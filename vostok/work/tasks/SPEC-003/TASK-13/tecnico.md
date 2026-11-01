<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## O que a tarefa entregou

A cor da categoria passou de nome do tema (`primary`, `info`...) para HEX livre `#rrggbb`, gravado em minúsculas (RF-18, RN-09), seguindo o contrato regerado na TASK-07. O servidor valida o formato e a migração `20261103010002_categories-color-hex.sql` (TASK-05) converte os seis nomes antigos para o HEX equivalente. A interface passa a ler só HEX.

## Como foi feito

- `use-categories.ts`: sai `CATEGORY_COLORS`; entram `DEFAULT_CATEGORY_COLOR` (`#6d28d9`), `normalizeHex` e `categoryInk`, que escolhe `light.text` ou `light.surface` pelo maior contraste (CB-09). A lógica fica no hook, e não na tela.
- `finance-cache.ts`: sai o tipo `CategoryColor`, que representava o nome do tema.
- `category-form-screen.tsx`: o `FormSelect` vira `FormColor`. O schema valida `#rrggbb` com a mensagem `finance.category_form.color_invalid`, e o envio, na criação e na edição, passa por `normalizeHex`.
- `category-detail-screen.tsx`: o fato "Cor" mostra o HEX numa amostra (`data-color-sample`), com o fundo da cor e o texto escolhido por `categoryInk`.
- `finance-settings-screen.tsx`: o ponto usa a cor por `style`, e a linha mostra o HEX no lugar do nome da cor.
- `panel-charts.tsx` e `finance-panel-screen.tsx`: `BarItem.tone` vira `color` opcional, aplicado por `style`. Sem cor (Outras e Sem categoria), a barra usa `barFillNeutral`. As colunas de previsto e realizado usam `fillExpected` e `fillSettled`.
- `finance.module.css`: saem as classes `.tone_*`; entram `.barFillNeutral`, `.fillExpected`, `.fillSettled` e `.colorChip`, só com tokens. A cor de fundo e a do texto da amostra vêm do dado, por `style`.
- `components/tone.ts`: removido.
- `i18n/pt-br.json`: saem as chaves `colors.*`; entram `category_form.color_invalid` e `category_detail.color_sample`.
- `test-utils.tsx`: a categoria padrão das fixtures usa `#6d28d9`.
- Testes: `categories-screens.test.tsx` (criar e editar com o seletor, HEX na lista e no detalhe, texto legível sobre cor clara e escura, sem violações de acessibilidade); `use-categories.test.tsx` (HEX no corpo do POST, `categoryInk`, `normalizeHex`); `components.test.tsx` (barras com a cor da categoria e a barra neutra); `finance-panel-screen.test.tsx` (cores no "Para onde foi").
- `apps/web/scripts/evidence-category-color.mjs` (novo): prancha `category-color.png` com as telas nos dois temas e larguras, e `category-color.webm` com o seletor criando e editando uma categoria.

## Decisões

- A cor é sempre HEX em minúsculas. A validação do formulário, o `normalizeHex` no envio e o servidor usam o mesmo formato. No formulário, o seletor mostra o HEX em maiúsculas (`#6D28D9`), mas o valor gravado é em minúsculas.
- O texto sobre a cor é o token de maior contraste entre `light.text` e `light.surface` (CB-09), e não um limiar fixo.
- As cores das barras e dos pontos vêm do dado por `style`; o CSS guarda só tokens ([project/code-style-10]).
- `DEFAULT_CATEGORY_COLOR` é o roxo do tema claro, usado em categorias novas.

## Verificação

- Os testes da Verificação passaram.
- Na primeira comparação com o baseline, a regressão foi bloqueada por comandos diferentes. O usuário aceitou as três diferenças: dois testes apagados pelas TASK-11 e TASK-12, e ESLint e typecheck, que passaram de erro para código 0. Depois disso, a regressão passou.
- Evidências: `category-color.png` e `category-color.webm`, conferidos pelo usuário, em `TASK-13/evidencias/`.

## Pontos de atenção

- A fixture `summary()` do teste do painel ganhou `monthly: []`, decisão do usuário. O contrato exige o campo desde a TASK-04 e a TASK-07; sem ele, o typecheck do app inteiro falha. A série "Mês a mês" é da TASK-15.
- O seletor mostra o HEX em maiúsculas e o dado é gravado em minúsculas. Comparações em testes precisam considerar isso.
