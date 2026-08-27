import { UUID } from 'node:crypto';
import {Queryable, query, queryOne, queryRows} from '../db/pool';

export interface PlanRow{
    id: UUID,
    name: string,
    created_at: Date,
    api_call_limit: number,
    api_token_limit: number
}

const PLANCOLUMNS = "id, plan_name AS name, created_at, api_call_limit, api_token_limit";

export class PlansRepository{
    //Creation
    async create(
        db:Queryable,
        input:{
            name:string,
            api_call_limit:number,
            api_token_limit:number
        }
    ): Promise<PlanRow>{
        const row = await queryOne<PlanRow>(
            db,
            `INSERT INTO plans (plan_name, api_call_limit, api_token_limit)
             Values ($1, $2, $3) RETURNING ${PLANCOLUMNS}`,
            [input.name, input.api_call_limit, input.api_token_limit]
        );
        return row!;
    }
    //Update
    async update(
        db:Queryable,
        input:{
            id:UUID
            name:string | null,
            api_call_limit:number | null,
            api_token_limit:number | null
        }
    ): Promise<PlanRow>{
        const row = await queryOne<PlanRow>(
            db,
            `UPDATE plans SET
             plan_name       = COALESCE($1, plan_name),
             api_call_limit  = COALESCE($2, api_call_limit),
             api_token_limit = COALESCE($3, api_token_limit)
             WHERE id = $4 RETURNING ${PLANCOLUMNS}`,
             [
                input.name ?? null,
                input.api_call_limit ?? null,
                input.api_token_limit ?? null,
                input.id
             ]
        );
        return row!;
        
    }
    //Delete
    async remove_plan(
        db:Queryable,
        id:UUID
    ): Promise<void>{
        await query(
            db,
            `DELETE FROM plans WHERE id = $1`,
            [id]
        );
        return;
    }
    //Get by Id
    async findById(
        db:Queryable,
        id:UUID
    ): Promise<PlanRow>{
        const row = await queryOne<PlanRow>(
            db,
            `SELECT ${PLANCOLUMNS} 
             FROM plans
             WHERE id = $1`,
            [id]
        );
        return row!;
    }
    //Get by name
    async findByName(
        db:Queryable,
        name:string
    ): Promise<PlanRow>{
        const row = await queryOne<PlanRow>(
            db,
            `SELECT ${PLANCOLUMNS}
            FROM plans
            WHERE LOWER(plan_name) = $1`,
            [name.toLocaleLowerCase()]
        );
        return row!;
    }
}