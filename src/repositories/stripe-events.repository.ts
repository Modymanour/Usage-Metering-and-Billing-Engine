import { UUID } from 'node:crypto';
import { Queryable, query, queryOne, queryRows } from '../db/pool.ts';
import { PaginatedResult } from './types.ts';

export interface StripeEventRow {
    id: UUID,
    processed_at: Date,
    event_type: string,
    stripe_id: string
}

const STRIPE_EVENT_COLUMNS = `
    id, processed_at, event_type, stripe_id`;

export class StripeEventsRepository {
    async create(
        db: Queryable,
        input: {
            event_type: string,
            stripe_id: string
        }
    ): Promise<StripeEventRow> {
        const row = await queryOne<StripeEventRow>(
            db,
            `INSERT INTO stripe_events (event_type, stripe_id)
             VALUES ($1, $2)
             RETURNING ${STRIPE_EVENT_COLUMNS}`,
            [input.event_type, input.stripe_id]
        );
        return row!;
    }

    async update(
        db: Queryable,
        input: {
            id: UUID,
            event_type: string | null,
            stripe_id: string | null
        }
    ): Promise<StripeEventRow> {
        const row = await queryOne<StripeEventRow>(
            db,
            `UPDATE stripe_events SET
             event_type = COALESCE($1, event_type),
             stripe_id   = COALESCE($2, stripe_id)
             WHERE id = $3
             RETURNING ${STRIPE_EVENT_COLUMNS}`,
            [input.event_type ?? null, input.stripe_id ?? null, input.id]
        );
        return row!;
    }

    async remove_stripe_event(db: Queryable, id: UUID): Promise<void> {
        await query(db, 'DELETE FROM stripe_events WHERE id = $1', [id]);
    }

    async findById(db: Queryable, id: UUID): Promise<StripeEventRow> {
        const row = await queryOne<StripeEventRow>(
            db,
            `SELECT ${STRIPE_EVENT_COLUMNS}
             FROM stripe_events
             WHERE id = $1`,
            [id]
        );
        return row!;
    }

    async findByStripeId(db: Queryable, stripe_id: string): Promise<StripeEventRow> {
        const row = await queryOne<StripeEventRow>(
            db,
            `SELECT ${STRIPE_EVENT_COLUMNS}
             FROM stripe_events
             WHERE stripe_id = $1`,
            [stripe_id]
        );
        return row!;
    }
    async getAll(
        db:Queryable,
        page: number,
        pageSize: number
    ): Promise<PaginatedResult<StripeEventRow>>{
        const offset = (page - 1) * pageSize;

        const totalRow = await queryOne<{ count: string }>(
            db,
            `
                SELECT COUNT(*) AS count
                FROM stripe_events
            `
        );

        const rows = await queryRows<StripeEventRow>(
            db,
            `
                SELECT *
                FROM stripe_events
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