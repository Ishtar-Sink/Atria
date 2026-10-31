-- Preferências do usuário, isoladas por Row Level Security.
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users (id),
    theme TEXT NOT NULL CHECK (theme IN ('light', 'dark', 'system')),
    locale TEXT NOT NULL,
    timezone TEXT NOT NULL,
    currency CHAR(3) NOT NULL,
    palette_shortcut TEXT NOT NULL,
    search_contexts TEXT[] NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY user_preferences_owner ON user_preferences
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- Configurações da instância: uma linha só. A senha do SMTP nunca vai para o banco:
-- vem só de `ATRIA_SMTP_PASSWORD_FILE`.
CREATE TABLE instance_settings (
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    invite_required BOOLEAN NOT NULL DEFAULT true,
    web_push_enabled BOOLEAN NOT NULL DEFAULT false,
    smtp_host TEXT NULL,
    smtp_port INTEGER NULL CHECK (smtp_port BETWEEN 1 AND 65535),
    smtp_user TEXT NULL,
    smtp_from TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO instance_settings (id) VALUES (true);
