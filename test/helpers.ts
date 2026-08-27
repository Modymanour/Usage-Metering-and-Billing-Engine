import assert from 'node:assert/strict';
import type { QueryResult, QueryResultRow } from 'pg';
import type { Queryable } from '../src/db/pool';

export class FakeDb implements Queryable {
    calls: Array<{ text: string; values: readonly unknown[] }> = [];
    responses: QueryResult<QueryResultRow>[] = [];

    queue<T extends QueryResultRow>(...rows: T[]): void {
        this.responses.push({
            command: 'SELECT',
            rowCount: rows.length,
            oid: 0,
            fields: [],
            rows,
        });
    }

    async query<R extends QueryResultRow = QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
        this.calls.push({ text, values });
        const response = this.responses.shift();
        assert.ok(response, `No fake response queued for: ${text}`);
        return response as QueryResult<R>;
    }
}

export function lastCall(db: FakeDb): { text: string; values: readonly unknown[] } {
    const call = db.calls.at(-1);
    assert.ok(call);
    return call;
}
