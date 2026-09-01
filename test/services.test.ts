import assert from 'node:assert/strict';
import test from 'node:test';
import { MeterService} from '../src/services/meter.service';
import { NotFoundError, TooManyRequests, ValidationError } from '../src/errors/error';
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

test('meter rejects invalid type and quota overflow', async () => {
    await assert.rejects(() => meter().recordUsage({ tenant_id: tenantId, event_type: 'other', idempotency_key: 'key', quantity: 1, input_tokens: null, cached_input_tokens: null, output_tokens: null, reasoning_tokens: null }), ValidationError);
    await assert.rejects(() => meter().recordUsage({ tenant_id: tenantId, event_type: 'api_token', idempotency_key: 'key', quantity: null, input_tokens: null, cached_input_tokens: null, output_tokens: null, reasoning_tokens: null }), ValidationError);

    const full = meter({ eventsRepo: { getCurrentQuota: async () => ({ tenant_id: tenantId, subscription_id: 'sub', plan_id: 'plan', plan_name: 'Free', api_call_limit: 3, api_call_used: 2, input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, total_tokens: 0, token_limit: 10, start_from: new Date(), end_at: new Date(Date.now() + 1000) }) } });
    await assert.rejects(() => full.recordUsage({ tenant_id: tenantId, event_type: 'api_call', idempotency_key: 'new', quantity: 2, input_tokens: null, cached_input_tokens: null, output_tokens: null, reasoning_tokens: null }), TooManyRequests);
});

test('meter reports missing tenant and subscription', async () => {
    const missingTenant = meter({ tenantsRepo: { findById: async () => undefined } });
    await assert.rejects(() => missingTenant.checkQuota(tenantId), NotFoundError);
    const missingSubscription = meter({ subscriptionRepo: { findByTenantId: async () => undefined } });
    await assert.rejects(() => missingSubscription.recordUsage({ tenant_id: tenantId, event_type: 'api_call', idempotency_key: 'new', quantity: 1, input_tokens: null, cached_input_tokens: null, output_tokens: null, reasoning_tokens: null }), NotFoundError);
});

test('tenant and subscription services validate input and map repository results', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000000';

    const mockTenantsRepo = {
        create: async (_db: unknown, input: { name: string; email: string; password: string }) => ({
            id: tenantId,
            display_name: input.name,
            email: input.email,
            created_at: new Date()
        }),
        asignStripeId: async (_db: unknown, _tenantId: string, _stripeId: string) => ({
            id: tenantId,
            display_name: 'Acme',
            email: 'a@b.test',
            stripe_customer_id: _stripeId,
            created_at: new Date()
        })
    };

    const mockStripeService = {
        createCustomer: async () => ({ id: 'stripe_cust_123' }),
        createSubscription: async () => ({ id: 'stripe_sub_123' })
    };

    const tenantService = new TenantsService(
        mockTenantsRepo as never,
        mockStripeService as never,
        {} as never
    );

    assert.equal((await tenantService.create({ name: '  Acme  ', email: 'a@b.test', password: 'secret' })).display_name, 'Acme');
    await assert.rejects(() => tenantService.create({ name: ' ', email: 'a@b.test', password: 'secret' }), /Tenant name is required/);

    const subscriptionService = new SubscriptionService(
        { findById: async () => undefined } as never,
        { findById: async () => undefined } as never,
        { findByName: async () => undefined } as never,
        mockStripeService as never,
        {} as never
    );

    await assert.rejects(() => subscriptionService.get_subscription('missing' as never), (error: unknown) =>
        error instanceof Error && error.name === 'NotFoundError' && error.message.includes('missing'));
    await assert.rejects(() => subscriptionService.create({ tenant_id: tenantId as never, plan_name: 'Free', start_from: new Date(2), ends_at: new Date(1)}), (error: unknown) =>
        error instanceof Error && error.name === 'ValidationError' && error.message.includes('before'));
});
