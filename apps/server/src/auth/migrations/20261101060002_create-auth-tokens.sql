-- Convites e tokens de redefinição: só o hash do token fica no banco.
CREATE TABLE invites (
    id UUID PRIMARY KEY,
    token_hash BYTEA NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES users (id),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    used_by UUID NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invites_created_by_idx ON invites (created_by);
CREATE INDEX invites_used_by_idx ON invites (used_by);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY,
    token_hash BYTEA NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users (id),
    origin TEXT NOT NULL CHECK (origin IN ('email', 'admin')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
