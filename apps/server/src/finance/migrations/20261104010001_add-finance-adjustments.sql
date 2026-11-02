-- Bruto e itens de ajuste (descontos e acréscimos) nas movimentações e nas recorrentes
-- (SPEC-004, RF-01, RF-02). `expected_amount` continua sendo o líquido, o valor que afeta
-- o saldo; o bruto e os itens são informação a mais. As linhas existentes ficam sem itens
-- e com o bruto igual ao líquido, sem mudar nenhum valor (RNF-03, decisão 10). O
-- `NO FORCE` temporário deixa o dono da tabela, que roda a migração, atualizar as linhas
-- de todas as pessoas apesar da RLS, como em `20261103010002_categories-color-hex.sql`.
ALTER TABLE transactions
    ADD COLUMN gross_amount BIGINT,
    ADD COLUMN adjustments JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN settled_gross_amount BIGINT,
    ADD COLUMN settled_adjustments JSONB;
ALTER TABLE recurring_transactions
    ADD COLUMN gross_amount BIGINT,
    ADD COLUMN adjustments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE transactions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions NO FORCE ROW LEVEL SECURITY;
UPDATE transactions SET gross_amount = expected_amount;
UPDATE transactions
    SET settled_gross_amount = settled_amount, settled_adjustments = '[]'::jsonb
    WHERE settled_amount IS NOT NULL;
UPDATE recurring_transactions SET gross_amount = expected_amount;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE transactions ALTER COLUMN gross_amount SET NOT NULL;
ALTER TABLE recurring_transactions ALTER COLUMN gross_amount SET NOT NULL;

-- As listas usam `CASE` porque o PostgreSQL não garante a ordem de avaliação do `AND`, e
-- `jsonb_array_length` falha num valor que não é lista.
ALTER TABLE transactions
    ADD CONSTRAINT transactions_gross_amount_positive CHECK (gross_amount > 0),
    ADD CONSTRAINT transactions_adjustments_list CHECK (
        CASE WHEN jsonb_typeof(adjustments) = 'array'
            THEN jsonb_array_length(adjustments) <= 20
            ELSE false END
    ),
    ADD CONSTRAINT transactions_gross_without_adjustments CHECK (
        adjustments <> '[]'::jsonb OR gross_amount = expected_amount
    ),
    ADD CONSTRAINT transactions_settled_breakdown_coherent CHECK (
        (settled_amount IS NULL) = (settled_gross_amount IS NULL)
        AND (settled_amount IS NULL) = (settled_adjustments IS NULL)
    ),
    ADD CONSTRAINT transactions_settled_gross_not_negative CHECK (settled_gross_amount >= 0),
    ADD CONSTRAINT transactions_settled_adjustments_list CHECK (
        CASE WHEN settled_adjustments IS NULL THEN true
            WHEN jsonb_typeof(settled_adjustments) = 'array'
                THEN jsonb_array_length(settled_adjustments) <= 20
            ELSE false END
    ),
    ADD CONSTRAINT transactions_settled_gross_without_adjustments CHECK (
        settled_adjustments IS NULL
        OR settled_adjustments <> '[]'::jsonb
        OR settled_gross_amount = settled_amount
    );

ALTER TABLE recurring_transactions
    ADD CONSTRAINT recurring_transactions_gross_amount_positive CHECK (gross_amount > 0),
    ADD CONSTRAINT recurring_transactions_adjustments_list CHECK (
        CASE WHEN jsonb_typeof(adjustments) = 'array'
            THEN jsonb_array_length(adjustments) <= 20
            ELSE false END
    ),
    ADD CONSTRAINT recurring_transactions_gross_without_adjustments CHECK (
        adjustments <> '[]'::jsonb OR gross_amount = expected_amount
    );
