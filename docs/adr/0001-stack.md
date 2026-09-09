# ADR 0001: Technology Stack

## Status

Accepted

## Context

We need a self-hostable list app with a responsive MD3 web UI and a simple REST API, easy for open-source contributors. Native Node addons (e.g. better-sqlite3) are awkward on some Windows/CI setups.

## Decision

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite + TypeScript + MUI (Material Design 3) |
| Backend | Node.js + Fastify + TypeScript |
| Database | SQLite via Node.js built-in `node:sqlite` (`DatabaseSync`) |
| Monorepo | pnpm workspaces |
| Deploy | Docker multi-stage image + Compose |

## Consequences

- One language (TypeScript) across client and server.
- SQLite keeps default self-hosting dependency-free; no `node-gyp` required.
- Run with `--experimental-sqlite` until the module is unflagged in the Node LTS you target.
- MUI provides MD3 components without reinventing a design system.
- Native apps deferred; web-first.
