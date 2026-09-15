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
      .run("user-1", "alice", "hash", "2026-01-01T00:00:00.000Z");
    legacy.close();

    const db = createDb(dbPath);
    assert.equal(getSchemaVersion(db), SCHEMA_VERSION);
    const row = db
      .prepare(
        `SELECT username, password_hash, email FROM users WHERE id = ?`,
      )
      .get("user-1") as {
      username: string;
      password_hash: string | null;
      email: string | null;
    };
    assert.equal(row.username, "alice");
    assert.equal(row.password_hash, "hash");
    assert.equal(row.email, null);
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
