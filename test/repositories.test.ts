import assert from 'node:assert/strict';
import test from 'node:test';
import { PlansRepository } from '../src/repositories/plans.repository';
import { SubscriptionRepository } from '../src/repositories/subscriptions.repository';
import { TenantsRepository } from '../src/repositories/tenants.repository';
import { UsageEventsRepository } from '../src/repositories/usage-events.repository';
import { StripeEventsRepository } from '../src/repositories/stripe-events.repository';
import { FakeDb, lastCall } from './helpers';

const id = '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`;
const row = { id };

test('plans repository creates, reads, updates, and deletes with correct SQL', async () => {
    const db = new FakeDb();
    const repository = new PlansRepository();
    db.queue(row); await repository.create(db, { name: 'Free', api_call_limit: 10, api_token_limit: 20 });
    assert.match(lastCall(db).text, /INSERT INTO plans/);
    assert.deepEqual(lastCall(db).values, ['Free', 10, 20]);
    db.queue(row); await repository.findByName(db, 'FREE');
    assert.deepEqual(lastCall(db).values, ['free']);
    db.queue(row); await repository.update(db, { id, name: null, api_call_limit: 30, api_token_limit: null });
    assert.match(lastCall(db).text, /plan_name\s*=.*api_call_limit.*,/s);
    db.queue(); await repository.remove_plan(db, id);
    assert.deepEqual(lastCall(db).values, [id]);
});

test('tenant, subscription, usage, and Stripe repositories pass parameters and return rows', async () => {
    const db = new FakeDb();
    const tenant = new TenantsRepository();
    const subscriptions = new SubscriptionRepository();
    const usage = new UsageEventsRepository();
    const stripe = new StripeEventsRepository();

    db.queue(row); await tenant.create(db, { name: 'Tenant', email: 'a@b.test', password: 'secret' });
    assert.deepEqual(lastCall(db).values, ['Tenant', 'a@b.test', 'secret']);

    db.queue(row); await subscriptions.findByTenantId(db, id);
    assert.match(lastCall(db).text, /s\.start_from/);
    assert.doesNotMatch(lastCall(db).text, /started_from/);

    db.queue(row); await usage.create(db, { tenant_id: id, idempotency_key: 'key', event_type: 'api_call', quantity: 2, input_tokens: null, cached_input_tokens: null, output_tokens: null, reasoning_tokens: null });
    assert.deepEqual(lastCall(db).values, [id, 'key', 'api_call', 2, null, null, null, null]);

    db.queue(row); await usage.getCurrentQuota(db, id);
    assert.match(lastCall(db).text, /AS start_from/);
    assert.match(lastCall(db).text, /AS end_at/);

    db.queue(row); await usage.getUsageSummary(db, id);
    assert.deepEqual(lastCall(db).values, [id]);

    db.queue(row); await stripe.findByStripeId(db, 'evt_1');
    assert.deepEqual(lastCall(db).values, ['evt_1']);
});
