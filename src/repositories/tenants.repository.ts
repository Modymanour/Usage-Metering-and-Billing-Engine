import { UUID } from 'node:crypto';
import {Queryable, query, queryOne, queryRows} from '../db/pool';


export interface TenantRow{
    name:string,
    id: string,
    created_At: Date
}
const TENANTCOLUMNS = "id, name, created_at";

export class TenantsRepository{
    //Creation
    async create(
        db:Queryable,
        name:string
    ): Promise<TenantRow>{
        const row = await queryOne<TenantRow>(
            db,
            `INSERT INTO tenants (display_name) values ($1) RETURNING ${TENANTCOLUMNS}`,
            [name]
        )
        return row!;
    }
    //Update
    async update(
        db:Queryable,
        input:{
            id: UUID,
            name: string
        }
    ): Promise<TenantRow>{
        const row = await queryOne<TenantRow>(
           db,
            `UPDATE tenants SET display_name = $1 WHERE id = $2 RETURING ${TENANTCOLUMNS}`,
            [input.name, input.id],
        )
        return row!;
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
    ): Promise<TenantRow>{
        const row = await queryOne<TenantRow>(
            db,
            `SELECT ${TENANTCOLUMNS}
             FROM tenants,
             WHERE id = $1`,
            [id]
        )
        return row!;
    }
}