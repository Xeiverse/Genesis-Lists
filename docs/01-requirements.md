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

### Client & ops

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-UI-01 | As a user, I can use the app on phone and desktop | Responsive MD3 UI; core flows usable at ~360px and ≥1024px widths |
| REQ-OPS-01 | As a self-hoster, I can run the stack with Docker Compose | Documented compose up serves UI + API; data persists in a volume |

## Out of scope (MVP)

- Shared lists, invites, roles
- OIDC / Authentik / SSO
- Email verification, password reset
- Item quantities, categories, stores
- Drag-and-drop reorder UI (API may support `position`; UI reorder is optional polish)
- Real-time collaboration
- Offline PWA caching
- Native apps

## Password & username rules (MVP)

- Username: 3–32 chars; `[a-zA-Z0-9_-]`
- Password: minimum 8 characters (no complexity score in MVP)
