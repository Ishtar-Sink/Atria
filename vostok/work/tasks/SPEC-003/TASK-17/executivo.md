<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## O que a tarefa entregou

Os valores do Financeiro agora mostram o sinal e a cor conforme o que eles são, nas listas de Entradas e Saídas e no painel:

- Entradas aparecem em verde com "+".
- Saídas aparecem com "−", na cor normal do texto.
- Saldos (o atual e o de cada conta) e a sobra prevista aparecem em verde quando positivos, em âmbar com "−" quando negativos e, quando zerados, na cor do texto e sem sinal.

Nenhum valor aparece em vermelho. O sinal segue o tipo do valor, não o número guardado, então uma saída nunca aparece como entrada por erro de sinal.

## Por que importa

A pessoa distingue de relance o que entra do que sai e percebe um saldo negativo sem alarme. O sinal fica escrito ao lado da cor, então a informação não depende só de enxergar a cor.

## Como foi conferido

Foram usados testes automáticos do componente do valor, das listas e do painel, com checagem de acessibilidade nos dois temas. Também foi gerada uma prancha das listas e do painel nos temas claro e escuro, em computador e em celular (360 px). A prancha foi conferida e aprovada pelo usuário. Ele também considerou deixar as saídas em vermelho, ou em laranja com o vermelho só para saldos negativos, e decidiu manter as cores como estão.
