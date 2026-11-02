<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

Entradas e saídas avulsas passam a guardar o valor bruto com os descontos e acréscimos nominais (INSS, IRPF, Sindical, juros), e o líquido calculado é o que entra no saldo, nas listagens e no painel.
Na liquidação, a pessoa informa o líquido que caiu na conta e o sistema calcula o bruto e os percentuais, com uma prévia antes de confirmar; desfazer devolve tudo ao previsto.
As movimentações que já existem continuam com os mesmos valores, conferido por teste antes e depois da migração.
Perfil julgamento, risco alto: muda o banco e o contrato da API usado pela tela.
Depende do cálculo da TASK-02 e libera as recorrentes (TASK-05), o cartão do painel (TASK-06) e as telas.

**O que foi feito.** As entradas e saídas avulsas agora guardam o valor bruto junto com os descontos e acréscimos, e o líquido é o que entra no saldo, nas listagens e no resumo. Quando a pessoa informa o valor que caiu na conta, o sistema calcula sozinho o bruto e os percentuais, e mostra uma prévia antes de confirmar. Desfazer uma liquidação devolve a movimentação ao previsto, sem perder nada. As movimentações que já existiam mantiveram saldos, resumo e histórico de liquidações iguais antes e depois da mudança, conferido por teste. Com isso, a base para descontos reais está pronta para as recorrentes e para o painel.
