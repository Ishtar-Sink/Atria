<!-- Escrito na finalização da tarefa. -->

## O que mudou

O sistema financeiro deixou de trabalhar com cartão de crédito. Não existem mais o tipo "cartão" de conta, o limite, os dias de fechamento e de vencimento, as faturas, o pagamento de fatura nem a compra parcelada como recurso próprio.

Os cartões que já estavam cadastrados foram convertidos em contas comuns, sem perda de dados financeiros: saldos, valores, datas e pagamentos continuam como estavam.

## Por que importa

- O modelo fica mais simples: cada gasto vira uma saída comum, sem regras de fatura.
- Compras parceladas passam a ser saídas independentes, uma por parcela, cada uma com sua data e seu valor previstos. A descrição da compra não muda.
- Transferências que quitavam faturas continuam registradas com o mesmo valor, agora como transferências comuns.
- O painel do período mostra o saldo de todas as contas, inclusive as que antes eram cartões.
- As exportações de relatórios deixam de trazer as colunas de cartão e de parcela.

## Pontos de atenção

- Os dados de limite, fechamento e vencimento dos antigos cartões deixam de existir no sistema. O backup feito antes da implantação é a salvaguarda para essas informações.
- A tela de cadastro de contas ainda envia o tipo de conta, que o sistema agora recusa. Ela só será ajustada em uma tarefa posterior. Até lá, criar ou alterar contas por essa tela pode falhar.

## Verificação

A verificação da entrega passou sem falhas. A comparação com o estado anterior não mostrou regressões: as diferenças encontradas são as esperadas, decorrentes da remoção do cartão. Foram geradas duas evidências da entrega.
