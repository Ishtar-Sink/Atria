-- Tarefas pontuais e recorrentes (RF-38, RF-39). A tarefa recorrente guarda a
-- agenda em segmentos de regra com vigência (RN-08) e as conclusões por data
-- local da ocorrência (RN-09).

CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    description TEXT NULL CHECK (description IS NULL OR char_length(description) <= 10000),
    due_on DATE NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ NULL,
    labels TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(labels) <= 20),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    -- A recorrente conclui ocorrências, nunca a tarefa inteira.
    CHECK (NOT is_recurring OR completed_at IS NULL)
);

CREATE INDEX tasks_owner_due_on_idx ON tasks (owner_id, due_on);
CREATE INDEX tasks_owner_created_idx ON tasks (owner_id, created_at DESC, id DESC);
-- Filtro por etiqueta com `labels @> ARRAY[...]` ([project/database-07]).
CREATE INDEX tasks_labels_idx ON tasks USING GIN (labels);

CREATE TABLE task_recurrence_segments (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    rule JSONB NOT NULL,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX task_recurrence_segments_task_idx
    ON task_recurrence_segments (task_id, effective_from);
CREATE INDEX task_recurrence_segments_owner_idx ON task_recurrence_segments (owner_id);

CREATE TABLE task_completions (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    UNIQUE (task_id, occurrence_date)
);

CREATE INDEX task_completions_owner_idx ON task_completions (owner_id);

-- Segunda camada de isolamento ([project/database-09]); o NULLIF evita erro numa
-- conexão reaproveitada do pool, em que o valor fica '' depois da transação.
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY tasks_owner ON tasks
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE task_recurrence_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_recurrence_segments FORCE ROW LEVEL SECURITY;
CREATE POLICY task_recurrence_segments_owner ON task_recurrence_segments
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions FORCE ROW LEVEL SECURITY;
CREATE POLICY task_completions_owner ON task_completions
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
