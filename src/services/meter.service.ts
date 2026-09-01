import type { UUID } from "node:crypto";
import { pool, type Queryable } from '../db/pool.ts';
import { TenantsRepository } from '../repositories/tenants.repository.ts';
import { SubscriptionRepository, type SubscriptionRow } from '../repositories/subscriptions.repository.ts';
import { UsageEventsRepository, type UsageEventRow, type QuotaRow } from "../repositories/usage-events.repository.ts";
import { NotFoundError, ValidationError, TooManyRequests, PaymentRequired } from "../errors/error.ts";
import { PaginatedResult } from "../repositories/types.ts";
import { CostService, CostBreakdown } from "./cost.service.ts";
import { PRICING } from "../config/pricing.config.ts";


export interface QuotaResult{
    plan_limit: number,
    used: number
    requested: number,
    new_Usage: number,
    tenant_Id: number,
    allowed: boolean
}

export interface CurrentUsage{
    month: Date,
    apiCall:{
        used: number,
        limit: number
    },
    aiTokens:{
        input_token: number,
        cached_input_tokens: number,
        output_tokens: number,
        reasoning_tokens: number,
        total_used: number,
        limit: number,
    },
    cost:{
        apiCallsCents: number,
        aiTokensCents: number,
        totalCents: number
    }
}


export class MeterService{
    constructor(
            private readonly tenantsRepo = new TenantsRepository(),
            private readonly subscriptionRepo = new SubscriptionRepository(),
            private readonly eventsRepo = new UsageEventsRepository(),
            private readonly costService = new CostService(),
            private readonly db: Queryable = pool,
        ) {}

    async recordUsage(
        input:{
            tenant_id: UUID,
            event_type: string,
            idempotency_key: string,
            quantity: number | null,
            input_tokens: number | null,
            cached_input_tokens: number | null,
            output_tokens: number | null,
            reasoning_tokens: number | null
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

        const quota = await this.checkQuota(input.tenant_id);

        if(input.event_type === "api_call"){
            if (input.quantity == null) {
                throw new ValidationError('Quantity is required for api_call events');
            }

            if(quota.api_call_used + input.quantity > quota.api_call_limit){
                throw new TooManyRequests(`Api Call Limit has been reached for this subscription`);
            }
    
            const data = await this.eventsRepo.create(this.db,{
                tenant_id: subscription.tenant_id,
                event_type: input.event_type,
                idempotency_key: input.idempotency_key,
                quantity: input.quantity,
                input_tokens: null,
                cached_input_tokens: null,
                output_tokens: null,
                reasoning_tokens: null
            });
    
            if(!data){
                throw new Error("Error while saving new event usage");
            }
            return data;
        }
        else{
            if(input.cached_input_tokens == null || input.reasoning_tokens == null || input.input_tokens == null || input.output_tokens == null){
                throw new ValidationError('Token values are required for api_token events');
            }
            if(input.cached_input_tokens + input.reasoning_tokens + input.input_tokens + input.output_tokens + quota.total_tokens > quota.token_limit){
                throw new TooManyRequests(`Token Limit has been reached for this subscription`);
            }
    
            const data = await this.eventsRepo.create(this.db,{
                tenant_id: subscription.tenant_id,
                event_type: input.event_type,
                idempotency_key: input.idempotency_key,
                quantity: null,
                input_tokens: input.input_tokens,
                cached_input_tokens: input.cached_input_tokens,
                output_tokens: input.output_tokens,
                reasoning_tokens: input.reasoning_tokens
            });
    
            if(!data){
                throw new Error("Error while saving new event usage");
            }
            return data;
        }

    }
    async getUsage(
        tenant_id: UUID
    ): Promise<CurrentUsage>{
        const tenant = await this.tenantsRepo.findById(this.db, tenant_id);
        if(!tenant){
            throw new NotFoundError(`Tenant by Id: ${tenant_id} was not found`)
        }

        const api_usage = await this.eventsRepo.getCurrentQuota(this.db, tenant_id);

        console.log(`Api Tokens Current Quota for tenant: ${tenant.id} with name: ${tenant.display_name}\n
            ${api_usage}`);

        const tokensCost = this.costService.calculateAICost({
            inputTokens: api_usage?.input_tokens as number,
            cachedInputTokens: api_usage?.cached_input_tokens as number,
            outputTokens: api_usage?.output_tokens as number,
            reasoningTokens: api_usage?.reasoning_tokens as number
        });
        console.log(`Token Cost for tenant: ${tenant.id} with name: ${tenant.display_name}\n 
            input tokens: ${tokensCost.inputCostCents}\n
            cached input tokens: ${tokensCost.cachedInputCostCents}\n
            output tokens: ${tokensCost.outputCostCents}\n
            reasoning tokens: ${tokensCost.reasoningCostCents}`);

        const apiCallsCents = this.costService.calculateApiCost(api_usage?.api_call_used as number);
        console.log(`Api call Cost for tenant: ${tenant.id} with name: ${tenant.display_name}\n Cost : ${apiCallsCents}`);   
        return {
            month: api_usage?.start_from as Date,
            apiCall:{
                used: api_usage?.api_call_used as number,
                limit: api_usage?.api_call_limit as number
            },
            aiTokens:{
                input_token: api_usage?.input_tokens as number,
                cached_input_tokens: api_usage?.cached_input_tokens as number,
                output_tokens: api_usage?.output_tokens as number,
                reasoning_tokens: api_usage?.reasoning_tokens as number,
                total_used: api_usage?.total_tokens as number,
                limit: api_usage?.token_limit as number
            },
            cost:{
                apiCallsCents: apiCallsCents, 
                aiTokensCents: tokensCost.totalCostCents,
                totalCents: tokensCost.totalCostCents + apiCallsCents
            }
        };
    }

    async checkQuota(
        tenant_id: UUID
    ): Promise<QuotaRow>{
        const tenant = await this.tenantsRepo.findById(this.db, tenant_id);
        if(!tenant){
            throw new NotFoundError(`Tenant by Id: ${tenant_id} was not found`)
        }

        const current_quota = await this.eventsRepo.getCurrentQuota(this.db, tenant_id);
        if(!current_quota){
            throw new NotFoundError(`quota plan for user ${tenant_id}enant_id} was not found`);
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

    private validateUsageInput(input: { event_type: string; idempotency_key: string;}): void {
        if (input.event_type !== 'api_call' && input.event_type !== 'api_token') {
            throw new ValidationError('Event type must be api_call or api_token');
        }
        if (!input.idempotency_key?.trim()) {
            throw new ValidationError('Idempotency key is required');
        }
    }
    
}