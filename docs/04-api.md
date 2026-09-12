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

Common codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`.

## Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account + session |
| POST | `/api/auth/login` | No | Create session |
| POST | `/api/auth/logout` | Yes | Destroy session |
| GET | `/api/auth/me` | Yes | Current user |
| POST | `/api/auth/change-password` | Yes | Change password `{ "currentPassword", "newPassword" }` |

### Lists

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/lists` | Yes | Lists owned by current user (includes `previewItems` up to 8 and `itemCount`) |
| POST | `/api/lists` | Yes | Create list `{ "name": "..." }` |
| PATCH | `/api/lists/{id}` | Yes | Rename `{ "name": "..." }` |
| DELETE | `/api/lists/{id}` | Yes | Delete list + items |

### Items

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/lists/{id}/items` | Yes | Items for a list (ordered by `position`) |
| POST | `/api/lists/{id}/items` | Yes | Add item `{ "text": "..." }` |
| PATCH | `/api/items/{id}` | Yes | Update `{ "text"?, "checked"?, "position"? }` |
| DELETE | `/api/items/{id}` | Yes | Delete item |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Liveness `{ "status": "ok" }` |

## Conventions

- IDs are UUID strings.
- Timestamps are ISO-8601 UTC strings.
- `checked` is a boolean in JSON (mapped to 0/1 in SQLite).
- Request bodies are JSON; `Content-Type: application/json`.
