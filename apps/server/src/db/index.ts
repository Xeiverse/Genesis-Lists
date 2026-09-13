import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
};

export type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
};

export type ListRow = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type ItemRow = {
  id: string;
  list_id: string;
  text: string;
  checked: number;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Db = DatabaseSync;

export const SCHEMA_VERSION = 1;

export function createDb(databasePath: string): Db {
  const dir = path.dirname(databasePath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  pruneExpiredSessions(db);
  return db;
}

export function getSchemaVersion(db: Db): number {
  const row = db
    .prepare(`SELECT MAX(version) AS version FROM schema_migrations`)
    .get() as { version: number | bigint | null };
  if (row.version == null) return 0;
  return Number(row.version);
}

export function dbIsReady(db: Db): boolean {
  try {
    db.prepare(`SELECT 1 AS ok`).get();
    return true;
  } catch {
    return false;
  }
}

function migrate(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const current = getSchemaVersion(db);
  if (current < 1) {
    applyMigration1(db);
    db.prepare(
      `INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)`,
    ).run(new Date().toISOString());
  }
}

/** Initial schema. Safe on databases created before schema_migrations existed. */
function applyMigration1(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS list_items (
      id TEXT PRIMARY KEY NOT NULL,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_lists_owner ON lists(owner_id);
    CREATE INDEX IF NOT EXISTS idx_items_list ON list_items(list_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);
}

function pruneExpiredSessions(db: Db) {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(
    new Date().toISOString(),
  );
}
