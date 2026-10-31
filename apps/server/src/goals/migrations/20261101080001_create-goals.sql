-- Metas e marcos (RF-36, RF-37). O progresso é calculado dos marcos, não gravado.
-- Sem chave estrangeira para tabelas de outro contexto.

CREATE TABLE goals (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    description TEXT NULL CHECK (description IS NULL OR char_length(description) <= 10000),
    deadline DATE NULL,
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'in_progress', 'completed', 'abandoned')),
    labels TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(labels) <= 20),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX goals_owner_status_idx ON goals (owner_id, status);
CREATE INDEX goals_labels_idx ON goals USING GIN (labels);
CREATE INDEX goals_owner_deadline_idx ON goals (owner_id, deadline);

CREATE TABLE milestones (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    goal_id UUID NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    position INT NOT NULL CHECK (position >= 0),
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX milestones_goal_idx ON milestones (goal_id);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals FORCE ROW LEVEL SECURITY;
CREATE POLICY goals_owner ON goals
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones FORCE ROW LEVEL SECURITY;
CREATE POLICY milestones_owner ON milestones
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
