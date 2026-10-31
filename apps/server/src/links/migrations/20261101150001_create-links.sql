-- Ligações bidirecionais do contexto `links` (RF-18, RN-10). Uma linha por ligação,
-- com os lados normalizados (o menor par tipo-id é a origem). Sem FK para tabelas de
-- outros contextos ([project/architecture-05]).
CREATE TABLE links (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    source_type TEXT NOT NULL CHECK (source_type IN (
        'account', 'transaction', 'transfer', 'goal', 'milestone', 'task', 'reminder',
        'note', 'journal_entry', 'book', 'article', 'video', 'project', 'project_card')),
    source_id UUID NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN (
        'account', 'transaction', 'transfer', 'goal', 'milestone', 'task', 'reminder',
        'note', 'journal_entry', 'book', 'article', 'video', 'project', 'project_card')),
    target_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    -- Lados normalizados: também impede ligar uma entidade a ela mesma.
    CONSTRAINT links_sides_ordered CHECK ((source_type, source_id) < (target_type, target_id)),
    CONSTRAINT links_pair_uniq UNIQUE (owner_id, source_type, source_id, target_type, target_id)
);

CREATE INDEX links_owner_source_idx ON links (owner_id, source_type, source_id);
CREATE INDEX links_owner_target_idx ON links (owner_id, target_type, target_id);

ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE links FORCE ROW LEVEL SECURITY;

-- O `NULLIF` evita erro numa conexão reaproveitada do pool, em que o valor fica ''.
CREATE POLICY links_owner_isolation ON links
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
