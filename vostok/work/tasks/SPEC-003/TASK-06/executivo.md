<!-- Escrito na finalização da tarefa. -->

A cor dos destaques deixa de ser uma escolha entre cinco cores fixas e passa a ser um código de cor livre, no mesmo padrão usado por sites e aplicativos. Com isso, a escolha de cor pode crescer sem nova mudança nas regras do sistema.

O que muda para quem usa:

- Os destaques que já existiam continuam com cor: cada uma das cinco cores antigas foi convertida para o tom correspondente do tema claro.
- Ao criar ou trocar a cor de um destaque, o sistema aceita qualquer código de cor válido. Quem tentar enviar um nome antigo, como "accent" ou "primary", recebe uma recusa informando que a cor é inválida.
- Toda cor é guardada da mesma forma (em letras minúsculas), então a mesma cor aparece igual em qualquer lugar.
- Os relatórios exportados passam a trazer o código da cor de cada destaque, sem mudança na forma de exportar.

Por que importa: a paleta fixa deixa de ser um limite para o produto, e os dados de cor ficam padronizados e mais consistentes. A conversão dos destaques existentes foi conferida por testes automáticos, que verificaram que nenhum destaque se perde e que as cores convertidas são as esperadas.

Situação: a verificação da entrega passou sem falhas, a regressão ficou igual ao estado anterior e a evidência da entrega foi gerada. Se alguma parte do sistema ainda enviar os nomes antigos de cor, ela precisa ser ajustada, porque essas tentativas agora são recusadas.
