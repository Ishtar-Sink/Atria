-- Consignados descontados em folha (SPEC-006, RF-02, RF-05, RF-13). O consignado fica ligado
-- a uma entrada avulsa ou recorrente; a parcela aberta não é gravada, e a liquidada é uma
-- saída ligada ao consignado e à entrada liquidada. As colunas novas de `transactions` são
-- nulas e sem padrão, então nenhuma linha existente muda (RNF-02).

-- Vale porque `id` já é a chave primária; permite as chaves estrangeiras compostas com o dono.
ALTER TABLE transactions ADD CONSTRAINT transactions_id_owner_key UNIQUE (id, owner_id);

CREATE TABLE payroll_loans (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    income_id UUID,
    income_recurrence_id UUID,
    category_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    contract_number TEXT CHECK (char_length(contract_number) BETWEEN 1 AND 40),
    installment_amount BIGINT NOT NULL CHECK (installment_amount > 0),
    currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    total_installments SMALLINT,
    current_installment SMALLINT,
    ends_on DATE,
    starts_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT payroll_loans_id_owner_key UNIQUE (id, owner_id),
    CONSTRAINT payroll_loans_income_fk FOREIGN KEY (income_id, owner_id)
        REFERENCES transactions (id, owner_id),
    CONSTRAINT payroll_loans_income_recurrence_fk FOREIGN KEY (income_recurrence_id, owner_id)
        REFERENCES recurring_transactions (id, owner_id),
    CONSTRAINT payroll_loans_category_fk FOREIGN KEY (category_id, owner_id)
        REFERENCES categories (id, owner_id),
    CONSTRAINT payroll_loans_one_income CHECK (num_nonnulls(income_id, income_recurrence_id) = 1),
    CONSTRAINT payroll_loans_term CHECK (
        (ends_on IS NULL
            AND total_installments BETWEEN 1 AND 999
            AND current_installment BETWEEN 1 AND total_installments)
        OR (ends_on IS NOT NULL AND total_installments IS NULL AND current_installment IS NULL)
    )
);

CREATE INDEX payroll_loans_owner_id_idx ON payroll_loans (owner_id, id) WHERE deleted_at IS NULL;
CREATE INDEX payroll_loans_income_id_idx ON payroll_loans (income_id) WHERE deleted_at IS NULL;
CREATE INDEX payroll_loans_income_recurrence_id_idx
    ON payroll_loans (income_recurrence_id) WHERE deleted_at IS NULL;
CREATE INDEX payroll_loans_category_id_idx ON payroll_loans (category_id);

ALTER TABLE payroll_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_loans FORCE ROW LEVEL SECURITY;
CREATE POLICY payroll_loans_owner ON payroll_loans
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE transactions
    ADD COLUMN payroll_loan_id UUID,
    ADD COLUMN income_transaction_id UUID,
    ADD COLUMN installment_number SMALLINT,
    ADD CONSTRAINT transactions_payroll_loan_fk FOREIGN KEY (payroll_loan_id, owner_id)
        REFERENCES payroll_loans (id, owner_id),
    ADD CONSTRAINT transactions_income_transaction_fk FOREIGN KEY (income_transaction_id, owner_id)
        REFERENCES transactions (id, owner_id),
    ADD CONSTRAINT transactions_payroll_installment_coherent CHECK (
        (payroll_loan_id IS NULL) = (income_transaction_id IS NULL)
        AND (installment_number IS NULL OR payroll_loan_id IS NOT NULL)
        AND (installment_number IS NULL OR installment_number BETWEEN 1 AND 999)
        AND (payroll_loan_id IS NULL OR kind = 'expense')
    );

-- Uma parcela por consignado e entrada liquidada.
CREATE UNIQUE INDEX transactions_payroll_installment_key
    ON transactions (payroll_loan_id, income_transaction_id) WHERE deleted_at IS NULL;
CREATE INDEX transactions_income_transaction_id_idx ON transactions (income_transaction_id);

-- Uma "Empréstimo" por pessoa.
CREATE UNIQUE INDEX categories_owner_loan_key
    ON categories (owner_id) WHERE system_key = 'loan' AND deleted_at IS NULL;
