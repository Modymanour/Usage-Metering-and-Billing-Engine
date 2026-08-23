import { UUID } from 'node:crypto';
import { Queryable, query, queryOne } from '../db/pool';

export interface UsageEventRow {
    id: UUID,
    tenant_id: UUID,
    created_at: Date,
    idempotency_key: string,
    event_type: string,
    quantity: number
}

const USAGE_EVENT_COLUMNS = `
    id, tenant_id, created_at, idempotency_key, event_type, quantity`;

export class UsageEventsRepository {
    async create(
        db: Queryable,
        input: {
            tenant_id: UUID,
            idempotency_key: string,
            event_type: string,
            quantity: number
        }
    ): Promise<UsageEventRow> {
        const row = await queryOne<UsageEventRow>(
            db,
            `INSERT INTO user_events (tenant_id, idempotency_key, event_type, quantity)
             VALUES ($1, $2, $3, $4)
             RETURNING ${USAGE_EVENT_COLUMNS}`,
            [input.tenant_id, input.idempotency_key, input.event_type, input.quantity]
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
            quantity: number | null
        }
    ): Promise<UsageEventRow> {
        const row = await queryOne<UsageEventRow>(
            db,
            `UPDATE user_events SET
             tenant_id       = COALESCE($1, tenant_id),
             idempotency_key = COALESCE($2, idempotency_key),
             event_type      = COALESCE($3, event_type),
             quantity        = COALESCE($4, quantity)
             WHERE id = $5
             RETURNING ${USAGE_EVENT_COLUMNS}`,
            [
                input.tenant_id ?? null,
                input.idempotency_key ?? null,
                input.event_type ?? null,
                input.quantity ?? null,
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
}