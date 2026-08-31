import type { UUID } from "node:crypto";
import { pool, type Queryable } from '../db/pool.ts';
import { TenantsRepository } from '../repositories/tenants.repository.ts';
import { SubscriptionRepository, type SubscriptionRow } from '../repositories/subscriptions.repository.ts';
import { UsageEventsRepository, type UsageEventRow, type QuotaRow } from "../repositories/usage-events.repository.ts";
import { NotFoundError, ValidationError, TooManyRequests, PaymentRequired } from "../errors/error.ts";
import { PaginatedResult } from "../repositories/types.ts";


export interface QuotaResult{
    plan_limit: number,
    used: number
    requested: number,
    new_Usage: number,
    tenant_Id: number,
    allowed: boolean
}


export class MeterService{
    constructor(
            private readonly tenantsRepo = new TenantsRepository(),
            private readonly subscriptionRepo = new SubscriptionRepository(),
            private readonly eventsRepo = new UsageEventsRepository(),
            private readonly db: Queryable = pool,
        ) {}

    async recordUsage(
        input:{
            tenant_id: UUID,
            event_type: string,
            idempotency_key: string,
            quantity: number
        }
    ): Promise<UsageEventRow>{
        this.validateUsageInput(input);
        const existing = await this.findExistingUsage({
            tenant_id: input.tenant_id,
            idempotency_Key: input.idempotency_key
        });
        if(existing){
            return existing;
        }

        const subscription = await this.getSubscriptionPlan(input.tenant_id);
        if(!subscription){
            throw new NotFoundError(`Subscription for tenant: ${input.tenant_id} was not found`);
        }

        if(subscription.sub_status !== "active"){
            throw new PaymentRequired(`Your subscription is past due or inactive.`);
        }

        const quota = await this.checkQuota({
            tenant_id: input.tenant_id,
            type: input.event_type
        })

        if(quota.used + input.quantity > quota.limit){
            throw new TooManyRequests(`Limit has been reached for this subscription`);
        }

        const data = await this.eventsRepo.create(this.db, {
            tenant_id: input.tenant_id,
            idempotency_key: input.idempotency_key,
            event_type: input.event_type,
            quantity: input.quantity
        });

        if(!data){
            throw new Error("Error while saving new event usage");
        }
        return data;
    }

    private validateUsageInput(input: { event_type: string; idempotency_key: string; quantity: number }): void {
        if (input.event_type !== 'api_call' && input.event_type !== 'api_token') {
            throw new ValidationError('Event type must be api_call or api_token');
        }
        if (!input.idempotency_key?.trim()) {
            throw new ValidationError('Idempotency key is required');
        }
        if (!Number.isInteger(input.quantity) || input.quantity < 0) {
            throw new ValidationError('Usage quantity must be a non-negative integer');
        }
    }
    async checkQuota(
        input:{
            tenant_id: UUID,
            type: string,
        }
    ): Promise<QuotaRow>{
        const tenant = await this.tenantsRepo.findById(this.db, input.tenant_id);
        if(!tenant){
            throw new NotFoundError(`Tenant by Id: ${input.tenant_id} was not found`)
        }

        const current_quota = await this.eventsRepo.getCurrentQuota(this.db, input.tenant_id, input.type);
        if(!current_quota){
            throw new NotFoundError(`quota plan for user ${input.tenant_id} was not found`);
        }
        return current_quota!;
    }

    async getSubscriptionPlan(
        tenant_id: UUID
    ): Promise<SubscriptionRow | undefined>{
        const tenant = await this.tenantsRepo.findById(this.db, tenant_id);
        if(!tenant){
            throw new NotFoundError(`Tenant by Id: ${tenant_id} was not found`)
        }

        return await this.subscriptionRepo.findByTenantId(this.db, tenant_id);
    }

    async findExistingUsage(
        input:{
            tenant_id: UUID,
            idempotency_Key: string
        }
    ): Promise<UsageEventRow | undefined>{
        const tenant = await this.tenantsRepo.findById(this.db, input.tenant_id);
        if(!tenant){
            throw new NotFoundError(`Tenant by Id: ${input.tenant_id} was not found`)
        }

        return await this.eventsRepo.findByIdempotencyKey(this.db, input.tenant_id, input.idempotency_Key);
    }
    async getAll(
        page: number,
        pageNumber: number
    ): Promise<PaginatedResult<UsageEventRow>>{
        const tenants = await this.eventsRepo.getAll(this.db, page, pageNumber);
        return tenants
    }
    
}