INSERT INTO plans (plan_name,api_call_limit,api_token_limit)
VALUES ('Free', 1000, 100000), ('Pro', 10000, 1000000);

ALTER TABLE tenants
ADD email varchar(255) NOT NULL CHECK(LENGTH(email) > 0);

ALTER TABLE tenants
ADD password varchar(1000) NOT NULL CHECK(LENGTH(password) > 0);

ALTER TABLE subscriptions
ADD stripe_id varchar(255);

ALTER TABLE user_events
ADD CONSTRAINT unique_tenant_idempotency_key
UNIQUE (tenant_id, idempotency_key);