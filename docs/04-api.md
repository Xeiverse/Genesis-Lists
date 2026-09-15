# API Overview

The machine-readable contract is [`openapi/openapi.yaml`](openapi/openapi.yaml). Implementations **must** conform to that file. This document is a human summary.

## Base path

All endpoints are under `/api`.

## Authentication

- **Mechanism:** HTTP-only session cookie (`genesis_session` unless configured otherwise). The cookie is **signed** with `SESSION_SECRET`, `SameSite=Lax`, and `Secure` when `COOKIE_SECURE=true` (or production default). The cookie value is a random session id stored in SQLite.
- **Register / login** set the cookie on success.
- **Logout** clears the cookie and deletes the server-side session.
- Protected routes require a valid session; otherwise `401` with error code `UNAUTHORIZED`.

## Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary"
  }
}
```

Common codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`.

## Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account + session. `403 FORBIDDEN` when registration is closed |
| GET | `/api/auth/registration` | No | `{ "open": true \| false }` — whether new accounts can be created |
| POST | `/api/auth/login` | No | Create session |
| POST | `/api/auth/logout` | Yes | Destroy session |
| GET | `/api/auth/me` | Yes | Current user |
| POST | `/api/auth/change-password` | Yes | Change password `{ "currentPassword", "newPassword" }`. Deletes other sessions for this user; the current session stays signed in |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | Yes | Directory of all users `{ id, username }[]` for the share picker (self-host) |

### Lists

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/lists` | Yes | Lists owned by or shared with the current user (includes `previewItems` up to 8, `itemCount`, `isOwner`, `ownerUsername`) |
| POST | `/api/lists` | Yes | Create list `{ "name": "..." }` (`isOwner: true`) |
| PATCH | `/api/lists/{id}` | Yes | Rename `{ "name": "..." }` — owner or member |
| DELETE | `/api/lists/{id}` | Yes | Delete list + items — **owner only**; member → `403` |

### Members

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/lists/{id}/members` | Yes | Current members `{ userId, username }[]` — **owner only**; member → `403` |
| PUT | `/api/lists/{id}/members` | Yes | Replace member set `{ "userIds": ["..."] }` — **owner only**. Rejects owner id or unknown ids (`400`). Empty array clears all members |
| DELETE | `/api/lists/{id}/members/me` | Yes | Leave list — **member only**; owner → `400`; non-member / no access → `404` |

### Items

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/lists/{id}/items` | Yes | Items for a list (ordered by `position`) — owner or member |
| POST | `/api/lists/{id}/items` | Yes | Add item `{ "text": "..." }` — owner or member |
| PATCH | `/api/items/{id}` | Yes | Update `{ "text"?, "checked"?, "position"? }` — access via parent list |
| DELETE | `/api/items/{id}` | Yes | Delete item — access via parent list |
| DELETE | `/api/lists/{id}/items/checked` | Yes | Delete every ticked item on a list. `204` when accessible, including when nothing is ticked (idempotent). No body. `404` if the list is missing or not accessible |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | `{ "status": "ok", "version", "schemaVersion" }` after a successful database check. `503` `{ "status": "error", "version" }` if the database cannot be queried |

## Conventions

- IDs are UUID strings.
- Timestamps are ISO-8601 UTC strings.
- `checked` is a boolean in JSON (mapped to 0/1 in SQLite).
- Request bodies are JSON; `Content-Type: application/json`.
- No access → `404`. Access without capability → `403`.
