<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## O que a tarefa entregou

O filtro de categoria de Entradas, Saídas e do relatório `fin-cat` passou do `SelectField` para o `Autocomplete` de seleção única da `@atria/ui` (TASK-08), cobrindo RF-22, CT-15 e CB-10.

## Como foi feito

- `transactions-screen.tsx`: `Autocomplete` com a opção "Todas" (valor vazio) e as categorias do tipo da aba. A escolha vai para `category_id` na URL. O `SelectField` da conta e os chips não mudaram.
- `report-filters.tsx`: em `FilterSelect`, só o filtro `category` usa o `Autocomplete`; os demais seguem no `SelectField`.
- `shared/i18n/pt-br.json`: `common.category_not_found`, usado pelas duas telas. Ficou em `common` porque Financeiro e Relatórios usam o mesmo texto.
- `transactions-screens.test.tsx`: o caso de filtro pela URL segue com as mesmas conferências. Entram o caso `ct15` (digitar, ordem das opções, opção ativa, navegação com setas e Enter, e o filtro de Entradas com `sal`) e o caso `cb10` (texto sem resultado, sem perder a escolha anterior).
- `report-page.test.tsx`: os testes que procuravam a categoria como botão passaram a usar o `combobox`. Entram os casos de digitação e teclado e o de texto sem resultado.
- `reports.e2e.ts`: o filtro como `combobox`; o caso `ct15` em 360 px e desktop confere lista, teclado, texto sem resultado e Escape; o vídeo é gravado só com `ATRIA_E2E_VIDEO`.

## Decisões

- Só a categoria usa o autocomplete, porque é a lista que cresce (PD-13, decisão 13 da spec). Os demais filtros são curtos e continuam como lista.
- O comportamento segue o do `Autocomplete` da TASK-08: busca por trecho do nome, ordem alfabética e primeira opção ativa. Os testes e o e2e seguem isso. Por exemplo, com `m` digitado, a primeira opção é Mercado, e `ArrowDown`, `ArrowUp` e `Enter` escolhem Mercado.
- Quando nada combina, a escolha anterior é mantida e a tela mostra o aviso em `role="status"`.

## Verificação

- Os testes da Verificação passaram.
- Na primeira comparação com o baseline, a regressão foi bloqueada por comandos diferentes. O usuário aceitou as diferenças: um teste apagado pela TASK-11 e o typecheck, que passou de erro para código 0 com a TASK-13. Depois disso, a regressão passou.
- A evidência automática do e2e falhou na primeira execução e foi corrigida. O print `filtro-categoria.png` e o vídeo `filtro-categoria.webm` foram conferidos pelo usuário, em `TASK-16/evidencias/`.

## Pontos de atenção

- O comportamento de busca e de teclado depende do `Autocomplete` da TASK-08. Mudar a ordem ou a opção ativa ali quebra os testes desta tarefa de propósito.
- `common.category_not_found` é compartilhada: mudar o texto altera Financeiro e Relatórios.
- O vídeo do e2e só é gravado com `ATRIA_E2E_VIDEO`; sem a variável, o teste é pulado.
- Depois de mudanças no código, a prévia do e2e precisa ser gerada de novo. O `reuseExistingServer` do Playwright reaproveitaria o build antigo.
