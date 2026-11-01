-- Fim do cartão de crédito (SPEC-003, RF-07, RF-10, RNF-01): tirar as colunas de
-- cartão, fatura e parcela já converte o cartão em conta comum e cada parcela em uma
-- saída independente, sem mexer em valores, datas, liquidações nem saldos.
-- Só DDL: as tabelas têm `FORCE ROW LEVEL SECURITY` e a migração roda sem
-- `app.current_user_id`, então um `UPDATE` afetaria zero linhas sem erro.
ALTER TABLE accounts DROP CONSTRAINT accounts_credit_card_terms;
ALTER TABLE accounts DROP CONSTRAINT accounts_default_is_standard;
ALTER TABLE accounts
    DROP COLUMN kind,
    DROP COLUMN credit_limit_amount,
    DROP COLUMN closing_day,
    DROP COLUMN due_day;

ALTER TABLE transactions DROP CONSTRAINT transactions_installment_coherent;
DROP INDEX transactions_account_statement_period_idx;
DROP INDEX transactions_installment_group_id_idx;
ALTER TABLE transactions
    DROP COLUMN installment_number,
    DROP COLUMN installment_total,
    DROP COLUMN installment_group_id,
    DROP COLUMN statement_period;

-- O índice antigo era `(to_account_id, statement_period)` e some com a coluna; a
-- chave estrangeira continua indexada ([project/database-07]).
DROP INDEX transfers_to_account_id_idx;
ALTER TABLE transfers DROP COLUMN statement_period;
CREATE INDEX transfers_to_account_id_idx ON transfers (to_account_id);
