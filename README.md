# Genesis Lists

![Genesis Lists icon](apps/web/public/favicon.svg)

Open-source, self-hostable list app (shopping lists first). Built with Spec-Driven Development: specifications in [`docs/`](docs/) are the source of truth.

The application icon is Material Symbols Receipt Long on the primary green tile. See [UI/UX](docs/05-ui-ux.md).

**Version:** 0.2.0 — sharing and optional OIDC. PWA remains on the [roadmap](docs/08-roadmap.md). A tagged `v0.2.0` release publishes `ghcr.io/xeiverse/genesis-lists`.

## Features

- Multiple lists per user, with Keep-style preview cards and search
- Add / edit / toggle / delete checklist items
- Ticked items collect in a collapsible section with clear-all
- Share lists with other accounts (owner picker; members can edit, not delete)
- Optional OpenID Connect (Authentik and compatible IdPs)
- Multi-user accounts with isolated private data
- Registration closes after the first account unless you leave it open
- Change password from Settings (other sessions are signed out)
- Material Design 3 responsive web UI
- Docker self-hosting with SQLite

## Documentation

| Doc | Description |
|-----|-------------|
| [Vision](docs/00-vision.md) | Why Genesis Lists exists |
| [Requirements](docs/01-requirements.md) | User stories & acceptance criteria |
| [Architecture](docs/02-architecture.md) | System design |
| [Data model](docs/03-data-model.md) | Entities, ownership & membership |
| [API overview](docs/04-api.md) | Human API guide |
| [OpenAPI](docs/openapi/openapi.yaml) | Machine-readable API contract |
| [UI/UX](docs/05-ui-ux.md) | Material Design 3 screens & flows |
| [Self-hosting](docs/06-self-hosting.md) | Deploy, HTTPS, backup, upgrade |
| [Authentik OAuth](docs/guides/oauth-authentik.md) | OIDC setup with Authentik |
| [Changelog](CHANGELOG.md) | Release notes |
| [Security](docs/07-security.md) | Auth & threat notes |
| [Roadmap](docs/08-roadmap.md) | PWA, OIDC follow-ups, further sharing |
| [ADRs](docs/adr/) | Architecture decisions |
| [MVP acceptance](docs/acceptance/mvp-checklist.md) | MVP verification checklist |
| [Sharing acceptance](docs/acceptance/sharing-checklist.md) | Sharing verification checklist |
| [OIDC acceptance](docs/acceptance/oidc-checklist.md) | OIDC verification checklist |

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

For a server, follow [Self-hosting](docs/06-self-hosting.md): generate `SESSION_SECRET`, set `COOKIE_SECURE=true`, keep registration in bootstrap mode, and put HTTPS in front. After `v0.2.0` is published, pin `GENESIS_LISTS_VERSION` and `docker compose pull` instead of rebuilding from git.

## Monorepo layout

```
apps/web/           React + Vite + MUI
apps/server/        Fastify API + SQLite
packages/shared/    Shared Zod schemas / types
docs/               Specs (canonical OpenAPI)
```

## License

Copyright (c) 2026 Genesis Lists contributors.

Genesis Lists is free software licensed under the [GNU Affero General Public License v3.0 only](LICENSE) (`AGPL-3.0-only`). If you run a modified version as a network service, you must offer users the corresponding source.

The Material Symbols receipt glyph is separately licensed under the [Apache License 2.0](apps/web/public/licenses/material-symbols/LICENSE). See the accompanying [NOTICE](apps/web/public/licenses/material-symbols/NOTICE).
