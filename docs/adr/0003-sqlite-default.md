# ADR 0003: SQLite as Default Database

## Status

Accepted

## Context

Self-hosters should not need to run Postgres for a personal/family list app.

## Decision

- Default persistence: **SQLite** file on a Docker volume.
- Access via Node.js built-in `node:sqlite` (`DatabaseSync`).
- Schema changes are versioned in the app, not a third-party migration tool. On startup the server applies ordered steps and records them in `schema_migrations`. Migration 1 is the original `CREATE TABLE IF NOT EXISTS` statements, so a database created before 1.0 is stamped at version 1 without rewriting rows. Later releases add a new step (including `ALTER`) instead of relying on startup bootstrap alone.
- Postgres remains a future option for larger deployments (roadmap).

## Consequences

- Easy backup (copy a consistent SQLite backup; see self-hosting docs — WAL means a live copy of `app.db` alone is not enough).
- Single-writer friendly for MVP scale.
- Operators needing HA/multi-writer must wait for Postgres (or external SQLite care).
- Existing databases upgrade on startup. Do not hand-edit the schema; add a migration step in the server instead.
