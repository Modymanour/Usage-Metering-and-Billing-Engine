import type { UUID } from 'node:crypto';
import { pool, type Queryable } from '../db/pool.ts';
import { TenantsRepository, type TenantRow } from '../repositories/tenants.repository.ts';
import { NotFoundError, ValidationError } from "../errors/error.ts";
import { PaginatedResult } from '../repositories/types.ts';
import { StripeWebhookService } from './stripe-webhook.service.ts';
import { email } from 'zod';

export class TenantsService {
    constructor(
        private readonly tenantsRepository = new TenantsRepository(),
        private readonly stripeService = new StripeWebhookService(),
        private readonly db: Queryable = pool
    ) {}

    async create(
        input:{ 
          name: string,
          email: string,
          password: string
        }
    ): Promise<TenantRow> {
        const name = this.validateName(input.name);
        const tenant = await this.tenantsRepository.create(this.db, { ...input, name });

        if (!tenant) {
            throw new ValidationError(`Tenant was not able to be created with email ${email}`);
        }
        
        const customer = await this.stripeService.createCustomer(tenant?.id as UUID, name, input.email);
        if(!customer){
            throw new ValidationError(`Stripe Customer couldn't be created for tenant: ${tenant.id} with email: ${input.email}`);
        }
        const tenant_with_stripe = await this.tenantsRepository.asignStripeId(this.db, tenant.id, customer.id)
        if(!tenant_with_stripe){
            throw new ValidationError(`Couldn't link stripe with tenant for tenant: ${tenant.id} with email: ${input.email}`);
        }

        return tenant_with_stripe;
    }

    async update(
        input: 
        { 
          id: UUID,
          name: string
        }): Promise<TenantRow> {
        const name = this.validateName(input.name);
        const id = input.id;
        const tenant = await this.tenantsRepository.update(this.db, { id, name });

        if (!tenant) {
            throw new NotFoundError(`Tenant ${input.id} was not found`);
        }

        return tenant;
    }

    async findById(id: UUID): Promise<TenantRow> {
        const tenant = await this.tenantsRepository.findById(this.db, id);

        if (!tenant) {
            throw new NotFoundError(`Tenant ${id} was not found`);
        }

        return tenant;
    }

    async remove(id: UUID): Promise<void> {
        const tenant = await this.findById(id);
        await this.tenantsRepository.remove_tenant(this.db, tenant.id);
    }
    async getAll(
        page: number,
        pageNumber: number
    ): Promise<PaginatedResult<TenantRow>>{
        const tenants = await this.tenantsRepository.getAll(this.db, page, pageNumber);
        return tenants
    }

    private validateName(name: string): string {
        const normalizedName = name?.trim();

        if (!normalizedName) {
            throw new ValidationError('Tenant name is required');
        }

        if (normalizedName.length > 100) {
            throw new ValidationError('Tenant name must be 100 characters or fewer');
        }

        return normalizedName;
    }
}