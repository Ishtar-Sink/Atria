-- Diário (RF-44, RF-45) e lista de emoções da pessoa (RF-46). O texto das entradas
-- fica só cifrado em repouso ([project/security-18]), por isso não há coluna
-- `tsvector` ([project/database-06]): a busca descriptografa em memória as do dono.

CREATE TABLE emotions (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    -- Emoção padrão: o nome exibido vem da tradução do frontend até ser renomeada.
    system_key TEXT NULL CHECK (
        system_key IN ('joy', 'sadness', 'anger', 'fear', 'anxiety', 'calm', 'gratitude')
    ),
    name TEXT NULL CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 50),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    CHECK (system_key IS NOT NULL OR name IS NOT NULL)
);

CREATE UNIQUE INDEX emotions_owner_name_uniq ON emotions (owner_id, lower(name))
    WHERE deleted_at IS NULL AND name IS NOT NULL;
-- Sem filtro por `deleted_at`: a emoção padrão excluída não volta a ser semeada.
CREATE UNIQUE INDEX emotions_owner_system_key_uniq ON emotions (owner_id, system_key)
    WHERE system_key IS NOT NULL;

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    occurred_at TIMESTAMPTZ NOT NULL,
    text_ciphertext BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX journal_entries_owner_occurred_idx
    ON journal_entries (owner_id, occurred_at DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE journal_entry_emotions (
    entry_id UUID NOT NULL REFERENCES journal_entries (id) ON DELETE CASCADE,
    emotion_id UUID NOT NULL REFERENCES emotions (id),
    owner_id UUID NOT NULL,
    intensity SMALLINT NULL CHECK (intensity BETWEEN 1 AND 5),
    PRIMARY KEY (entry_id, emotion_id)
);

CREATE INDEX journal_entry_emotions_emotion_idx ON journal_entry_emotions (emotion_id);

ALTER TABLE emotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotions FORCE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_emotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_emotions FORCE ROW LEVEL SECURITY;

-- O `NULLIF` evita erro numa conexão reaproveitada do pool, em que o valor fica ''.
CREATE POLICY emotions_owner_isolation ON emotions
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
CREATE POLICY journal_entries_owner_isolation ON journal_entries
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
CREATE POLICY journal_entry_emotions_owner_isolation ON journal_entry_emotions
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
