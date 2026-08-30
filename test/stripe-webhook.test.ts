import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import { StripeWebhookService } from '../src/services/stripe-webhook.service';

const tenantId = '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`;
const subscription = {
    id: 'sub_test',
    metadata: { tenant_id: tenantId, plan_name: 'Pro' },
    status: 'active',
    items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_700_086_400 }] },
} as unknown as Stripe.Subscription;

function event(type: Stripe.Event.Type, object: Stripe.Event.Data.Object = subscription): Stripe.Event {
    return { id: 'evt_test', type, data: { object } } as Stripe.Event;
}

test('Stripe webhook ignores an already recorded event', async () => {
    let created = false;
    const service = new StripeWebhookService(
        { findByStripeId: async () => ({ id: 'event' }), create: async () => { created = true; } } as never,
        {} as never, {} as never, {} as never, {} as never,
    );
    assert.deepEqual(await service.process(event('customer.subscription.updated')), { duplicate: true });
    assert.equal(created, false);
});

test('Stripe webhook creates an active subscription from metadata', async () => {
    let input: Record<string, unknown> | undefined;
    const service = new StripeWebhookService(
        { findByStripeId: async () => undefined, create: async () => ({}) } as never,
        { findByStripeId: async () => undefined, create: async (db: unknown, value: Record<string, unknown>) => { input = value; return value; } } as never,
        { findById: async () => ({ id: tenantId }) } as never,
        { findByName: async () => ({ id: 'plan' }) } as never,
        {} as never,
    );
    assert.deepEqual(await service.process(event('customer.subscription.created')), { duplicate: false });
    assert.equal(input?.tenant_id, tenantId);
    assert.equal(input?.plan_id, 'plan');
    assert.equal(input?.sub_status, 'active');
    assert.equal(input?.stripe_id, 'sub_test');
});

test('Stripe webhook marks an existing deleted subscription cancelled', async () => {
    let status: unknown;
    const service = new StripeWebhookService(
        { findByStripeId: async () => undefined, create: async () => ({}) } as never,
        { findByStripeId: async () => ({ id: 'local-sub' }), update: async (db: unknown, value: Record<string, unknown>) => { status = value.sub_status; return value; } } as never,
        {} as never, {} as never, {} as never,
    );
    await service.process(event('customer.subscription.deleted'));
    assert.equal(status, 'cancelled');
});
