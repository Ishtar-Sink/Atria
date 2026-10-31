-- Contas do Atria. Não é conteúdo do usuário: não tem `owner_id` nem `visibility`
-- e o acesso passa só pelos serviços do contexto `auth`, com o papel conferido.
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'elevated', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    totp_secret_encrypted BYTEA NULL,
    totp_pending_secret_encrypted BYTEA NULL,
    totp_enabled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- Um único admin por instância, garantido no banco.
CREATE UNIQUE INDEX users_single_admin_key ON users ((true)) WHERE role = 'admin';
