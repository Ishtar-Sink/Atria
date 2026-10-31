-- Movimentações (contrato "Movimentação financeira") e transferências (RF-27 a RF-29).
-- A cópia liquidada de uma recorrente é uma movimentação comum ligada por
-- `generated_from` (PD-51), e `effective_date` é a data da liquidação ou a prevista,
-- usada no período livre das listagens e do painel (PD-55).
-- Busca na descrição sem diferenciar acentos (DEC-005), como no `library`: a função
-- `IMMUTABLE` fixa o dicionário para a consulta usar sempre a mesma normalização.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE FUNCTION finance_unaccent(input text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, input) $$;

CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    account_id UUID NOT NULL,
    category_id UUID,
    description TEXT CHECK (char_length(description) <= 200),
    expected_amount BIGINT NOT NULL CHECK (expected_amount > 0),
    expected_date DATE NOT NULL,
    settled_amount BIGINT CHECK (settled_amount >= 0),
    settled_at DATE,
    difference_amount BIGINT,
    difference_kind TEXT CHECK (difference_kind IN ('saving', 'gain', 'loss')),
    currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    generated_from UUID NULL,
    occurrence_date DATE,
    installment_number SMALLINT,
    installment_total SMALLINT,
    installment_group_id UUID,
    statement_period CHAR(7) CHECK (statement_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    effective_date DATE GENERATED ALWAYS AS (COALESCE(settled_at, expected_date)) STORED,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT transactions_account_fk
        FOREIGN KEY (account_id, owner_id) REFERENCES accounts (id, owner_id),
    CONSTRAINT transactions_category_fk
        FOREIGN KEY (category_id, owner_id) REFERENCES categories (id, owner_id),
    CONSTRAINT transactions_generated_from_fk
        FOREIGN KEY (generated_from, owner_id) REFERENCES recurring_transactions (id, owner_id),
    -- Liquidação coerente: os efetivos são todos nulos ou todos preenchidos.
    CONSTRAINT transactions_settlement_coherent CHECK (
        (settled_amount IS NULL AND settled_at IS NULL
            AND difference_amount IS NULL AND difference_kind IS NULL)
        OR (settled_amount IS NOT NULL AND settled_at IS NOT NULL
            AND difference_amount = settled_amount - expected_amount
            AND (difference_kind IS NULL) = (difference_amount = 0))
    ),
    CONSTRAINT transactions_occurrence_coherent CHECK (
        (generated_from IS NULL) = (occurrence_date IS NULL)
    ),
    CONSTRAINT transactions_installment_coherent CHECK (
        (installment_number IS NULL AND installment_total IS NULL AND installment_group_id IS NULL)
        OR (installment_total >= 1 AND installment_number BETWEEN 1 AND installment_total
            AND installment_group_id IS NOT NULL)
    )
);

-- Uma cópia por ocorrência (RN-09).
CREATE UNIQUE INDEX transactions_generated_from_occurrence_key
    ON transactions (generated_from, occurrence_date) WHERE deleted_at IS NULL;
CREATE INDEX transactions_owner_effective_date_idx
    ON transactions (owner_id, effective_date, id) WHERE deleted_at IS NULL;
CREATE INDEX transactions_account_statement_period_idx
    ON transactions (account_id, statement_period) WHERE deleted_at IS NULL;
CREATE INDEX transactions_account_id_idx ON transactions (account_id);
CREATE INDEX transactions_category_id_idx ON transactions (category_id);
CREATE INDEX transactions_generated_from_idx ON transactions (generated_from);
CREATE INDEX transactions_installment_group_id_idx ON transactions (installment_group_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY transactions_owner ON transactions
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- Transferências: mudam os dois saldos e ficam fora dos totais (RN-05). Com
-- `statement_period`, pagam a fatura do cartão (RN-06).
CREATE TABLE transfers (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    from_account_id UUID NOT NULL,
    to_account_id UUID NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    transferred_on DATE NOT NULL,
    description TEXT CHECK (char_length(description) <= 200),
    statement_period CHAR(7) CHECK (statement_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT transfers_distinct_accounts CHECK (from_account_id <> to_account_id),
    CONSTRAINT transfers_from_account_fk
        FOREIGN KEY (from_account_id, owner_id) REFERENCES accounts (id, owner_id),
    CONSTRAINT transfers_to_account_fk
        FOREIGN KEY (to_account_id, owner_id) REFERENCES accounts (id, owner_id)
);

CREATE INDEX transfers_owner_id_idx ON transfers (owner_id, id) WHERE deleted_at IS NULL;
CREATE INDEX transfers_owner_transferred_on_idx
    ON transfers (owner_id, transferred_on) WHERE deleted_at IS NULL;
CREATE INDEX transfers_from_account_id_idx ON transfers (from_account_id);
CREATE INDEX transfers_to_account_id_idx ON transfers (to_account_id, statement_period);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY transfers_owner ON transfers
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
