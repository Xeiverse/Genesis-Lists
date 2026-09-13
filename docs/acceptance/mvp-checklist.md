# MVP Acceptance Checklist

1.0 release contract verified against the current specs. Automated items run in CI (`pnpm test`). REQ-ITEM-06 was checked in the browser at 360px on 13 September 2026. Docker volume persistence was verified on 12 September 2026.

## Auth

- [x] **REQ-AUTH-01** Register with valid username/password → account created, session cookie set, redirected to lists — *API test + browser (360px / 1280px)*
- [x] **REQ-AUTH-01** Duplicate username → `409 CONFLICT` — *API test*
- [x] **REQ-AUTH-02** Login success → session; wrong password → `401` — *API test + browser*
- [x] **REQ-AUTH-03** Logout → subsequent `/api/auth/me` is `401` — *API test + browser*
- [x] **REQ-AUTH-04** `/api/auth/me` returns `{ id, username }` — *API test*
- [x] **REQ-AUTH-05** Change password with correct current → `204`; wrong current → `401`; login with new password works; other sessions for that user are deleted and the current session stays signed in — *API test (other-session revoke) + browser (Settings)*
- [x] **REQ-AUTH-06** `ALLOW_REGISTRATION` unset/`bootstrap` allows the first account then `403 FORBIDDEN`; `false` rejects even with zero users; `GET /api/auth/registration` returns `{ open }` — *API test*

## Lists

- [x] **REQ-LIST-01** Create multiple lists; `GET /api/lists` returns them — *API test + browser*
- [x] **REQ-LIST-02** Rename list; name persists — *API test + browser (inline title)*
- [x] **REQ-LIST-03** Delete list; items gone; list absent from GET — *API test (cascade) + browser*
- [x] **REQ-LIST-04** User B cannot see User A’s lists — *API test*

## Items

- [x] **REQ-ITEM-01** Add items; appear in position order — *API test + browser*
- [x] **REQ-ITEM-02** Edit item text — *API test + browser (inline)*
- [x] **REQ-ITEM-03** Toggle checked — *API test + browser*
- [x] **REQ-ITEM-04** Delete item — *API test + browser*
- [x] **REQ-ITEM-05** User B accessing User A list/item → `404` — *API test (GET / PATCH / DELETE)*
- [x] **REQ-ITEM-06** Ticked items collect in a collapsed-by-default section (untick restores by position); `DELETE /api/lists/{id}/items/checked` clears only ticked items after confirm; zero ticked still `204`; missing/foreign list → `404` — *API test + browser (360px)*

## UI & ops

- [x] **REQ-UI-01** Login, create list, add/toggle/delete item usable at mobile width and desktop — *browser at 360px and 1280px (register validation, search, settings, guest redirects)*
- [x] **REQ-OPS-01** `docker compose up` serves app; data survives container recreate (volume) — *Compose build/up; `/api/health`; register + list + item persisted after `--force-recreate`*
- [x] **REQ-OPS-02** `GET /api/health` returns version and `schemaVersion` after `SELECT 1` — *API test*

## Contract

- [x] Server responses match `docs/openapi/openapi.yaml` for success and error shapes (automated contract tests) — *`apps/server/src/app.test.ts` (401/400/403/409/404, signed cookie, oversize body, cascade delete, health version)*
