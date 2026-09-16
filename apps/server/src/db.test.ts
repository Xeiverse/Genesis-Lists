import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createDb, dbIsReady, getSchemaVersion, SCHEMA_VERSION } from "./db/index.js";

function tempDbPath(name: string) {
  return path.join(os.tmpdir(), `genesis-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

function removeDb(dbPath: string) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = dbPath + suffix;
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // Windows may briefly keep handles
    }
  }
}

/** Schema version 3 shape, so a test can exercise migration 4 on its own. */
function createV3Database(dbPath: string) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
    INSERT INTO schema_migrations (version, applied_at) VALUES
      (1, '2026-01-01T00:00:00.000Z'),
      (2, '2026-01-01T00:00:00.000Z'),
      (3, '2026-01-01T00:00:00.000Z');

    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      email TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE lists (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE list_items (
      id TEXT PRIMARY KEY NOT NULL,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE list_members (
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (list_id, user_id)
    );

    CREATE TABLE user_identities (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      issuer TEXT NOT NULL,
      subject TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (issuer, subject)
    );

    CREATE TABLE oidc_login_states (
      state TEXT PRIMARY KEY NOT NULL,
      code_verifier TEXT NOT NULL,
      nonce TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function count(db: ReturnType<typeof createDb>, sql: string, ...params: string[]) {
  const row = db.prepare(sql).get(...params) as { n: number | bigint };
  return Number(row.n);
}

describe("schema migrations", () => {
  const paths: string[] = [];

  after(() => {
    for (const p of paths) removeDb(p);
  });

  it("stamps a new database at the current schema version", () => {
    const dbPath = tempDbPath("fresh");
    paths.push(dbPath);
    const db = createDb(dbPath);
    assert.equal(getSchemaVersion(db), SCHEMA_VERSION);
    assert.equal(dbIsReady(db), true);
    db.close();
    assert.equal(dbIsReady(db), false);
  });

  it("migrates a pre-migration database to the current schema without losing users", () => {
    const dbPath = tempDbPath("legacy");
    paths.push(dbPath);
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    legacy
      .prepare(
        `INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`,
      )
      .run("user-1", "alice@example.com", "hash", "2026-01-01T00:00:00.000Z");
    legacy.close();

    const db = createDb(dbPath);
    assert.equal(getSchemaVersion(db), SCHEMA_VERSION);
    const row = db
      .prepare(`SELECT email, name, password_hash FROM users WHERE id = ?`)
      .get("user-1") as {
      email: string;
      name: string;
      password_hash: string | null;
    };
    assert.equal(row.email, "alice@example.com");
    assert.equal(row.name, "alice");
    assert.equal(row.password_hash, "hash");
    const identities = db
      .prepare(`SELECT COUNT(*) AS n FROM user_identities`)
      .get() as { n: number | bigint };
    assert.equal(Number(identities.n), 0);
    const members = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'list_members'`,
      )
      .get() as { name: string } | undefined;
    assert.equal(members?.name, "list_members");
    const oidcStates = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'oidc_login_states'`,
      )
      .get() as { name: string } | undefined;
    assert.equal(oidcStates?.name, "oidc_login_states");
    db.close();
  });
});

describe("schema version 4 (email login identity)", () => {
  const paths: string[] = [];
  const future = "2099-01-01T00:00:00.000Z";

  after(() => {
    for (const p of paths) removeDb(p);
  });

  function seed() {
    const dbPath = tempDbPath("v4");
    paths.push(dbPath);
    const legacy = createV3Database(dbPath);

    const user = legacy.prepare(
      `INSERT INTO users (id, username, password_hash, email, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    // Username is already an address: kept, with its password.
    user.run("alice", "Alice@Example.com", "alice-hash", null, "2026-01-01T00:00:00.000Z");
    // No usable address anywhere: removed with everything it owns.
    user.run("bob", "bob", "bob-hash", null, "2026-01-02T00:00:00.000Z");
    // Bare username but an address stored by the IdP: kept via that address.
    user.run("carol", "carol", null, "Carol@Example.com", "2026-01-03T00:00:00.000Z");
    // Resolves to the same address as alice: the older account wins.
    user.run("alias", "alice@example.com", "alias-hash", null, "2026-01-04T00:00:00.000Z");

    const list = legacy.prepare(
      `INSERT INTO lists (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    );
    list.run("list-alice", "alice", "Groceries", future, future);
    list.run("list-bob", "bob", "Bob's list", future, future);

    const item = legacy.prepare(
      `INSERT INTO list_items (id, list_id, text, checked, position, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, ?, ?)`,
    );
    item.run("item-alice", "list-alice", "Milk", future, future);
    item.run("item-bob", "list-bob", "Nails", future, future);

    const member = legacy.prepare(
      `INSERT INTO list_members (list_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)`,
    );
    member.run("list-alice", "bob", future);
    member.run("list-bob", "alice", future);

    const session = legacy.prepare(
      `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    );
    session.run("session-alice", "alice", future, future);
    session.run("session-bob", "bob", future, future);

    legacy
      .prepare(
        `INSERT INTO user_identities (id, user_id, issuer, subject, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("identity-carol", "carol", "https://idp.example.com", "sub-carol", future);
    legacy
      .prepare(
        `INSERT INTO user_identities (id, user_id, issuer, subject, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("identity-bob", "bob", "https://idp.example.com", "sub-bob", future);

    legacy.close();
    return createDb(dbPath);
  }

  it("keeps accounts whose username is already an email", () => {
    const db = seed();
    const row = db
      .prepare(`SELECT email, name, password_hash FROM users WHERE id = 'alice'`)
      .get() as { email: string; name: string; password_hash: string | null };
    assert.equal(row.email, "alice@example.com");
    assert.equal(row.name, "alice");
    assert.equal(row.password_hash, "alice-hash");
    assert.equal(getSchemaVersion(db), SCHEMA_VERSION);
    db.close();
  });

  it("keeps an account with a bare username when the IdP stored an email", () => {
    const db = seed();
    const row = db
      .prepare(`SELECT email, name FROM users WHERE id = 'carol'`)
      .get() as { email: string; name: string } | undefined;
    assert.equal(row?.email, "carol@example.com");
    assert.equal(row?.name, "carol");
    assert.equal(
      count(db, `SELECT COUNT(*) AS n FROM user_identities WHERE user_id = 'carol'`),
      1,
    );
    db.close();
  });

  it("deletes accounts with no usable email and everything that hangs off them", () => {
    const db = seed();
    assert.equal(count(db, `SELECT COUNT(*) AS n FROM users WHERE id = 'bob'`), 0);
    assert.equal(count(db, `SELECT COUNT(*) AS n FROM lists WHERE id = 'list-bob'`), 0);
    assert.equal(
      count(db, `SELECT COUNT(*) AS n FROM list_items WHERE id = 'item-bob'`),
      0,
    );
    assert.equal(
      count(db, `SELECT COUNT(*) AS n FROM list_members WHERE user_id = 'bob'`),
      0,
    );
    assert.equal(
      count(db, `SELECT COUNT(*) AS n FROM list_members WHERE list_id = 'list-bob'`),
      0,
      "memberships of a deleted user's list must go too",
    );
    assert.equal(
      count(db, `SELECT COUNT(*) AS n FROM sessions WHERE id = 'session-bob'`),
      0,
    );
    assert.equal(
      count(db, `SELECT COUNT(*) AS n FROM user_identities WHERE id = 'identity-bob'`),
      0,
    );
    db.close();
  });

  it("leaves surviving accounts' lists, items and sessions intact", () => {
    const db = seed();
    assert.equal(count(db, `SELECT COUNT(*) AS n FROM lists WHERE id = 'list-alice'`), 1);
    assert.equal(
      count(db, `SELECT COUNT(*) AS n FROM list_items WHERE id = 'item-alice'`),
      1,
    );
    assert.equal(
      count(db, `SELECT COUNT(*) AS n FROM sessions WHERE id = 'session-alice'`),
      1,
      "a surviving account should not be signed out by the upgrade",
    );
    db.close();
  });

  it("keeps the oldest account when two resolve to the same email", () => {
    const db = seed();
    assert.equal(count(db, `SELECT COUNT(*) AS n FROM users WHERE id = 'alias'`), 0);
    assert.equal(
      count(
        db,
        `SELECT COUNT(*) AS n FROM users WHERE email = 'alice@example.com'`,
      ),
      1,
    );
    db.close();
  });

  it("drops the username column and makes email unique", () => {
    const db = seed();
    const columns = (
      db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>
    ).map((c) => c.name);
    assert.deepEqual(columns.sort(), [
      "created_at",
      "email",
      "id",
      "name",
      "password_hash",
    ]);

    assert.throws(
      () =>
        db
          .prepare(
            `INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)`,
          )
          .run("dup", "alice@example.com", "dup", future),
      /UNIQUE/,
    );
    db.close();
  });
});
