<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## O que a tarefa entregou

O painel do Financeiro agora tem gráficos interativos. O "Previsto x realizado" virou barras deitadas, verdes para entradas e azuis para saídas. O previsto aparece num tom mais claro, e o valor de cada barra fica escrito logo acima dela. Ao passar o mouse, ou ao navegar pelo teclado, uma dica mostra o previsto, o realizado e a diferença ("R$ 2.940,00 abaixo do previsto").

Logo abaixo do Fechamento entrou o card "Mês a mês". Ele mostra uma coluna por mês: 6 meses já realizados e 6 projetados, num tom mais claro. O card alterna entre "Entradas e saídas" e "Saldo", e a escolha fica no endereço da página, então um link já abre no modo escolhido. Um mês sem movimentação aparece com zero, e um saldo negativo aparece em âmbar, nunca em vermelho.

## Por que importa

A pessoa vê de relance quanto do previsto já se realizou e para onde o saldo vai nos próximos meses, sem ler tabelas. Quem usa leitor de tela ou só o teclado tem a mesma informação, pela tabela acessível e pela dica. A biblioteca de gráficos só carrega quando o painel é aberto, então o resto do app não fica mais lento.

## Como foi conferido

Foram usados testes automáticos dos dois gráficos e do painel. Uma checagem do build confirmou que a biblioteca de gráficos só carrega no painel. Também foram gerados uma prancha nos temas claro e escuro, em computador e em celular (360 px), e um vídeo com o mouse e o teclado. A prancha e o vídeo foram conferidos e aprovados.
