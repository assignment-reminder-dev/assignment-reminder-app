const Database = require('better-sqlite3');
const path = require('node:path');

const db = new Database(path.join(__dirname, 'app.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code TEXT NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, code)
  );
    CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    due_at TEXT NOT NULL,
    priority TEXT NOT NULL
      CHECK(priority IN ('High', 'Medium', 'Low')),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Not Started'
      CHECK(status IN ('Not Started', 'In Progress', 'Completed')),
    reminder_minutes INTEGER NOT NULL DEFAULT 1440
      CHECK(reminder_minutes IN (0, 60, 1440, 2880)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS assignments_user_due
    ON assignments(user_id, due_at);
`
);

module.exports = db;