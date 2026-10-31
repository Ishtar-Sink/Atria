-- Inscrições Web Push dos navegadores de cada pessoa (TASK-10).

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    endpoint TEXT NOT NULL CHECK (char_length(endpoint) <= 2048),
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (owner_id, endpoint)
);

CREATE INDEX push_subscriptions_owner_id_idx ON push_subscriptions (owner_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY push_subscriptions_owner ON push_subscriptions
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
