# Requirements

Requirement IDs (`REQ-*`) map to acceptance checklists under [acceptance/](acceptance/).

## In scope

### Authentication

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-AUTH-01 | As a new user, I can register with a username and password | Valid credentials create an account; duplicate username returns a clear error; I am logged in after successful register |
| REQ-AUTH-02 | As a registered user, I can log in | Correct credentials establish a session; wrong credentials fail without revealing which field is wrong beyond a generic auth error |
| REQ-AUTH-03 | As a logged-in user, I can log out | Session ends; protected routes require login again |
| REQ-AUTH-04 | As a logged-in user, I can see who I am | `GET /api/auth/me` returns my user id and username |
| REQ-AUTH-05 | As a logged-in user, I can change my password | Correct current password updates the hash; wrong current password fails; I can log in with the new password; other sessions for my account are deleted and the session that changed the password stays signed in |
| REQ-AUTH-06 | As an operator, I can stop strangers creating accounts | `ALLOW_REGISTRATION` is `true` (always open), `false` (always closed), or unset/`bootstrap` (open only until the first account exists). Closed registration returns `403 FORBIDDEN`. `GET /api/auth/registration` reports `{ open }` without auth so the UI can hide the register form |

### Lists

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-LIST-01 | As a user, I can create multiple named lists | Creating a list with a non-empty name succeeds; list appears in my list of lists |
| REQ-LIST-02 | As a user, I can rename a list I own or am a member of | New name persists; users without access are unaffected |
| REQ-LIST-03 | As an owner, I can delete a list I own | List and its items are removed; I no longer see it. Members cannot delete (`403 FORBIDDEN`) |
| REQ-LIST-04 | As a user, I only see lists I own or am a member of | Another user’s private lists never appear in my `GET /api/lists` |

### Items

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-ITEM-01 | As a user, I can add items to a list I can access | Item text is stored and returned in list order |
| REQ-ITEM-02 | As a user, I can edit an item’s text | Updated text persists |
| REQ-ITEM-03 | As a user, I can toggle an item checked/unchecked | `checked` flips and persists (shopping “got it” behavior) |
| REQ-ITEM-04 | As a user, I can delete an item | Item is removed from the list |
| REQ-ITEM-05 | As a user, I cannot mutate lists/items I cannot access | Access without ownership or membership returns 404 (no existence leak) |
| REQ-ITEM-06 | As a user, ticked items collect in a collapsible section, and I can clear them | Ticking an item moves it into a bottom ticked section that can be collapsed; unticking restores it among open items by `position` (positions are not rewritten). A confirmed clear deletes only ticked items on a list I can access. Clearing a list I cannot access, or a missing list, returns 404 (no existence leak). Clear is idempotent when nothing is ticked (`204`) |

### Sharing

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-SHARE-01 | As an owner, I can share a list with other users on the instance | Share dialog lists users; I can search and tick who should have access; Save replaces the member set. Members appear on `GET /api/lists` for those users with `isOwner: false` |
| REQ-SHARE-02 | As a member, I can read and write a shared list | I can view items, add/edit/toggle/delete items, clear ticked items, and rename the list |
| REQ-SHARE-03 | As a member, I cannot delete the list or manage members | `DELETE /api/lists/{id}` and member management return `403 FORBIDDEN` |
| REQ-SHARE-04 | As an owner, I can revoke access | Unticking a user and saving removes them; they no longer see the list (`404` on direct access) |
| REQ-SHARE-05 | As a member, I can leave a shared list | `DELETE /api/lists/{id}/members/me` removes my membership; the list disappears from my home. Owners cannot leave (`400`) |
| REQ-SHARE-06 | As a signed-in user, I can list other users for sharing | `GET /api/users` returns `{ id, username }` for all accounts (self-host directory) |

### Client & ops

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-UI-01 | As a user, I can use the app on phone and desktop | Responsive MD3 UI; core flows usable at ~360px and ≥1024px widths |
| REQ-OPS-01 | As a self-hoster, I can run the stack with Docker Compose | Documented compose up serves UI + API; data persists in a volume |
| REQ-OPS-02 | As a self-hoster, I can tell which version is running and whether the database is reachable | `GET /api/health` returns `{ status: "ok", version, schemaVersion }` after a successful `SELECT 1`. If the database cannot be queried, the response is `503` with `{ status: "error", version }` |

## Out of scope

- Viewer / editor role picker (single fixed `member` capability for now)
- Email/link invites
- OIDC / Authentik / SSO
- Email verification, password reset (email-based)
- Authenticated password change is in scope (REQ-AUTH-05)
- Item quantities, categories, stores
- Drag-and-drop reorder UI (API may support `position`; UI reorder is optional polish)
- Real-time collaboration
- Offline PWA caching
- Native apps

## Password & username rules

- Username: 3–32 chars; `[a-zA-Z0-9_-]`
- Password: minimum 8 characters (no complexity score)
