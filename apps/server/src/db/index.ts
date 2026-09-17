import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
  displayNameFromEmail,
  displayNameSchema,
  emailSchema,
} from "@genesis-lists/shared";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  created_at: string;
};

export type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
};

export type UserIdentityRow = {
  id: string;
  user_id: string;
  issuer: string;
  subject: string;
  created_at: string;
};

export type OidcLoginStateRow = {
  state: string;
  code_verifier: string;
  nonce: string | null;
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

export type ListMemberRow = {
  list_id: string;
  user_id: string;
  role: string;
  created_at: string;
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

export const SCHEMA_VERSION = 5;

export function createDb(databasePath: string): Db {
  const dir = path.dirname(databasePath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  pruneExpiredSessions(db);
  pruneExpiredOidcStates(db);
  return db;
}

export function getSchemaVersion(db: Db): number {
  const row = db
    .prepare(`SELECT MAX(version) AS version FROM schema_migrations`)
    .get() as { version: number | bigint | null };
  if (row.version == null) return 0;
  return Number(row.version);
}

/** `SQLITE_CONSTRAINT_UNIQUE`. Lets a racing insert report the same conflict a pre-check would. */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { errcode, message } = err as { errcode?: number; message?: string };
  return (
    errcode === SQLITE_CONSTRAINT_UNIQUE ||
    (typeof message === "string" && message.includes("UNIQUE constraint failed"))
  );
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

  if (getSchemaVersion(db) < 1) {
    applyMigration1(db);
    db.prepare(
      `INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)`,
    ).run(new Date().toISOString());
  }
  if (getSchemaVersion(db) < 2) {
    applyMigration2(db);
    db.prepare(
      `INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)`,
    ).run(new Date().toISOString());
  }
  if (getSchemaVersion(db) < 3) {
    applyMigration3(db);
    db.prepare(
      `INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)`,
    ).run(new Date().toISOString());
  }
  if (getSchemaVersion(db) < 4) {
    applyMigration4(db);
    db.prepare(
      `INSERT INTO schema_migrations (version, applied_at) VALUES (4, ?)`,
    ).run(new Date().toISOString());
  }
  if (getSchemaVersion(db) < 5) {
    applyMigration5(db);
    db.prepare(
      `INSERT INTO schema_migrations (version, applied_at) VALUES (5, ?)`,
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

/** Shared lists: list_members with fixed member role. */
function applyMigration2(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS list_members (
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (list_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_list_members_user ON list_members(user_id);
  `);
}

/** OIDC: nullable password, email, identities, login state. */
function applyMigration3(db: Db) {
  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("BEGIN;");
  try {
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        email TEXT,
        created_at TEXT NOT NULL
      );

      INSERT INTO users_new (id, username, password_hash, email, created_at)
      SELECT id, username, password_hash, NULL, created_at FROM users;

      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;

      CREATE TABLE IF NOT EXISTS user_identities (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        issuer TEXT NOT NULL,
        subject TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (issuer, subject)
      );

      CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);

      CREATE TABLE IF NOT EXISTS oidc_login_states (
        state TEXT PRIMARY KEY NOT NULL,
        code_verifier TEXT NOT NULL,
        nonce TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function firstValidEmail(...candidates: Array<string | null>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = emailSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return null;
}

/**
 * The username is the name people already knew the account by, so it is kept
 * where it can be. When the username is itself an address, using it would put
 * the address in the display name, so the local part is used instead.
 */
function migratedDisplayName(username: string, email: string): string {
  if (emailSchema.safeParse(username).success) return displayNameFromEmail(email);
  const parsed = displayNameSchema.safeParse(username);
  return parsed.success ? parsed.data : displayNameFromEmail(email);
}

/**
 * Email login identity (ADR 0006). Destructive: accounts that cannot be given an
 * email address are removed along with everything they own.
 */
function applyMigration4(db: Db) {
  const legacy = db
    .prepare(
      `SELECT id, username, email, password_hash, created_at FROM users ORDER BY created_at ASC, id ASC`,
    )
    .all() as Array<{
    id: string;
    username: string;
    email: string | null;
    password_hash: string | null;
    created_at: string;
  }>;

  const keep: Array<{
    id: string;
    email: string;
    name: string;
    password_hash: string | null;
    created_at: string;
  }> = [];
  const removed: string[] = [];
  const claimed = new Map<string, string>();

  for (const row of legacy) {
    // The username is preferred so password logins keep working; a stored OIDC
    // email rescues accounts that were auto-registered with a bare username.
    const email = firstValidEmail(row.username, row.email);

    if (!email) {
      removed.push(`${row.username} (no valid email address)`);
      continue;
    }
    const owner = claimed.get(email);
    if (owner) {
      removed.push(`${row.username} (${email} already taken by ${owner})`);
      continue;
    }

    claimed.set(email, row.username);
    keep.push({
      id: row.id,
      email,
      name: migratedDisplayName(row.username, email),
      password_hash: row.password_hash,
      created_at: row.created_at,
    });
  }

  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("BEGIN;");
  try {
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT,
        created_at TEXT NOT NULL
      );
    `);

    const insert = db.prepare(
      `INSERT INTO users_new (id, email, name, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const user of keep) {
      insert.run(user.id, user.email, user.name, user.password_hash, user.created_at);
    }

    db.exec(`
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);

    // Foreign keys are off during the rebuild, so cascades do not fire.
    db.exec(`
      DELETE FROM lists WHERE owner_id NOT IN (SELECT id FROM users);
      DELETE FROM list_items WHERE list_id NOT IN (SELECT id FROM lists);
      DELETE FROM list_members
        WHERE user_id NOT IN (SELECT id FROM users)
           OR list_id NOT IN (SELECT id FROM lists);
      DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users);
      DELETE FROM user_identities WHERE user_id NOT IN (SELECT id FROM users);
    `);

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }

  if (removed.length > 0) {
    console.warn(
      `Schema v4: removed ${removed.length} account(s) that could not be migrated to email login, with their lists and shares: ${removed.join(", ")}`,
    );
  }
}

/**
 * Android OIDC mobile ticket exchange (ADR 0005 / 0007).
 * Adds optional `client` on OIDC login state and a one-time ticket table.
 */
function applyMigration5(db: Db) {
  db.exec(`
    ALTER TABLE oidc_login_states ADD COLUMN client TEXT;
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS oidc_mobile_tickets (
      ticket TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function pruneExpiredSessions(db: Db) {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(
    new Date().toISOString(),
  );
}

function pruneExpiredOidcStates(db: Db) {
  try {
    db.prepare(`DELETE FROM oidc_login_states WHERE expires_at <= ?`).run(
      new Date().toISOString(),
    );
  } catch {
    // Table may not exist on partial migrate failure paths
  }
  try {
    db.prepare(`DELETE FROM oidc_mobile_tickets WHERE expires_at <= ?`).run(
      new Date().toISOString(),
    );
  } catch {
    // Table may not exist before migration 5
  }
}
