-- Contas do Financeiro (RF-24, RF-25, RF-26). A conta padrão é garantida no banco
-- ([project/database-04]): uma por dono e nunca excluída.
CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    kind TEXT NOT NULL CHECK (kind IN ('standard', 'credit_card')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    balance_amount BIGINT NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'BRL' CHECK (currency ~ '^[A-Z]{3}$'),
    credit_limit_amount BIGINT CHECK (credit_limit_amount >= 0),
    closing_day SMALLINT CHECK (closing_day BETWEEN 1 AND 31),
    due_day SMALLINT CHECK (due_day BETWEEN 1 AND 31),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT accounts_credit_card_terms CHECK (
        (kind = 'credit_card'
            AND credit_limit_amount IS NOT NULL AND closing_day IS NOT NULL AND due_day IS NOT NULL)
        OR (kind = 'standard'
            AND credit_limit_amount IS NULL AND closing_day IS NULL AND due_day IS NULL)
    ),
    CONSTRAINT accounts_default_is_standard CHECK (NOT is_default OR kind = 'standard'),
    -- Alvo das chaves estrangeiras compostas: a movimentação e a conta têm o mesmo dono.
    CONSTRAINT accounts_id_owner_key UNIQUE (id, owner_id)
);

CREATE UNIQUE INDEX accounts_one_default_per_owner
    ON accounts (owner_id) WHERE is_default AND deleted_at IS NULL;
CREATE INDEX accounts_owner_id_idx ON accounts (owner_id, id) WHERE deleted_at IS NULL;

CREATE FUNCTION accounts_protect_default() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.is_default THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'default_account_not_deletable' USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.deleted_at IS NOT NULL OR NOT NEW.is_default THEN
            RAISE EXCEPTION 'default_account_not_deletable' USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER accounts_protect_default
    BEFORE DELETE OR UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION accounts_protect_default();

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY accounts_owner ON accounts
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
