### Concluída quando

- [x] A migração converte os cartões existentes em contas comuns sem perder dados: as contagens de contas, movimentações, transferências e recorrências, os valores, as datas, as liquidações e os saldos ficam iguais, e o ex-cartão entra no saldo do painel (RF-10, CT-06, RNF-01).

  > Como comprovar: em `card-migration-tests.txt`, ver `ct06_rnf01_card_migration_keeps_counts_and_balances ... ok`; abrir a migração `20261103010001_remove-credit-cards.sql` e ver só `ALTER TABLE`, `DROP INDEX` e `CREATE INDEX`, sem `UPDATE` nem `DELETE`.

- [x] As parcelas de uma compra no cartão convertido viram saídas independentes, com a mesma data prevista, o mesmo valor e a mesma liquidação de antes (CB-05).

  > Como comprovar: em `card-migration-tests.txt`, ver `cb05_installments_become_independent_expenses ... ok`.

- [x] A transferência que pagou uma fatura continua, com o mesmo valor e as mesmas contas, sem período de fatura, e os saldos não mudam (CB-06).

  > Como comprovar: em `card-migration-tests.txt`, ver `cb06_paid_statement_transfer_keeps_amount_without_period ... ok`.

- [x] O servidor não tem mais cartão de crédito: a conta não aceita nem devolve tipo, limite, fechamento ou vencimento, a movimentação não aceita parcelas nem devolve parcela ou fatura, e as rotas de fatura e de pagamento respondem 404 (RF-07).

  > Como comprovar: em `card-removal-tests.txt`, ver `account_has_no_card_fields`, `installments_are_no_longer_accepted`, `updates_unsettled_transaction_fields` e `statement_routes_are_gone` com `ok`.

- [x] O resumo do Financeiro não traz mais Cartões e lista todas as contas no saldo, e o contrato OpenAPI não tem mais as rotas, os schemas nem os campos de cartão (RF-07, RF-09).

  > Como comprovar: em `card-removal-tests.txt`, ver `summary_balance_has_current_forecast_at_period_end_and_per_account`, `documents_all_finance_routes` e `card_schemas_are_gone_from_contract` com `ok`.

- [x] Nenhuma migração antiga foi editada, o servidor compila sem banco com a `.sqlx` regenerada, sem aviso de formatação ou do clippy, e os testes do Financeiro, dos relatórios, da busca e do `http` continuam passando (RF-07, RNF-01).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminarem sem erro, com `test result: ok` em cada suíte.
