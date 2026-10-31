-- Tentativas com bloqueio progressivo. A chave é `email:<hash>` ou `ip:<endereço>`
-- (e variantes por fluxo), nunca o e-mail em claro.
CREATE TABLE auth_attempts (
    key TEXT PRIMARY KEY,
    failures INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
