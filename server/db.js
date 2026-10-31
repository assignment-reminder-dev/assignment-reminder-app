const { Pool } = require('pg');
const fs = require('node:fs/promises');
const path = require('node:path');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Set it in server/.env or your hosting environment.');
}
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
});
pool.on('error', error => console.error('Database connection error:', error.code || error.name));

function queries(client) {
    return {
        async one(sql, values = []) { return (await client.query(sql, values)).rows[0]; },
        async many(sql, values = []) { return (await client.query(sql, values)).rows; },
        async execute(sql, values = []) {
            const result = await client.query(sql, values);
            return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
        },
    };
}
module.exports = {
    ...queries(pool),
    pool,
    async initialize() {
        const sql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(sql);
    },
    async transaction(work) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await work(queries(client));
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally { client.release(); }
    },
};
