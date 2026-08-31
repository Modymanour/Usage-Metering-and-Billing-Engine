CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'cancelled', 'expired');

CREATE TABLE IF NOT EXISTS tenants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    display_name VARCHAR(100) NOT NULL CHECK (length(trim(display_name)) > 0)
);

CREATE TABLE IF NOT EXISTS plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    plan_name       VARCHAR(50) NOT NULL UNIQUE CHECK (length(trim(plan_name)) > 0),
    api_call_limit  INTEGER NOT NULL CHECK (api_call_limit >= 0),
    api_token_limit INTEGER NOT NULL CHECK (api_token_limit >= 0)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id      UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sub_status   subscription_status NOT NULL DEFAULT 'active',
    start_from   TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    CHECK (start_from < ends_at),
    UNIQUE (tenant_id, start_from)
);

CREATE TABLE IF NOT EXISTS user_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idempotency_key VARCHAR(255) NOT NULL,
    event_type      VARCHAR(50) NOT NULL CHECK (length(trim(event_type)) > 0),
    quantity        INTEGER NOT NULL CHECK (quantity >= 0),
    UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS stripe_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type   VARCHAR(100) NOT NULL,
    stripe_id    VARCHAR(255) NOT NULL UNIQUE
);
