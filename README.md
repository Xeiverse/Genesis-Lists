# Genesis Lists

![Genesis Lists icon](apps/web/public/favicon.svg)

Open-source, self-hostable list app (shopping lists first). Built with Spec-Driven Development: specifications in [`docs/`](docs/) are the source of truth.

The application icon is Material Symbols Receipt Long on the primary green tile. See [UI/UX](docs/05-ui-ux.md).

**MVP status:** accepted against the current specs ([acceptance checklist](docs/acceptance/mvp-checklist.md)). Sharing, OIDC, and PWA remain on the [roadmap](docs/08-roadmap.md).

## Features (MVP)

- Multiple lists per user, with Keep-style preview cards and search
- Add / edit / toggle / delete checklist items
- Ticked items collect in a collapsible section with clear-all
- Multi-user accounts with isolated data
- Change password from Settings
- Material Design 3 responsive web UI
- Docker self-hosting with SQLite

## Documentation

| Doc | Description |
|-----|-------------|
| [Vision](docs/00-vision.md) | Why Genesis Lists exists |
| [Requirements](docs/01-requirements.md) | MVP user stories & acceptance criteria |
| [Architecture](docs/02-architecture.md) | System design |
| [Data model](docs/03-data-model.md) | Entities & ownership |
| [API overview](docs/04-api.md) | Human API guide |
| [OpenAPI](docs/openapi/openapi.yaml) | Machine-readable API contract |
| [UI/UX](docs/05-ui-ux.md) | Material Design 3 screens & flows |
| [Self-hosting](docs/06-self-hosting.md) | Deploy, env, backup |
| [Security](docs/07-security.md) | Auth & threat notes |
| [Roadmap](docs/08-roadmap.md) | Sharing, OIDC, PWA (post-MVP) |
| [ADRs](docs/adr/) | Architecture decisions |
| [Acceptance checklist](docs/acceptance/mvp-checklist.md) | Verification checklist |

## Quick start (development)

Requirements: Node.js 20+ (22+ recommended for `node:sqlite`), [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm --filter @genesis-lists/shared build
pnpm dev
```

- Web (Vite): http://localhost:5173 (proxies `/api` → API)
- API: http://localhost:3000

```bash
pnpm test          # API contract tests
pnpm typecheck
pnpm build
```

## Quick start (self-host)

```bash
# COOKIE_SECURE=true requires 32+ random characters (not a placeholder)
set SESSION_SECRET=   # Windows: paste a long random value
# export SESSION_SECRET=   # Unix

docker compose up -d --build
```

Open http://localhost:3000. Compose defaults `COOKIE_SECURE=false` for local HTTP and may use a placeholder `SESSION_SECRET` (warning in logs). For production, put a reverse proxy with HTTPS in front and set `COOKIE_SECURE=true` plus a `SESSION_SECRET` of at least 32 random characters.

See [Self-hosting](docs/06-self-hosting.md) for env vars, volumes, and backup.

## Monorepo layout

```
apps/web/           React + Vite + MUI
apps/server/        Fastify API + SQLite
packages/shared/    Shared Zod schemas / types
docs/               Specs (canonical OpenAPI)
```

## License

[MIT](LICENSE)
