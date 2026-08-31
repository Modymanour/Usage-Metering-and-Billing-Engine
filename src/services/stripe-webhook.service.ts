import Stripe from 'stripe';
import type { Queryable } from '../db/pool.ts';
import { pool } from '../db/pool.ts';
import { StripeEventsRepository } from '../repositories/stripe-events.repository.ts';
import { SubscriptionRepository } from '../repositories/subscriptions.repository.ts';
import { TenantsRepository } from '../repositories/tenants.repository.ts';
import { PlansRepository } from '../repositories/plans.repository.ts';
import { NotFoundError, ValidationError } from '../errors/error.ts';
import dotenv from 'dotenv';
import path from 'node:path';
import { UUID } from 'node:crypto';

const directoryPath = import.meta.dirname
dotenv.config({ path: path.resolve(directoryPath, '../config/.env') });
export class StripeWebhookService {
    constructor(
        private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? ''),
        private readonly stripeEventsRepo = new StripeEventsRepository(),
        private readonly subscriptionRepo = new SubscriptionRepository(),
        private readonly tenantRepo = new TenantsRepository(),
        private readonly plansRepo = new PlansRepository(),
        private readonly db: Queryable = pool,
    ) {}

    async process(event: Stripe.Event): Promise<{ duplicate: boolean }> {
        const stripeEventId = event.id;
        if (await this.stripeEventsRepo.findByStripeId(this.db, stripeEventId)) {
            return { duplicate: true };
        }

        if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
            await this.syncSubscription(event.data.object as Stripe.Subscription);
        } else if (event.type === 'customer.subscription.deleted') {
            await this.cancelSubscription(event.data.object as Stripe.Subscription);
        }

        await this.stripeEventsRepo.create(this.db, {
            stripe_id: stripeEventId,
            event_type: event.type,
        });

        return { duplicate: false };
    }
    async createCustomer(
        tenantId: UUID,
        name: string,
        email: string,
    ): Promise<Stripe.Customer> {
        const customer = await this.stripe.customers.create({
            name,
            email,
            metadata: {
                tenant_id: tenantId,
            },
        });
        const paymentMethod =
            await this.stripe.paymentMethods.create({
                type: 'card',
                card: {
                    token: 'tok_visa',
                },
            });

        await this.stripe.paymentMethods.attach(
            paymentMethod.id,
            {
                customer: customer.id,
            }
        );

        await this.stripe.customers.update(
            customer.id,
            {
                invoice_settings: {
                    default_payment_method: paymentMethod.id,
                },
            }
        );
        return customer;
    }

    async createSubscription(
        stripe_customer_id: string,
        stripe_price_id: string,
        tenant_id: UUID,
        plan_name: string 
    ): Promise<Stripe.Response<Stripe.Subscription>>{
        return await this.stripe.subscriptions.create({
            customer: stripe_customer_id,
            items: [
                {
                    price: stripe_price_id,
                },
            ],
            metadata: {
                tenant_id: tenant_id,
                plan_name: plan_name,
            },
        });
    }
    private async syncSubscription(subscription: Stripe.Subscription): Promise<void> {
        const tenantId = subscription.metadata.tenant_id;
        const planName = subscription.metadata.plan_name;
        if (!tenantId || !planName) {
            throw new ValidationError('Stripe subscription metadata must include tenant_id and plan_name');
        }

        const tenant = await this.tenantRepo.findById(this.db, tenantId as `${string}-${string}-${string}-${string}-${string}`);
        if (!tenant) throw new NotFoundError(`Tenant by id: ${tenantId} not found`);
        const plan = await this.plansRepo.findByName(this.db, planName);
        if (!plan) throw new NotFoundError(`Plan by name of: ${planName} not found`);

        const period = subscription.items.data[0];
        if (!period) {
            throw new ValidationError('Stripe subscription has no billing period');
        }
        const startFrom = new Date(period.current_period_start * 1000);
        const endsAt = new Date(period.current_period_end * 1000);
        const status = subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'expired';
        const existing = await this.subscriptionRepo.findByStripeId(this.db, subscription.id);

        if (existing) {
            await this.subscriptionRepo.update(this.db, {
                id: existing.id,
                tenant_id: null,
                plan_id: plan.id,
                sub_status: status,
                start_from: startFrom,
                ends_at: endsAt,
            });
            return;
        }

        await this.subscriptionRepo.create(this.db, {
            tenant_id: tenant.id,
            plan_id: plan.id,
            sub_status: status,
            start_from: startFrom,
            ends_at: endsAt,
            stripe_id: subscription.id,
        });
    }

    private async cancelSubscription(subscription: Stripe.Subscription): Promise<void> {
        const existing = await this.subscriptionRepo.findByStripeId(this.db, subscription.id);
        if (!existing) return;
        await this.subscriptionRepo.update(this.db, {
            id: existing.id,
            tenant_id: null,
            plan_id: null,
            sub_status: 'cancelled',
            start_from: null,
            ends_at: null,
        });
    }
}