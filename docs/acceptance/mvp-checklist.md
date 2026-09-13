# MVP Acceptance Checklist

MVP accepted **12 September 2026** against the current specs. Automated items run in CI (`pnpm test`); UI and Docker were verified on this date.

## Auth

- [x] **REQ-AUTH-01** Register with valid username/password → account created, session cookie set, redirected to lists — *API test + browser (360px / 1280px)*
- [x] **REQ-AUTH-01** Duplicate username → `409 CONFLICT` — *API test*
- [x] **REQ-AUTH-02** Login success → session; wrong password → `401` — *API test + browser*
- [x] **REQ-AUTH-03** Logout → subsequent `/api/auth/me` is `401` — *API test + browser*
- [x] **REQ-AUTH-04** `/api/auth/me` returns `{ id, username }` — *API test*
- [x] **REQ-AUTH-05** Change password with correct current → `204`; wrong current → `401`; login with new password works — *API test + browser (Settings)*

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
- [ ] **REQ-ITEM-06** `DELETE /api/lists/{id}/items/checked` removes only ticked items; unticked remain; zero ticked still `204`; User B → `404`
- [ ] **REQ-ITEM-06** Ticked items appear in a collapsed-by-default section; untick returns the item among open items by position; Clear confirms then removes ticked items only

## UI & ops

- [x] **REQ-UI-01** Login, create list, add/toggle/delete item usable at mobile width and desktop — *browser at 360px and 1280px (register validation, search, settings, guest redirects)*
- [x] **REQ-OPS-01** `docker compose up` serves app; data survives container recreate (volume) — *Compose build/up; `/api/health`; register + list + item persisted after `--force-recreate`*

## Contract

- [x] Server responses match `docs/openapi/openapi.yaml` for success and error shapes (automated contract tests) — *`apps/server/src/app.test.ts` (401/400/409/404, signed cookie, oversize body, cascade delete)*
