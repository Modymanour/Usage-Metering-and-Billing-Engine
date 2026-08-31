ALTER TABLE tenants
ADD stripe_customer_id varchar(256);

ALTER TABLE plans
ADD stripe_price_id varchar(256);

UPDATE plans
SET stripe_price_id = 'price_1UAXLtAk3H6KlNzZhrcoD1C4'
WHERE plan_name = 'Pro';