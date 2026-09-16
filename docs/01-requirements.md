# Requirements

Requirement IDs (`REQ-*`) map to acceptance checklists under [`acceptance/`](acceptance/).

## In scope

### Authentication (local)

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-AUTH-01 | As a new user, I can register with an email and password | Valid credentials create an account; a duplicate email returns a clear error; I am logged in after successful register. An optional display name defaults to the local part of the email. Emails are compared trimmed and lower-cased, so `Alice@Example.com` and `alice@example.com` are the same account. When password login is disabled (REQ-OIDC-05), register returns `403 FORBIDDEN`. |
| REQ-AUTH-02 | As a registered user, I can log in | Correct credentials establish a session; wrong credentials fail without revealing which field is wrong beyond a generic auth error. When password login is disabled (REQ-OIDC-05), login returns `403 FORBIDDEN`. |
| REQ-AUTH-03 | As a logged-in user, I can log out | Session ends; protected routes require login again. Logout clears the local session only (IdP single logout is out of scope for this release). |
| REQ-AUTH-04 | As a logged-in user, I can see who I am | `GET /api/auth/me` returns my user id, email, display name, and `authProviders` |
| REQ-AUTH-05 | As a logged-in user with a local password, I can change my password | Correct current password updates the hash; wrong current password fails; I can log in with the new password; other sessions for my account are deleted and the session that changed the password stays signed in. Users without a password hash cannot change password (`403 FORBIDDEN`). |
| REQ-AUTH-06 | As an operator, I can stop strangers creating accounts | `ALLOW_REGISTRATION` is `true` (always open), `false` (always closed), or unset/`bootstrap` (open only until the first account exists). Closed registration returns `403 FORBIDDEN`. `GET /api/auth/registration` reports `{ open }` without auth so the UI can hide the register form. Password registration is also refused when REQ-OIDC-05 applies. |
| REQ-AUTH-07 | As a logged-in user, I can change the display name others see | `PATCH /api/auth/me` with a 1–64 character name updates it and returns the updated user. Display names are not unique. My email is never changed by this endpoint. |

### Authentication (OIDC)

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-OIDC-01 | As an operator, I can enable OIDC with environment variables | When `OIDC_ENABLED=true` and required settings are present, discovery succeeds at startup. Missing required settings or failed discovery prevents the process from starting. When disabled, OIDC routes are unavailable (`404`). |
| REQ-OIDC-02 | As a user, I can sign in with my IdP | From the login page I start OIDC; after IdP consent the callback creates a local session cookie and I land on lists home. |
| REQ-OIDC-03 | As a returning OIDC user, I am recognized by issuer + subject | A prior `user_identities` row for `(issuer, sub)` signs me into that local user. |
| REQ-OIDC-04 | As an operator, matching emails merge | On first OIDC login, if no identity row exists but a local user has the same email as `OIDC_EMAIL_CLAIM` (default `email`), the identity is linked to that user. This links accounts created before the IdP was connected. If none exists and `OIDC_AUTO_REGISTER=true`, a user is created with `password_hash` null, the claimed email, and a display name from `OIDC_NAME_CLAIM` (default `name`, falling back to the email local part). If none exists and auto-register is false, login fails with a clear auth error. A missing or malformed email claim, or `email_verified: false`, fails with a clear auth error. |
| REQ-OIDC-05 | As an operator, I can disable password login | When `OIDC_DISABLE_PASSWORD_LOGIN=true` (and OIDC is enabled), `POST /api/auth/login` and `POST /api/auth/register` return `403 FORBIDDEN`; the UI hides password forms. |
| REQ-OIDC-06 | As the SPA, I can learn how to render auth | `GET /api/auth/config` returns registration openness, whether password login is enabled, and OIDC `{ enabled, buttonText, autoLaunch }` without auth. |
| REQ-OIDC-07 | As a user, auto-launch can skip the login form | When `OIDC_AUTO_LAUNCH=true`, visiting login redirects into OIDC unless `?autoLaunch=0`. `?autoLaunch=1` forces auto-launch for that request. |
| REQ-OIDC-08 | As a user, my email from the IdP is my identity | The email claim is required for OIDC login; it is stored on the user as the unique login identifier and returned by `/api/auth/me`. If the claim changes to an address already held by another account, login fails rather than merging the two. |

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
| REQ-SHARE-06 | As a signed-in user, I can list other users for sharing | `GET /api/users` returns `{ id, name }` for all accounts (self-host directory). Email addresses are never returned for other users. |

### Client & ops

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| REQ-UI-01 | As a user, I can use the app on phone and desktop | Responsive MD3 UI; core flows usable at ~360px and ≥1024px widths |
| REQ-OPS-01 | As a self-hoster, I can run the stack with Docker Compose | Documented compose up serves UI + API; data persists in a volume |
| REQ-OPS-02 | As a self-hoster, I can tell which version is running and whether the database is reachable | `GET /api/health` returns `{ status: "ok", version, schemaVersion }` after a successful `SELECT 1`. If the database cannot be queried, the response is `503` with `{ status: "error", version }` |

## Out of scope

- Viewer / editor role picker (single fixed `member` capability for now)
- Email/link invites
- Email verification, password reset (email-based)
- Authenticated password change remains in scope for users with a local password (REQ-AUTH-05)
- Item quantities, categories, stores
- Drag-and-drop reorder UI (API may support `position`; UI reorder is optional polish)
- Real-time collaboration
- Offline PWA caching
- Native apps / mobile custom-scheme OAuth redirects
- SAML, multiple concurrent IdPs, admin OAuth settings UI
- OIDC backchannel logout and IdP end-session on logout

## Email, display name & password rules

- Email: a valid address, at most 254 characters. Normalized by trimming and lower-casing before storage and comparison, so it is unique case-insensitively. The same rule is enforced for OIDC email claims before merge/create.
- Display name: 1–64 characters after trimming; not unique. Defaults to the email local part when not supplied.
- Password: minimum 8 characters (no complexity score)

Email addresses are identifiers only. Nothing is sent to them, and ownership is not verified for local accounts (see [Out of scope](#out-of-scope)).
