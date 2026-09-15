# Roadmap

Specs first for each item—extend docs and OpenAPI before implementation.

## Shared / collaborative lists

- Add `list_members(list_id, user_id, role)` with roles e.g. `editor`, `viewer`.
- Invite by username (later: email/link).
- Authorization: owner or member may read/write per role.
- Optional: realtime updates (SSE/WebSocket).

## Third-party authentication (Authentik / OIDC)

**In progress** — see [ADR 0005](adr/0005-oidc.md), [requirements](01-requirements.md) (`REQ-OIDC-*`), and [guides/oauth-authentik.md](guides/oauth-authentik.md).

Done in this workstream:

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

- Reuse the same OpenAPI contract (generated clients).
- Consider Flutter or React Native only after API stability.

## Other ideas

- Item quantity / unit fields
- List templates (“Weekly groceries”)
- Export/import JSON
- Postgres option for larger multi-tenant hosts
