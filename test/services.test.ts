import assert from 'node:assert/strict';
import test from 'node:test';
import { MeterService, NotFoundError, ValidationError } from '../src/services/meter.service';
import { SubscriptionService } from '../src/services/subscription.service';
import { TenantsService } from '../src/services/tenants.service';

const tenantId = '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`;
const subscription = { id: 'sub', tenant_id: tenantId, plan_id: 'plan', sub_status: 'active', created_at: new Date(), start_from: new Date(), ends_at: new Date(Date.now() + 1000), stripe_id: null };
const event = { id: 'event', tenant_id: tenantId, created_at: new Date(), idempotency_key: 'key', event_type: 'api_call', quantity: 2 };

function meter(overrides: Record<string, unknown> = {}) {
    const tenantsRepo = { findById: async () => ({ id: tenantId }) };
    const subscriptionRepo = { findByTenantId: async () => subscription };
    const eventsRepo = {
        findByIdempotencyKey: async () => undefined,
        getCurrentQuota: async () => ({ tenant_id: tenantId, subscription_id: 'sub', plan_id: 'plan', plan_name: 'Free', limit: 10, used: 2, event_type: 'api_call', start_from: new Date(), end_at: new Date() }),
        create: async () => event,
    };
    return new MeterService({ ...tenantsRepo, ...(overrides.tenantsRepo as object) } as never, { ...subscriptionRepo, ...(overrides.subscriptionRepo as object) } as never, { ...eventsRepo, ...(overrides.eventsRepo as object) } as never);
}

test('meter records allowed usage and returns the persisted event', async () => {
    const result = await meter().recordUsage({ tenant_id: tenantId, event_type: 'api_call', idempotency_key: 'key', quantity: 2 });
    assert.equal(result, event);
});

test('meter returns an existing idempotent event without checking quota', async () => {
    const existing = { ...event, quantity: 9 };
    const service = meter({ eventsRepo: { findByIdempotencyKey: async () => existing, getCurrentQuota: async () => { throw new Error('quota should not be read'); } } });
    assert.equal(await service.recordUsage({ tenant_id: tenantId, event_type: 'api_call', idempotency_key: 'key', quantity: 2 }), existing);
});

test('meter rejects invalid type, quantity, and quota overflow', async () => {
    await assert.rejects(() => meter().recordUsage({ tenant_id: tenantId, event_type: 'other', idempotency_key: 'key', quantity: 1 }), ValidationError);
    await assert.rejects(() => meter().recordUsage({ tenant_id: tenantId, event_type: 'api_call', idempotency_key: 'key', quantity: -1 }), ValidationError);
    const full = meter({ eventsRepo: { getCurrentQuota: async () => ({ limit: 3, used: 2 }) } });
    await assert.rejects(() => full.recordUsage({ tenant_id: tenantId, event_type: 'api_call', idempotency_key: 'new', quantity: 2 }), ValidationError);
});

test('meter reports missing tenant and subscription', async () => {
    const missingTenant = meter({ tenantsRepo: { findById: async () => undefined } });
    await assert.rejects(() => missingTenant.checkQuota({ tenant_id: tenantId, type: 'api_call' }), NotFoundError);
    const missingSubscription = meter({ subscriptionRepo: { findByTenantId: async () => undefined } });
    await assert.rejects(() => missingSubscription.recordUsage({ tenant_id: tenantId, event_type: 'api_call', idempotency_key: 'new', quantity: 1 }), NotFoundError);
});

test('tenant and subscription services validate input and map repository results', async () => {
    const tenantService = new TenantsService({ create: async (_db: unknown, input: { name: string; email: string; password: string }) => ({ id: tenantId, display_name: input.name, email: input.email, created_at: new Date() }) } as never, {} as never);
    assert.equal((await tenantService.create({ name: '  Acme  ', email: 'a@b.test', password: 'secret' })).display_name, 'Acme');
    await assert.rejects(() => tenantService.create({ name: ' ', email: 'a@b.test', password: 'secret' }), /Tenant name is required/);

    const subscriptionService = new SubscriptionService({ findById: async () => undefined } as never, { findById: async () => undefined } as never, {} as never, {} as never);
    await assert.rejects(() => subscriptionService.get_subscription('missing' as never), (error: unknown) =>
        error instanceof Error && error.name === 'NotFoundError' && error.message.includes('missing'));
    await assert.rejects(() => subscriptionService.create({ tenant_id: tenantId, plan_name: 'Free', start_from: new Date(2), ends_at: new Date(1) }), (error: unknown) =>
        error instanceof Error && error.name === 'ValidationError' && error.message.includes('before'));
});
