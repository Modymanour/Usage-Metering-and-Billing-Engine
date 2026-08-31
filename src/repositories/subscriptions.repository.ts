import type { UUID } from 'node:crypto';
import { Queryable, query, queryOne, queryRows } from '../db/pool.ts';
import { PaginatedResult } from './types.ts';

export interface SubscriptionRow{
    id: UUID,
    tenant_id: UUID,
    plan_id: UUID,
    sub_status: string,
    created_at: Date,
    start_from: Date,
    ends_at: Date,
    stripe_id: string | null
}

const SUBSCRIPTIONCOLUMNS = `
    id, tenant_id, plan_id, sub_status, created_at, start_from,
    ends_at, stripe_id`;

export class SubscriptionRepository{
    //Creation
    async create(
        db:Queryable,
        input:{
            tenant_id:UUID,
            plan_id:UUID,
            sub_status:string,
            start_from:Date,
            ends_at:Date,
            stripe_id: string | null
        }
    ):Promise<SubscriptionRow>{
        const row = await queryOne<SubscriptionRow>(
            db,
            `INSERT INTO subscriptions (tenant_id, plan_id,
             sub_status, start_from, ends_at, stripe_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING ${SUBSCRIPTIONCOLUMNS}`,
             [
                input.tenant_id,
                input.plan_id,
                input.sub_status,
                input.start_from,
                input.ends_at,
                input.stripe_id
             ]
        )
        return row!;
    }
    //Update
    async update(
        db:Queryable,
        input:{
            id:UUID,
            tenant_id:UUID | null,
            plan_id:UUID | null,
            sub_status:string | null,
            start_from:Date | null,
            ends_at:Date | null,
        }
    ):Promise<SubscriptionRow | undefined>{
        const row = await queryOne<SubscriptionRow>(
            db,
            `UPDATE subscriptions SET
             tenant_id      = COALESCE($1, tenant_id),
             plan_id        = COALESCE($2, plan_id),
             sub_status     = COALESCE($3, sub_status),
             start_from     = COALESCE($4, start_from),
             ends_at        = COALESCE($5, ends_at)
             WHERE id = $6 RETURNING ${SUBSCRIPTIONCOLUMNS}`,
             [
                input.tenant_id ?? null,
                input.plan_id ?? null,
                input.sub_status ?? null,
                input.start_from ?? null,
                input.ends_at ?? null,
                input.id
             ]
        )
        return row!;
    }
    async assignStripeId(
        db:Queryable,
        id: UUID,
        stripe_id: string
    ): Promise<SubscriptionRow>{
        const row = await queryOne<SubscriptionRow>(
            db,
            `UPDATE subscriptions SET stripe_id = $1
             WHERE id = $2 RETURNING ${SUBSCRIPTIONCOLUMNS}`,
             [
                stripe_id,
                id
             ]
        )
        return row!;
    }
    async remove_subscription(
        db:Queryable,
        id:UUID
    ): Promise<void>{
        await query(
            db,
            `DELETE FROM subscriptions WHERE id = $1`,
            [id]
        );
        return
    }
    //Get by Id
    async findById(
        db:Queryable,
        id:UUID
    ): Promise<SubscriptionRow | undefined>{
        const row = await queryOne<SubscriptionRow>(
            db,
            `SELECT ${SUBSCRIPTIONCOLUMNS}
             FROM subscriptions
             WHERE id = $1`,
             [id]
        )
        return row;
    }
    async findByTenantId(
        db:Queryable,
        tenant_Id:UUID
    ): Promise<SubscriptionRow | undefined>{
        const row = await queryOne<SubscriptionRow>(
            db,
            `SELECT s.*
             FROM subscriptions s
             WHERE s.tenant_id = $1
                AND NOW() >= s.start_from
                AND NOW() < s.ends_at
             ORDER BY s.start_from DESC
             LIMIT 1`,
            [tenant_Id]
        )
        return row!;
    }
    async findByStripeId(
        db: Queryable,
        stripe_id: string
    ): Promise<SubscriptionRow | undefined> {
        const row = await queryOne<SubscriptionRow>(
            db,
            `SELECT ${SUBSCRIPTIONCOLUMNS}
             FROM subscriptions
             WHERE stripe_id = $1
             LIMIT 1`,
            [stripe_id]
        );
        return row;
    }
    async getAll(
        db:Queryable,
        page: number,
        pageSize: number
    ): Promise<PaginatedResult<SubscriptionRow>>{
        const offset = (page - 1) * pageSize;

        const totalRow = await queryOne<{ count: string }>(
            db,
            `
                SELECT COUNT(*) AS count
                FROM subscriptions
            `
        );

        const rows = await queryRows<SubscriptionRow>(
            db,
            `
                SELECT *
                FROM subscriptions
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