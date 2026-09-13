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

  it("stamps a pre-migration database without rewriting users", () => {
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
    assert.equal(getSchemaVersion(db), 1);
    const row = db
      .prepare(`SELECT username FROM users WHERE id = ?`)
      .get("user-1") as { username: string };
    assert.equal(row.username, "alice");
    db.close();
  });
});
