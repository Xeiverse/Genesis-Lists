# ADR 0003: SQLite as Default Database

## Status

Accepted

## Context

Self-hosters should not need to run Postgres for a personal/family list app.

## Decision

- Default persistence: **SQLite** file on a Docker volume.
- Access via Node.js built-in `node:sqlite` (`DatabaseSync`) with **idempotent schema bootstrap** on startup (`CREATE TABLE IF NOT EXISTS`), not a separate migration runner.
- Postgres remains a future option for larger deployments (roadmap).

## Consequences

- Easy backup (copy file).
- Single-writer friendly for MVP scale.
- Operators needing HA/multi-writer must wait for Postgres (or external SQLite care).
