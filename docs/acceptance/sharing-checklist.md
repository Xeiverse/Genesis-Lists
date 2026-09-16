# Sharing Acceptance Checklist

Maps to `REQ-SHARE-*` in [01-requirements.md](../01-requirements.md). Automated items run in CI (`pnpm test`). Browser walkthrough was recorded on the sharing PR (agent demo, 14 September 2026).

## Sharing

- [x] **REQ-SHARE-01** Owner puts members via share dialog / `PUT /api/lists/{id}/members`; members see the list on `GET /api/lists` with `isOwner: false` and correct `ownerName` — *API test + browser*
- [x] **REQ-SHARE-02** Member can list/add/edit/toggle/delete items, clear checked, and rename — *API test + browser (toggle checked)*
- [x] **REQ-SHARE-03** Member `DELETE /api/lists/{id}` → `403`; member `GET`/`PUT` members → `403` — *API test*
- [x] **REQ-SHARE-04** Owner removes a user from the member set; that user no longer sees the list; direct access → `404` — *API test*
- [x] **REQ-SHARE-05** Member `DELETE /api/lists/{id}/members/me` → `204` then list gone; owner leave → `400` — *API test + browser (Leave list)*
- [x] **REQ-SHARE-06** `GET /api/users` returns all users’ id and display name for a signed-in caller, and no email addresses — *API test*

## Related list rules

- [x] **REQ-LIST-03** Owner can still delete; member cannot (`403`) — *API test*
- [x] **REQ-LIST-04** Carol (non-member) never sees Alice’s shared-with-Bob list — *API test*
- [x] Health reports the current `schemaVersion` — *API test*
