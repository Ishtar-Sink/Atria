-- Registro de `Idempotency-Key` por dono ([project/api-06], CB-09): a mesma chave com
-- o mesmo corpo devolve a resposta gravada.
CREATE TABLE finance_idempotency_keys (
    owner_id UUID NOT NULL,
    key TEXT NOT NULL CHECK (char_length(key) BETWEEN 1 AND 255),
    request_hash TEXT NOT NULL,
    response_status SMALLINT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT finance_idempotency_keys_owner_key UNIQUE (owner_id, key)
);

ALTER TABLE finance_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_idempotency_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_idempotency_keys_owner ON finance_idempotency_keys
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
