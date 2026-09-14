# Roadmap (post-MVP)

Specs first for each item—extend docs and OpenAPI before implementation.

## Shared / collaborative lists

**Delivered (this slice):** `list_members` with a single fixed `member` capability (read/write/rename, not delete); owner-managed Immich-style user picker; member leave; user directory for self-host.

**Still planned:**

- Distinct `editor` / `viewer` roles (role picker in the share dialog).
- Invite by email or link (not only ticking existing accounts).
- Optional realtime updates (SSE/WebSocket).

## Third-party authentication (Authentik / OIDC)

- Auth provider interface: `local` | `oidc`.
- Map OIDC `sub` (+ issuer) to a local user row.
- Keep local accounts optional for simple installs.
- Document Authentik client setup in self-hosting docs.

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
