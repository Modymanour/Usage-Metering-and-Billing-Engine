import { UUID } from 'node:crypto';
import { Queryable, query, queryOne, queryRows } from '../db/pool.ts';
import { PaginatedResult } from './types.ts';

export interface UsageEventRow {
    id: UUID,
    tenant_id: UUID,
    created_at: Date,
    idempotency_key: string,
    event_type: string,
    quantity: number | null,
    input_tokens: number | null,
    cached_input_tokens: number | null,
    output_tokens: number | null,
    reasoning_tokens: number | null
}
export interface QuotaRow{
    tenant_id: UUID,
    subscription_id: UUID,
    plan_id: UUID,
    plan_name: string,
    api_call_limit: number,
    api_call_used: number,
    input_tokens: number,
    cached_input_tokens: number,
    output_tokens: number,
    reasoning_tokens: number
    total_tokens: number,
    token_limit: number,
    start_from: Date,
    end_at: Date,
}

interface UsageSummaryRow {
    apiCalls: {
        used: number;
        limit: number;
        remaining: number;
    };

    aiTokens: {
        used: number;
        limit: number;
        remaining: number;
    };
}

const USAGE_EVENT_COLUMNS = `
    id, tenant_id, created_at, idempotency_key, event_type, quantity, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens`;

export class UsageEventsRepository {
    async create(
        db: Queryable,
        input: {
            tenant_id: UUID,
            idempotency_key: string,
            event_type: string,
            quantity: number | null,
            input_tokens: number | null,
            cached_input_tokens: number | null,
            output_tokens: number | null,
            reasoning_tokens: number | null
        }
    ): Promise<UsageEventRow> {
        const row = await queryOne<UsageEventRow>(
            db,
            `INSERT INTO user_events (tenant_id, idempotency_key, event_type, quantity, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING ${USAGE_EVENT_COLUMNS}`,
            [
                input.tenant_id,
                input.idempotency_key,
                input.event_type,
                input.quantity,
                input.input_tokens,
                input.cached_input_tokens,
                input.output_tokens,
                input.reasoning_tokens
            ]
        );
        return row!;
    }

    async update(
        db: Queryable,
        input: {
            id: UUID,
            tenant_id: UUID | null,
            idempotency_key: string | null,
            event_type: string | null,
            quantity: number | null,
            input_tokens: number | null,
            cached_input_tokens: number | null,
            output_tokens: number | null,
            reasoning_tokens: number | null
        }
    ): Promise<UsageEventRow> {
        const row = await queryOne<UsageEventRow>(
            db,
            `UPDATE user_events SET
             tenant_id          = COALESCE($1, tenant_id),
             idempotency_key    = COALESCE($2, idempotency_key),
             event_type         = COALESCE($3, event_type),
             quantity           = COALESCE($4, quantity),
             input_tokens       = COALESCE($5, input_tokens),
             cached_input_tokens= COALESCE($6, cached_input_tokens),
             output_tokens      = COALESCE(%7, output_tokens),
             reasoning_tokens   = COALESCE(%8, reasoning_tokens)
             WHERE id = $9
             RETURNING ${USAGE_EVENT_COLUMNS}`,
            [
                input.tenant_id ?? null,
                input.idempotency_key ?? null,
                input.event_type ?? null,
                input.quantity ?? null,
                input.input_tokens ?? null,
                input.cached_input_tokens ?? null,
                input.output_tokens ?? null,
                input.reasoning_tokens ?? null,
                input.id
            ]
        );
        return row!;
    }

    async remove_usage_event(db: Queryable, id: UUID): Promise<void> {
        await query(db, 'DELETE FROM user_events WHERE id = $1', [id]);
    }

    async findById(db: Queryable, id: UUID): Promise<UsageEventRow> {
        const row = await queryOne<UsageEventRow>(
            db,
            `SELECT ${USAGE_EVENT_COLUMNS}
             FROM user_events
             WHERE id = $1`,
            [id]
        );
        return row!;
    }

    async findByIdempotencyKey(
        db: Queryable,
        tenant_id: UUID,
        idempotency_key: string
    ): Promise<UsageEventRow> {
        const row = await queryOne<UsageEventRow>(
            db,
            `SELECT ${USAGE_EVENT_COLUMNS}
             FROM user_events
             WHERE tenant_id = $1 AND idempotency_key = $2`,
            [tenant_id, idempotency_key]
        );
        return row!;
    }

    async getCurrentQuota(
        db: Queryable,
        tenant_id: UUID,
    ): Promise<QuotaRow | undefined>{
        const quota = await queryOne<QuotaRow>(
            db,
            `SELECT
                s.tenant_id,
                s.id AS subscription_id,
                p.id AS plan_id,
                p.plan_name,
                p.api_call_limit as api_call_limit,
                COALESCE(SUM(e.quantity), 0)::integer AS api_call_used,
                COALESCE(SUM(e.input_tokens),0)::integer as input_tokens,
                COALESCE(SUM(e.cached_input_tokens),0)::integer as cached_input_tokens,
                COALESCE(SUM(e.output_tokens),0)::integer as output_tokens,
                COALESCE(SUM(e.reasoning_tokens),0)::integer as reasoning_tokens,
                (COALESCE(SUM(e.input_tokens), 0) + COALESCE(SUM(e.cached_input_tokens), 0) + COALESCE(SUM(e.output_tokens), 0) + COALESCE(SUM(e.reasoning_tokens), 0))
                ::integer AS total_tokens,
                p.api_token_limit as token_limit,
                s.start_from AS start_from,
                s.ends_at AS end_at
            FROM subscriptions s
            JOIN plans p ON p.id = s.plan_id
            LEFT JOIN user_events e
                ON e.tenant_id = s.tenant_id
                AND e.created_at >= s.start_from
                AND e.created_at < s.ends_at
            WHERE s.tenant_id = $1
                AND s.sub_status = 'active'
                AND NOW() >= s.start_from
                AND NOW() < s.ends_at
            GROUP BY
                s.tenant_id,
                s.id,
                p.id,
                p.plan_name,
                p.api_call_limit,
                p.api_token_limit,
                s.start_from,
                s.ends_at
            ORDER BY s.start_from DESC
            LIMIT 1`,
            [tenant_id]
        );

        return quota;
    }
    async getUsageSummary(
        db: Queryable,
        tenant_id: UUID,
    ): Promise<UsageSummaryRow | undefined>{
        const api_usage = await this.getCurrentQuota(db, tenant_id)

        const api_call_usage = {
            used: api_usage?.api_call_used ?? 0,
            limit: api_usage?.api_call_limit ?? 0,
            remaining: Math.max(0, (api_usage?.api_call_limit ?? 0) - (api_usage?.api_call_used ?? 0))
        };
        const api_tokens_usage = {
            used: api_usage?.total_tokens ?? 0,
            limit: api_usage?.token_limit ?? 0,
            remaining: Math.max(0, (api_usage?.token_limit ?? 0) - (api_usage?.total_tokens ?? 0))
        }
        const usage = {
            apiCalls:api_call_usage,
            aiTokens:api_tokens_usage
        }

        return usage!;
    }
    async getAll(
            db:Queryable,
            page: number,
            pageSize: number
        ): Promise<PaginatedResult<UsageEventRow>>{
            const offset = (page - 1) * pageSize;
    
            const totalRow = await queryOne<{ count: string }>(
                db,
                `
                    SELECT COUNT(*) AS count
                    FROM user_events
                `
            );
    
            const rows = await queryRows<UsageEventRow>(
                db,
                `
                    SELECT *
                    FROM user_events
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