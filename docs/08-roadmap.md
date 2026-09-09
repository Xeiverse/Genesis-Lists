# Roadmap (post-MVP)

Specs first for each item—extend docs and OpenAPI before implementation.

## Shared / collaborative lists

- Add `list_members(list_id, user_id, role)` with roles e.g. `editor`, `viewer`.
- Invite by username (later: email/link).
- Authorization: owner or member may read/write per role.
- Optional: realtime updates (SSE/WebSocket).

## Third-party authentication (Authentik / OIDC)

- Auth provider interface: `local` | `oidc`.
- Map OIDC `sub` (+ issuer) to a local user row.
- Keep local accounts optional for simple installs.
- Document Authentik client setup in self-hosting docs.

## PWA

- Installability + offline read cache after CRUD UX is solid.
- Conflict strategy before offline writes.

## Native clients

- Reuse the same OpenAPI contract (generated clients).
- Consider Flutter or React Native only after API stability.

## Other ideas

- Item quantity / unit fields
- List templates (“Weekly groceries”)
- Export/import JSON
- Postgres option for larger multi-tenant hosts
