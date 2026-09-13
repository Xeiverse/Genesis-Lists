# Genesis Lists

![Genesis Lists icon](apps/web/public/favicon.svg)

Open-source, self-hostable list app (shopping lists first). Built with Spec-Driven Development: specifications in [`docs/`](docs/) are the source of truth.

The application icon is Material Symbols Receipt Long on the primary green tile. See [UI/UX](docs/05-ui-ux.md).

**Version:** 1.0.0. Sharing, OIDC, and PWA remain on the [roadmap](docs/08-roadmap.md). A tagged `v1.0.0` release publishes `ghcr.io/xeiverse/genesis-lists` (see [Self-hosting](docs/06-self-hosting.md)).

## Features (MVP)

- Multiple lists per user, with Keep-style preview cards and search
- Add / edit / toggle / delete checklist items
- Ticked items collect in a collapsible section with clear-all
- Multi-user accounts with isolated data
- Registration closes after the first account unless you leave it open
- Change password from Settings (other sessions are signed out)
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
| [Self-hosting](docs/06-self-hosting.md) | Deploy, HTTPS, backup, upgrade |
| [Changelog](CHANGELOG.md) | Release notes |
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

Local HTTP (from this repository):

```bash
docker compose up -d --build
```

Open http://localhost:3000. That path leaves registration open and cookies usable on HTTP. It is not a public deploy.

For a server, follow [Self-hosting](docs/06-self-hosting.md): generate `SESSION_SECRET`, set `COOKIE_SECURE=true`, keep registration in bootstrap mode, and put HTTPS in front. After `v1.0.0` is published, pin `GENESIS_LISTS_VERSION` and `docker compose pull` instead of rebuilding from git.

## Monorepo layout

```
apps/web/           React + Vite + MUI
apps/server/        Fastify API + SQLite
packages/shared/    Shared Zod schemas / types
docs/               Specs (canonical OpenAPI)
```

## License

[MIT](LICENSE)
