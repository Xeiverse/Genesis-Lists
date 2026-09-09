# MVP Acceptance Checklist

Verify in Phase 5 (and ongoing CI where automated). Trace IDs to [01-requirements.md](../01-requirements.md).

## Auth

- [ ] **REQ-AUTH-01** Register with valid username/password → account created, session cookie set, redirected to lists
- [ ] **REQ-AUTH-01** Duplicate username → `409 CONFLICT`
- [ ] **REQ-AUTH-02** Login success → session; wrong password → `401`
- [ ] **REQ-AUTH-03** Logout → subsequent `/api/auth/me` is `401`
- [ ] **REQ-AUTH-04** `/api/auth/me` returns `{ id, username }`

## Lists

- [ ] **REQ-LIST-01** Create multiple lists; `GET /api/lists` returns them
- [ ] **REQ-LIST-02** Rename list; name persists
- [ ] **REQ-LIST-03** Delete list; items gone; list absent from GET
- [ ] **REQ-LIST-04** User B cannot see User A’s lists

## Items

- [ ] **REQ-ITEM-01** Add items; appear in position order
- [ ] **REQ-ITEM-02** Edit item text
- [ ] **REQ-ITEM-03** Toggle checked
- [ ] **REQ-ITEM-04** Delete item
- [ ] **REQ-ITEM-05** User B accessing User A list/item → `404`

## UI & ops

- [ ] **REQ-UI-01** Login, create list, add/toggle/delete item usable at mobile width and desktop
- [ ] **REQ-OPS-01** `docker compose up` serves app; data survives container recreate (volume)

## Contract

- [ ] Server responses match `docs/openapi/openapi.yaml` for success and error shapes (automated contract tests)
