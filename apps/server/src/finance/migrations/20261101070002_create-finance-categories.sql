-- Categorias de movimentação (RF-30), de entrada ou de saída e com um dos tons do
-- tema, usado em "Para onde foi" (PD-49, PD-58).
CREATE TABLE categories (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    color TEXT NOT NULL CHECK (color IN ('primary', 'accent', 'success', 'warning', 'danger', 'info')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT categories_id_owner_key UNIQUE (id, owner_id)
);

CREATE UNIQUE INDEX categories_owner_kind_name_key
    ON categories (owner_id, kind, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX categories_owner_id_idx ON categories (owner_id, id) WHERE deleted_at IS NULL;
CREATE INDEX categories_owner_kind_idx ON categories (owner_id, kind) WHERE deleted_at IS NULL;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
CREATE POLICY categories_owner ON categories
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
