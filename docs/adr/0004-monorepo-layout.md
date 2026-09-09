# ADR 0004: Monorepo Layout

## Status

Accepted

## Context

API contract, shared types, web, and server should evolve together under SDD.

## Decision

```
genesis-lists/
  apps/web/           # Vite React MUI
  apps/server/        # Fastify API
  packages/shared/    # Shared Zod schemas / types aligned to OpenAPI
  docs/               # Specs (canonical OpenAPI under docs/openapi/)
```

- `docs/openapi/openapi.yaml` is the canonical API contract.
- `packages/shared` may duplicate validation schemas by hand or generate from OpenAPI; both must stay in sync with the spec.

## Consequences

- Single clone for contributors.
- Clear boundary between product specs (`docs/`) and runtime code (`apps/`).
