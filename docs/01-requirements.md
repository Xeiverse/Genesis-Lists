# Requirements (MVP)

Requirement IDs (`REQ-*`) map to [acceptance/mvp-checklist.md](acceptance/mvp-checklist.md).

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
| REQ-LIST-02 | As a user, I can rename a list I own | New name persists; other users’ lists are unaffected |
| REQ-LIST-03 | As a user, I can delete a list I own | List and its items are removed; I no longer see it |
| REQ-LIST-04 | As a user, I only see my own lists | Another user’s lists never appear in my `GET /api/lists` |

### Items

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-ITEM-01 | As a user, I can add items to a list I own | Item text is stored and returned in list order |
| REQ-ITEM-02 | As a user, I can edit an item’s text | Updated text persists |
| REQ-ITEM-03 | As a user, I can toggle an item checked/unchecked | `checked` flips and persists (shopping “got it” behavior) |
| REQ-ITEM-04 | As a user, I can delete an item | Item is removed from the list |
| REQ-ITEM-05 | As a user, I cannot mutate another user’s items | Access to foreign list/item returns 404 (no existence leak) |
| REQ-ITEM-06 | As a user, ticked items collect in a collapsible section, and I can clear them | Ticking an item moves it into a bottom ticked section that can be collapsed; unticking restores it among open items by `position` (positions are not rewritten). A confirmed clear deletes only ticked items on a list I own. Clearing another user’s list, or a missing list, returns 404 (no existence leak). Clear is idempotent when nothing is ticked (`204`) |

### Client & ops

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-UI-01 | As a user, I can use the app on phone and desktop | Responsive MD3 UI; core flows usable at ~360px and ≥1024px widths |
| REQ-OPS-01 | As a self-hoster, I can run the stack with Docker Compose | Documented compose up serves UI + API; data persists in a volume |
| REQ-OPS-02 | As a self-hoster, I can tell which version is running and whether the database is reachable | `GET /api/health` returns `{ status: "ok", version, schemaVersion }` after a successful `SELECT 1`. If the database cannot be queried, the response is `503` with `{ status: "error", version }` |

## Out of scope (MVP)

- Shared lists, invites, roles
- OIDC / Authentik / SSO
- Email verification, password reset (email-based)
- Authenticated password change is in scope (REQ-AUTH-05)
- Item quantities, categories, stores
- Drag-and-drop reorder UI (API may support `position`; UI reorder is optional polish)
- Real-time collaboration
- Offline PWA caching
- Native apps

## Password & username rules (MVP)

- Username: 3–32 chars; `[a-zA-Z0-9_-]`
- Password: minimum 8 characters (no complexity score in MVP)
