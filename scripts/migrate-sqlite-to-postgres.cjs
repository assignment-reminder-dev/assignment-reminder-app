// One-time transfer of the local SQLite data to an empty PostgreSQL database.
// Run from the project root: node scripts/migrate-sqlite-to-postgres.cjs
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
require(path.join(root, 'server/node_modules/dotenv')).config({ path: path.join(root, 'server/.env'), quiet: true })
const db = require(path.join(root, 'server/db'))
const sqlitePath = path.resolve(process.env.DATABASE_PATH || path.join(root, 'server/app.db'))

const tables = {
  users: ['id', 'name', 'email', 'password_hash', 'created_at'],
  courses: ['id', 'user_id', 'code', 'name', 'created_at'],
  assignments: ['id', 'user_id', 'course_id', 'title', 'due_at', 'priority', 'notes', 'status', 'reminder_minutes', 'created_at'],
  notifications: ['id', 'user_id', 'assignment_id', 'due_at', 'reminder_minutes', 'reminder_at', 'created_at', 'read_at'],
}

async function main() {
  if (!fs.existsSync(sqlitePath)) throw new Error('Local SQLite database not found: server/app.db')
  const python = `import sqlite3, json, sys
db = sqlite3.connect('file:' + sys.argv[1] + '?mode=ro', uri=True)
db.row_factory = sqlite3.Row
db.execute('BEGIN')
tables = ('users', 'courses', 'assignments', 'notifications')
data = {table: [dict(row) for row in db.execute('SELECT * FROM ' + table + ' ORDER BY id')] for table in tables}
print(json.dumps(data))`
  // The export stays in memory and is never written to a file or logged.
  const source = JSON.parse(execFileSync('python3', ['-c', python, sqlitePath], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }))

  await db.initialize()
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    // Refuse to merge with an existing database: duplicates could silently alter ownership.
    for (const table of Object.keys(tables)) {
      const { rows } = await client.query(`SELECT EXISTS (SELECT 1 FROM ${table}) AS has_rows`)
      if (rows[0].has_rows) throw new Error('Neon already has data. Transfer stopped without changing it.')
    }
    for (const [table, columns] of Object.entries(tables)) {
      for (const record of source[table]) {
        const values = columns.map(column => {
          let value = record[column]
          if (table === 'users' && column === 'email') value = value.toLowerCase()
          if (table === 'courses' && column === 'code') value = value.toUpperCase()
          // SQLite timestamps are UTC without an offset; PostgreSQL stores UTC instants.
          if (column === 'created_at') value += 'Z'
          return value
        })
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
        await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values)
      }
      const max = Math.max(1, ...source[table].map(row => row.id))
      await client.query('SELECT setval(pg_get_serial_sequence($1, $2), $3, $4)',
        [table, 'id', max, source[table].length > 0])
    }
    await client.query('COMMIT')
    console.log('Transferred to Neon:', Object.entries(source).map(([name, rows]) => `${rows.length} ${name}`).join(', '))
    console.log('Your original SQLite database is unchanged.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

main().catch(error => {
  console.error('Transfer failed:', error.message)
  process.exitCode = 1
}).finally(() => db.pool.end())
