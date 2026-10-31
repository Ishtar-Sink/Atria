-- Projetos, raias e cartões do quadro (RF-54 a RF-57). Sem chave estrangeira para
-- tabelas de outro contexto: a ligação cartão-tarefa é do contexto `links` (RN-20).

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Função `IMMUTABLE` prefixada `projects_` para a coluna gerada do `tsvector`
-- ([project/database-06]) e para a consulta de busca usarem a mesma normalização.
CREATE FUNCTION projects_unaccent(input text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, input) $$;

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    description TEXT NULL CHECK (description IS NULL OR char_length(description) <= 10000),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('portuguese', projects_unaccent(name || ' ' || coalesce(description, '')))
    ) STORED
);

CREATE INDEX projects_owner_created_idx ON projects (owner_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX projects_search_idx ON projects USING GIN (search_vector);

CREATE TABLE project_lanes (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    system_key TEXT NULL CHECK (system_key IN ('waiting', 'in_progress', 'done')),
    name TEXT NULL CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 100),
    CONSTRAINT project_lanes_system_key_or_name CHECK (system_key IS NOT NULL OR name IS NOT NULL),
    -- HEX livre (PD-12); o domínio grava em minúsculas.
    color TEXT NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$'),
    -- Os cartões desta raia entram no progresso do projeto (PD-43).
    counts_as_done BOOLEAN NOT NULL DEFAULT false,
    position INT NOT NULL CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    -- Adiável: a reordenação passa por posições repetidas dentro da transação.
    CONSTRAINT project_lanes_position_uniq UNIQUE (project_id, position)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX project_lanes_project_idx ON project_lanes (project_id);

CREATE TABLE project_cards (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    lane_id UUID NOT NULL REFERENCES project_lanes (id),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
    description TEXT NULL CHECK (description IS NULL OR char_length(description) <= 10000),
    priority TEXT NULL CHECK (priority IN ('low', 'medium', 'high')),
    labels TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(labels) <= 20),
    due_date DATE NULL,
    position INT NOT NULL CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('portuguese', projects_unaccent(title || ' ' || coalesce(description, '')))
    ) STORED
);

CREATE INDEX project_cards_project_idx ON project_cards (project_id);
CREATE INDEX project_cards_lane_idx ON project_cards (lane_id);
CREATE INDEX project_cards_search_idx ON project_cards USING GIN (search_vector);
CREATE INDEX project_cards_due_idx ON project_cards (project_id, due_date)
    WHERE deleted_at IS NULL AND due_date IS NOT NULL;
-- Parcial: não é adiável, então a reordenação dos cartões passa por posições
-- temporárias (ver `pg_project_repository`).
CREATE UNIQUE INDEX project_cards_position_uniq ON project_cards (lane_id, position)
    WHERE deleted_at IS NULL;

CREATE TABLE project_card_checklist_items (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    card_id UUID NOT NULL REFERENCES project_cards (id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
    done BOOLEAN NOT NULL DEFAULT false,
    position INT NOT NULL CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    -- Adiável: o checklist é regravado inteiro dentro da transação.
    CONSTRAINT project_card_checklist_items_position_uniq UNIQUE (card_id, position)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX project_card_checklist_items_card_idx ON project_card_checklist_items (card_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
-- O `NULLIF` evita erro numa conexão reaproveitada do pool, em que o valor fica ''.
CREATE POLICY projects_owner_isolation ON projects
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE project_lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_lanes FORCE ROW LEVEL SECURITY;
CREATE POLICY project_lanes_owner_isolation ON project_lanes
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE project_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_cards FORCE ROW LEVEL SECURITY;
CREATE POLICY project_cards_owner_isolation ON project_cards
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE project_card_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_card_checklist_items FORCE ROW LEVEL SECURITY;
CREATE POLICY project_card_checklist_items_owner_isolation ON project_card_checklist_items
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
