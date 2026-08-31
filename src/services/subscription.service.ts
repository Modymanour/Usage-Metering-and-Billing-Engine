import type { UUID } from 'node:crypto';
import { pool, type Queryable } from '../db/pool.ts';
import { TenantsRepository } from '../repositories/tenants.repository.ts';
import { SubscriptionRepository, type SubscriptionRow } from '../repositories/subscriptions.repository.ts';
import { PlansRepository } from '../repositories/plans.repository.ts';
import { NotFoundError, ValidationError } from "../errors/error.ts";
import { PaginatedResult } from '../repositories/types.ts';
import { StripeWebhookService } from './stripe-webhook.service.ts';

type SubscriptionStatus = 'active' | 'trialing' | 'cancelled' | 'expired';

export class SubscriptionService {
    constructor(
        private readonly tenantsRepo = new TenantsRepository(),
        private readonly subscriptionRepo = new SubscriptionRepository(),
        private readonly planRepo = new PlansRepository(),
        private readonly stripeService = new StripeWebhookService(),
        private readonly db: Queryable = pool,
    ) {}

    async create(
        input:{
            tenant_id: UUID,
            plan_name: string,
            start_from: Date,
            ends_at: Date,
        }
    ): Promise<SubscriptionRow>{
        this.validatePlanName(input.plan_name);
        this.validateDateRange(input.start_from, input.ends_at);

        const [tenant, plan] = await Promise.all([
            this.tenantsRepo.findById(this.db,input.tenant_id),
            this.planRepo.findByName(this.db,input.plan_name)
        ])
        if(!tenant) throw new NotFoundError(`Tenant by id: ${input.tenant_id} not found`);
        if(!plan) throw new NotFoundError(`Plan by name of: ${input.plan_name} not found`);

        if(input.plan_name === "Free"){
            const subscription = await this.subscriptionRepo.create(this.db, {
                tenant_id: tenant.id,
                plan_id: plan.id,
                sub_status: "active",
                start_from: input.start_from,
                ends_at: input.ends_at,
                stripe_id: null,
            });
            if (!subscription) throw new Error('Subscription was not created');
            return subscription;
        }
        // else the plan is Pro
        const subscription = await this.subscriptionRepo.create(this.db, {
            tenant_id: tenant.id,
            plan_id: plan.id,
            sub_status: "trialing",
            start_from: input.start_from,
            ends_at: input.ends_at,
            stripe_id: null,
        });
        if (!subscription) throw new Error('Subscription was not created');

        const stripe_subscription = await this.stripeService.createSubscription(tenant.stripe_customer_id, plan.stripe_price_id, tenant.id, "Pro");
        await this.subscriptionRepo.assignStripeId(this.db, subscription.id, stripe_subscription.id);

        return subscription;
    }

    async update_subscription_plan(
        input:{
            sub_id: UUID,
            new_plan_name: string
        }
    ): Promise<SubscriptionRow>{
        this.validatePlanName(input.new_plan_name);

        const [subscription, plan] = await Promise.all([
            this.subscriptionRepo.findById(this.db, input.sub_id),
            this.planRepo.findByName(this.db, input.new_plan_name)
        ])
        if(!subscription) throw new NotFoundError(`Subscription by id: ${input.sub_id} does not exist`);
        if(!plan) throw new NotFoundError(`Plan by name of: ${input.new_plan_name} not found`);

        const tenant = await this.tenantsRepo.findById(this.db,subscription.tenant_id);
        if(!tenant) throw new NotFoundError(`Tenant by id: ${subscription.tenant_id} not found`);

        const new_subscription = await this.subscriptionRepo.update(this.db,{
            id: subscription.id,
            tenant_id: null,
            plan_id: plan.id,
            start_from: null,
            sub_status: "trialing",
            ends_at: null,
        })
        if (!new_subscription) throw new Error('Subscription plan was not updated');
        const stripe_subscription = await this.stripeService.createSubscription(tenant.stripe_customer_id, plan.stripe_price_id, tenant.id, "Pro");
        await this.subscriptionRepo.assignStripeId(this.db, subscription.id, stripe_subscription.id);

        return new_subscription;
    }

    async change_subscription_status(
        input:{
            sub_id: UUID,
            new_state: SubscriptionStatus,
        }
    ): Promise<SubscriptionRow>{
        const subscription = await this.subscriptionRepo.findById(this.db, input.sub_id);

        if(!subscription) throw new NotFoundError(`Subscription by id: ${input.sub_id} does not exist`);
        this.validateStatus(input.new_state);

        const new_subscription = await this.subscriptionRepo.update(this.db,{
            id: subscription.id,
            tenant_id: null,
            plan_id: null,
            start_from: null,
            sub_status: input.new_state,
            ends_at: null,
        })

        if (!new_subscription) throw new Error('Subscription status was not updated');
        return new_subscription;
    }

    async delete_subscription(
        sub_id:UUID
    ): Promise<void>{
        const subscription = await this.get_subscription(sub_id);
        await this.subscriptionRepo.remove_subscription(this.db, subscription.id);
    }

    async get_subscription(
        sub_id:UUID
    ): Promise<SubscriptionRow>{
        const subscription = await this.subscriptionRepo.findById(this.db,sub_id);

        if(!subscription){
            throw new NotFoundError(`Subscription with id: ${sub_id} was not found`)
        }
        return subscription;
    }
    async getAll(
            page: number,
            pageNumber: number
        ): Promise<PaginatedResult<SubscriptionRow>>{
            const rows = await this.subscriptionRepo.getAll(this.db, page, pageNumber);
            return rows
        }
    private validatePlanName(planName: string): string {
        const normalizedPlanName = planName?.trim();

        if (!normalizedPlanName) {
            throw new ValidationError('Plan name is required');
        }

        return normalizedPlanName;
    }

    private validateDateRange(startFrom: Date, endsAt: Date): void {
        if (!(startFrom instanceof Date) || Number.isNaN(startFrom.getTime())) {
            throw new ValidationError('Subscription start date is invalid');
        }

        if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) {
            throw new ValidationError('Subscription end date is invalid');
        }

        if (startFrom >= endsAt) {
            throw new ValidationError('Subscription start date must be before its end date');
        }
    }

    private validateStatus(status: string): asserts status is SubscriptionStatus {
        if (status !== 'cancelled' && status !== 'expired') {
            throw new ValidationError('Subscription status must be cancelled or expired');
        }
    }
}