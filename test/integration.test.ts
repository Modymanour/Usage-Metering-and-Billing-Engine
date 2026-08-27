import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PlansRepository } from '../src/repositories/plans.repository';
import { TenantsRepository } from '../src/repositories/tenants.repository';
import { SubscriptionRepository } from '../src/repositories/subscriptions.repository';
import { UsageEventsRepository } from '../src/repositories/usage-events.repository';
import { MeterService } from '../src/services/meter.service';

const connectionString = process.env.TEST_DATABASE_URL;

test('tenant to subscription to usage to quota data flow', { skip: !connectionString }, async () => {
    const db = new Pool({ connectionString });
    const tenantId = randomUUID();
    const planName = `Integration-${randomUUID()}`;
    const tenants = new TenantsRepository();
    const plans = new PlansRepository();
    const subscriptions = new SubscriptionRepository();
    const events = new UsageEventsRepository();

    try {
        const tenant = await tenants.create(db, { name: 'Integration Tenant', email: `${tenantId}@test.invalid`, password: 'integration-secret' });
        assert.ok(tenant);
        const plan = await plans.create(db, { name: planName, api_call_limit: 10, api_token_limit: 100 });
        const start = new Date(Date.now() - 60_000);
        const end = new Date(Date.now() + 3_600_000);
        const createdSubscription = await subscriptions.create(db, {
            tenant_id: tenant.id,
            plan_id: plan.id,
            sub_status: 'active',
            start_from: start,
            ends_at: end,
            stripe_id: null,
        });
        assert.equal(createdSubscription.plan_id, plan.id);

        const meter = new MeterService(tenants, subscriptions, events, db);
        const recorded = await meter.recordUsage({ tenant_id: tenant.id, event_type: 'api_call', idempotency_key: 'integration-key', quantity: 4 });
        assert.equal(recorded.quantity, 4);

        const quota = await meter.checkQuota({ tenant_id: tenant.id, type: 'api_call' });
        assert.equal(quota.limit, 10);
        assert.equal(quota.used, 4);
        assert.equal((await meter.recordUsage({ tenant_id: tenant.id, event_type: 'api_call', idempotency_key: 'integration-key', quantity: 4 })).id, recorded.id);
        assert.equal((await events.getUsageSummary(db, tenant.id))?.apiCalls.remaining, 6);
    } finally {
        await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        await db.query('DELETE FROM plans WHERE plan_name = $1', [planName]);
        await db.end();
    }
});
