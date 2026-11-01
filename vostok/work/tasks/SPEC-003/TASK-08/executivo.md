<!-- Escrito na finalização da tarefa. -->

A biblioteca de componentes de interface do Atria ganhou um campo de busca com sugestões (autocomplete), pensado para listas que crescem, como as categorias. Ao digitar, a lista se filtra na hora e ignora maiúsculas e acentos: digitar "saude" encontra "Saúde". O campo serve para escolher uma opção ou várias, e as opções escolhidas aparecem como etiquetas que podem ser removidas uma a uma.

Dá para usar só com o teclado, só com o mouse ou com os dois. Quando nada corresponde à busca, a tela avisa que não há resultado e mantém a escolha anterior, então nada é escolhido por engano. O campo também mostra mensagens de erro, pode ser desativado e tem a mesma altura e o mesmo visual do campo de seleção que já existia, para que os dois fiquem lado a lado nos filtros.

Por que importa: este componente era a peça que faltava para o filtro de categoria da área financeira, prevista na especificação SPEC-003.

Situação: os testes automatizados passaram e a verificação de regressão também, ou seja, nada que já funcionava foi quebrado. Os prints dos estados nos dois temas e o vídeo da interação foram gravados e conferidos.
