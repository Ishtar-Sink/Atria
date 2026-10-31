-- Movimentações recorrentes (RF-31, PD-51, DEC-003): a regra do contrato "Regra de
-- recorrência", com o fuso de origem, e o modelo das ocorrências. A ocorrência aberta
-- não é gravada: é a primeira data da regra depois de `last_closed_on`.
CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    account_id UUID NOT NULL,
    category_id UUID,
    expected_amount BIGINT NOT NULL CHECK (expected_amount > 0),
    currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    rule JSONB NOT NULL,
    description TEXT CHECK (char_length(description) <= 200),
    -- Data da última ocorrência liquidada ou pulada; nula antes da primeira.
    last_closed_on DATE NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT recurring_transactions_id_owner_key UNIQUE (id, owner_id),
    CONSTRAINT recurring_transactions_account_fk
        FOREIGN KEY (account_id, owner_id) REFERENCES accounts (id, owner_id),
    CONSTRAINT recurring_transactions_category_fk
        FOREIGN KEY (category_id, owner_id) REFERENCES categories (id, owner_id)
);

CREATE INDEX recurring_transactions_owner_id_idx
    ON recurring_transactions (owner_id, id) WHERE deleted_at IS NULL;
CREATE INDEX recurring_transactions_account_id_idx ON recurring_transactions (account_id);
CREATE INDEX recurring_transactions_category_id_idx ON recurring_transactions (category_id);

ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY recurring_transactions_owner ON recurring_transactions
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
