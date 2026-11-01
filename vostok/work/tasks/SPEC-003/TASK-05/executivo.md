<!-- Escrito na finalização da tarefa. -->

A cor de cada categoria deixa de ser escolhida numa lista fixa de seis tons e passa a aceitar qualquer cor, no formato padrão usado por telas e sistemas digitais (seis caracteres após o símbolo de cerquilha, como `#1a2b3c`). A pessoa passa a personalizar as suas categorias sem depender de um conjunto pré-definido.

O que muda para quem usa:

- As categorias que já existiam foram convertidas. Cada uma mantém a cor equivalente à que tinha no tema claro, então a aparência atual não se perde.
- As categorias padrão do sistema já nascem com as cores do tema claro.
- As cores são gravadas sempre do mesmo jeito, sem diferença entre maiúsculas e minúsculas, e valores fora do padrão são recusados com mensagem de erro. Isso evita dados inconsistentes.
- Os relatórios e as exportações passam a trazer a cor real de cada categoria, pronta para ser usada em outras ferramentas.

Ponto de atenção: quem se integra ao sistema por programação precisa enviar a cor no formato novo. Os nomes antigos de cor passam a ser recusados.

Todas as verificações da entrega passaram e a comparação com o estado anterior não mostrou nenhuma regressão.
