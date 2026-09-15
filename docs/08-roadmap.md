# Roadmap

Specs first for each item—extend docs and OpenAPI before implementation.

## Shared / collaborative lists

**Delivered (this slice):** `list_members` with a single fixed `member` capability (read/write/rename, not delete); owner-managed Immich-style user picker; member leave; user directory for self-host.

**Still planned:**

- Distinct `editor` / `viewer` roles (role picker in the share dialog).
- Invite by email or link (not only ticking existing accounts).
- Optional realtime updates (SSE/WebSocket).

## Third-party authentication (Authentik / OIDC)

**Shipped** (env-based OIDC) — see [ADR 0005](adr/0005-oidc.md), [requirements](01-requirements.md) (`REQ-OIDC-*`), and [guides/oauth-authentik.md](guides/oauth-authentik.md).

Included:

- Env-based OIDC (Authorization Code + PKCE)
- Map OIDC `sub` + issuer; username merge; optional email
- Local password accounts remain optional; `OIDC_DISABLE_PASSWORD_LOGIN`
- Authentik self-hosting guide

Follow-ups:

- IdP end-session / backchannel logout
- Authelia / Keycloak example pages (same env knobs as Authentik)
- Mobile custom-scheme redirect URIs when native clients exist

## PWA

- Application icon and a minimal web manifest already exist ([UI/UX](05-ui-ux.md)). Remaining work is installability and an offline read cache.
- Conflict strategy before offline writes.

## Native clients

- **Android companion (in progress / shipped as debug client):** `apps/android/` — Kotlin, Jetpack Compose, cookie-session auth, Room offline **read** cache. See [ADR 0006](adr/0006-android-companion.md) and [`apps/android/README.md`](../apps/android/README.md).
- Reuse the same OpenAPI contract (hand-mirrored DTOs today; generated clients optional later).
- Follow-ups: sharing UI, in-app OIDC (custom-scheme redirects), offline writes, Play Store pipeline.
- Consider Flutter or React Native only if a second platform is needed after the Android companion stabilizes.

## Other ideas

- Item quantity / unit fields
- List templates (“Weekly groceries”)
- Export/import JSON
- Postgres option for larger multi-tenant hosts
