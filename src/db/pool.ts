import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../config/.env') });

const connectionString = process.env.POSTGRESQL_CONNECTION_STRING;

if (!connectionString) {
    throw new Error('POSTGRESQL_CONNECTION_STRING is not configured');
}

const pool = new Pool({
    connectionString,
    application_name: 'billing-engine',
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
});

pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error', error);
});

export default pool;
