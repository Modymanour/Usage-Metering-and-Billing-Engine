import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { Umzug } from 'umzug';
import type { UmzugStorage } from 'umzug';
import { pool } from './pool';

type MigrationContext = {
    client: PoolClient;
    checksums: Map<string, string>;
};

class PostgresStorage implements UmzugStorage<MigrationContext> {
    async logMigration({ name, context }: { name: string; context: MigrationContext }): Promise<void> {
        await context.client.query(
            'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
            [name, context.checksums.get(name)]
        );
        await context.client.query('COMMIT');
    }

    async unlogMigration({ name, context }: { name: string; context: MigrationContext }): Promise<void> {
        await context.client.query('DELETE FROM schema_migrations WHERE name = $1', [name]);
        await context.client.query('COMMIT');
    }

    async executed({ context }: { context: MigrationContext }): Promise<string[]> {
        const result = await context.client.query<{ name: string }>(
            'SELECT name FROM schema_migrations ORDER BY name'
        );
        return result.rows.map((row) => row.name);
    }
}

const directoryName = import.meta.dirname;
const migrationsDirectory = path.resolve(directoryName, '../migrations');

async function loadMigrations(): Promise<Array<{ name: string; sql: string; checksum: string }>> {
    const names = (await fs.readdir(migrationsDirectory))
        .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
        .sort();

    return Promise.all(names.map(async (name) => {
        const sql = await fs.readFile(path.join(migrationsDirectory, name), 'utf8');
        return {
            name,
            sql,
            checksum: crypto.createHash('sha256').update(sql).digest('hex')
        };
    }));
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name       VARCHAR(255) PRIMARY KEY,
            checksum   CHAR(64) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function withMigrationLock<T>(action: (context: MigrationContext) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('SELECT pg_advisory_lock(hashtext($1))', ['billing-engine-migrations']);
        const migrations = await loadMigrations();
        const context: MigrationContext = {
            client,
            checksums: new Map(migrations.map((migration) => [migration.name, migration.checksum]))
        };
        return await action(context);
    } finally {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['billing-engine-migrations']);
        client.release();
    }
}

async function createUmzug(context: MigrationContext): Promise<Umzug<MigrationContext>> {
    const migrations = await loadMigrations();
    return new Umzug<MigrationContext>({
        context,
        storage: new PostgresStorage(),
        logger: console,
        migrations: migrations.map(({ name, sql }) => ({
            name,
            up: async ({ context: migrationContext }) => {
                await migrationContext.client.query('BEGIN');
                try {
                    await migrationContext.client.query(sql);
                } catch (error) {
                    await migrationContext.client.query('ROLLBACK');
                    throw error;
                }
            }
        }))
    });
}

async function main(): Promise<void> {
    const command = process.argv[2] ?? 'up';

    await withMigrationLock(async (context) => {
        await ensureMigrationsTable(context.client);
        const umzug = await createUmzug(context);

        if (command === 'up') {
            await umzug.up();
            console.log('Database is up to date.');
            return;
        }

        if (command === 'status') {
            const [pending, executed] = await Promise.all([umzug.pending(), umzug.executed()]);
            const appliedRows = await context.client.query<{ name: string; checksum: string }>(
                'SELECT name, checksum FROM schema_migrations ORDER BY name'
            );
            const changed = appliedRows.rows.filter(
                (row) => context.checksums.get(row.name) !== row.checksum
            );

            for (const migration of executed) {
                console.log(`APPLIED  ${migration.name}`);
            }
            for (const migration of pending) {
                console.log(`PENDING  ${migration.name}`);
            }
            for (const row of changed) {
                console.log(`CHANGED  ${row.name}`);
            }

            if (pending.length === 0 && changed.length === 0 && executed.length === appliedRows.rows.length) {
                console.log('Database is up to date.');
            } else {
                process.exitCode = 1;
            }
            return;
        }

        throw new Error(`Unknown migration command: ${command}`);
    });
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());