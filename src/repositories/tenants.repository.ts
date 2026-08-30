import type { UUID } from 'node:crypto';
import { Queryable, query, queryOne,queryRows } from '../db/pool';
import { PaginatedResult } from './types';


export interface TenantRow{
    id: UUID,
    display_name: string,
    email:string,
    created_at: Date
}
const TENANTCOLUMNS = "id, display_name AS name, created_at";

export class TenantsRepository{
    //Creation
    async create(
        db:Queryable,
        input:{
            name:string,
            email:string,
            password:string
        }
    ): Promise<TenantRow | undefined>{
        const row = await queryOne<TenantRow>(
            db,
            `INSERT INTO tenants (display_name,email,password) values ($1,$2,$3) RETURNING ${TENANTCOLUMNS}`,
            [
                input.name,
                input.email,
                input.password
            ]
        )
        return row;
    }
    //Update
    async update(
        db:Queryable,
        input:{
            id: UUID,
            name: string
        }
    ): Promise<TenantRow | undefined>{
        const row = await queryOne<TenantRow>(
           db,
            `UPDATE tenants SET display_name = $1 WHERE id = $2 RETURNING ${TENANTCOLUMNS}`,
            [input.name, input.id],
        )
        return row;
    }
    //Delete
    async remove_tenant(
        db:Queryable,
        id: UUID,
    ): Promise<void>{
        await query(
            db,
            `DELETE FROM tenants WHERE id = $1`,
            [id]
        );
        return;
    }
    //Get by Id
    async findById(
        db:Queryable,
        id: UUID
    ): Promise<TenantRow | undefined>{
        const row = await queryOne<TenantRow>(
            db,
            `SELECT ${TENANTCOLUMNS}
             FROM tenants
             WHERE id = $1`,
            [id]
        )
        return row!;
    }
    async getAll(
        db:Queryable,
        page: number,
        pageSize: number
    ): Promise<PaginatedResult<TenantRow>>{
        const offset = (page - 1) * pageSize;

        const totalRow = await queryOne<{ count: string }>(
            db,
            `
                SELECT COUNT(*) AS count
                FROM tenants
            `
        );

        const rows = await queryRows<TenantRow>(
            db,
            `
                SELECT *
                FROM tenants
                ORDER BY created_at DESC
                LIMIT $1
                OFFSET $2
            `,
            [pageSize, offset]
        );

        const total = Number(totalRow?.count ?? 0);

        return {
            data: rows,
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        };
    }
}