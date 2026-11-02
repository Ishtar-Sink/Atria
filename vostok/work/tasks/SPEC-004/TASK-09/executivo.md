<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

Esta tarefa acrescenta ao painel do Financeiro o cartão "Descontos do período", com quanto foi descontado e acrescentado no período, por nome (como INSS, IRPF e Juros), separando descontos de acréscimos.
O benefício é ver de relance quanto da renda vai para impostos e encargos, mês a mês, sem abrir cada movimentação.
Perfil padrão, de risco baixo: a tela só mostra os totais que o servidor já calcula.
Depende do total por nome no resumo e do editor de itens; desbloqueia o teste ponta a ponta final.

O que mudou: o painel passou a ter oito cartões, quatro em cada coluna, e cada um fica ao lado do seu par. O cartão novo fica na coluna da direita, logo abaixo de "Economias e perdas". Cada nome aparece em uma única linha, com o valor já liquidado no período e, abaixo, quanto estava previsto para ele. Descontos aparecem com sinal de menos e acréscimos com sinal de mais. As cores seguem as regras já aprovadas para o Financeiro, sem vermelho. A tela não soma nem agrupa nada: os totais vêm prontos do servidor, na ordem em que ele envia.

Quando não há descontos nem acréscimos no período, o cartão diz que não há nada a mostrar. Se o painel falhar ao carregar, o cartão tem o próprio botão para tentar de novo.

Verificação: os 209 testes do Financeiro passam, e a checagem de tipos, o lint e a formatação não apontam erros. A prancha com o cartão foi gerada e conferida pelo usuário, com 6 capturas e nenhuma falha.
