-- Notas do contexto `notes` (RF-43). Título e corpo ficam só cifrados em repouso
-- ([project/security-18]), por isso a tabela não tem coluna `tsvector`
-- ([project/database-06]): a busca descriptografa em memória as notas do dono.
CREATE TABLE notes (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    title_ciphertext BYTEA NOT NULL,
    body_ciphertext BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX notes_owner_updated_idx ON notes (owner_id, updated_at DESC, id DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX notes_owner_created_idx ON notes (owner_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;

-- O `NULLIF` evita erro numa conexão reaproveitada do pool, em que o valor fica ''.
CREATE POLICY notes_owner_isolation ON notes
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
