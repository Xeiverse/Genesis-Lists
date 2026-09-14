# Sharing Acceptance Checklist

Maps to `REQ-SHARE-*` in [01-requirements.md](../01-requirements.md). Automated items run in CI (`pnpm test`).

## Sharing

- [ ] **REQ-SHARE-01** Owner puts members via share dialog / `PUT /api/lists/{id}/members`; members see the list on `GET /api/lists` with `isOwner: false` and correct `ownerUsername` — *API test + browser*
- [ ] **REQ-SHARE-02** Member can list/add/edit/toggle/delete items, clear checked, and rename — *API test + browser*
- [ ] **REQ-SHARE-03** Member `DELETE /api/lists/{id}` → `403`; member `GET`/`PUT` members → `403` — *API test*
- [ ] **REQ-SHARE-04** Owner removes a user from the member set; that user no longer sees the list; direct access → `404` — *API test*
- [ ] **REQ-SHARE-05** Member `DELETE /api/lists/{id}/members/me` → `204` then list gone; owner leave → `400` — *API test + browser*
- [ ] **REQ-SHARE-06** `GET /api/users` returns all users’ id and username for a signed-in caller — *API test*

## Related list rules

- [ ] **REQ-LIST-03** Owner can still delete; member cannot (`403`) — *API test*
- [ ] **REQ-LIST-04** Carol (non-member) never sees Alice’s shared-with-Bob list — *API test*
- [ ] Health reports `schemaVersion: 2` — *API test*
