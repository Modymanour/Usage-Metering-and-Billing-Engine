import type { UUID } from 'node:crypto';
import { pool, type Queryable } from '../db/pool';
import { TenantsRepository, type TenantRow } from '../repositories/tenants.repository';

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class TenantsService {
    constructor(
        private readonly tenantsRepository = new TenantsRepository(),
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
            throw new Error('Tenant was not created');
        }

        return tenant;
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