-- Lembretes pontuais e recorrentes, a fila de disparo e as entregas (TASK-10).

CREATE TABLE reminders (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    notes TEXT NULL,
    timezone TEXT NOT NULL,
    remind_at TIMESTAMPTZ NULL,
    rule JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    -- Pontual (remind_at) ou recorrente (rule), nunca os dois nem nenhum.
    CHECK ((remind_at IS NULL) <> (rule IS NULL))
);

CREATE INDEX reminders_owner_id_idx ON reminders (owner_id);
CREATE INDEX reminders_owner_created_idx ON reminders (owner_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- Sem conteúdo pessoal (só ids e o instante) e sem RLS: o disparo acha os lembretes
-- vencidos de todos os usuários sem contornar a RLS das outras tabelas.
CREATE TABLE reminder_schedule (
    reminder_id UUID PRIMARY KEY REFERENCES reminders (id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    next_fire_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX reminder_schedule_next_fire_at_idx ON reminder_schedule (next_fire_at);

CREATE TABLE reminder_deliveries (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    reminder_id UUID NOT NULL REFERENCES reminders (id) ON DELETE CASCADE,
    fire_at TIMESTAMPTZ NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL,
    push_status TEXT NOT NULL CHECK (push_status IN ('sent', 'skipped', 'failed')),
    -- Disparo único por ocorrência.
    UNIQUE (reminder_id, fire_at)
);

CREATE INDEX reminder_deliveries_owner_id_idx ON reminder_deliveries (owner_id);
CREATE INDEX reminder_deliveries_reminder_id_idx ON reminder_deliveries (reminder_id);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders FORCE ROW LEVEL SECURITY;
CREATE POLICY reminders_owner ON reminders
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE reminder_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY reminder_deliveries_owner ON reminder_deliveries
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
