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

export function createDb(databasePath: string): Db {
  const dir = path.dirname(databasePath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
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

  return db;
}
