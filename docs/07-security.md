# Security

## Authentication model

- Local **username + password** accounts.
- Passwords hashed with **argon2id** before storage; plaintext never logged or returned.
- Sessions established on register/login via an **HTTP-only**, **signed** cookie (not accessible to JS). The cookie payload is a random session id; the server looks it up in the `sessions` table.
- Cookie is signed with `SESSION_SECRET`. `Secure` flag on when HTTPS / `COOKIE_SECURE=true`; `SameSite=Lax`.
- Logout deletes the server-side session row and clears the cookie.
- Changing a password deletes every other session for that user. The session that submitted the change stays signed in so Settings does not kick you out.

## Password & username policy

See [01-requirements.md](01-requirements.md). Request bodies larger than 16 KiB are rejected (`400 VALIDATION_ERROR`). Max lengths are enforced at the validation layer (Zod).

## Authorization

- List/item operations require the authenticated user to be the **owner** or a **member** (`list_members`).
- **Owner-only** capabilities: delete list, get/put members.
- **Member** capabilities: read/write items, rename, leave list (`DELETE .../members/me`).
- Fail closed: missing/invalid session → `401`.
- No access (not owner, not member) → `404` (no existence leak).
- Access without capability (e.g. member deletes list) → `403 FORBIDDEN`.

## User directory

- `GET /api/users` returns every account’s `id` and `username` to any signed-in user.
- Intended for household / small self-host installs so the share dialog can list people to tick.
- Do not expose a public Genesis Lists instance without understanding that all usernames are visible to every account.

## Threat notes

| Threat | Mitigation |
|--------|------------|
| Password theft at rest | argon2id |
| XSS stealing session | HTTP-only cookie; signed cookie; no `dangerouslySetInnerHTML` |
| CSRF | SameSite=Lax + same-origin SPA; consider CSRF token if cookie auth expands to cross-site |
| Brute force | Soft limit: no distributed rate limit in the app; operators should rate-limit `/api/auth/*` at the reverse proxy |
| Path traversal / SQLi | Parameterized SQL via `node:sqlite` prepared statements |
| Secret leakage | `SESSION_SECRET` via env; never commit secrets; refuse placeholders and secrets shorter than 32 characters when `COOKIE_SECURE=true` |
| Open registration | `ALLOW_REGISTRATION` (see [self-hosting](06-self-hosting.md)). Unset/`bootstrap` closes after the first account. A public instance with registration open lets anyone create accounts |
| Oversize payloads | 16 KiB JSON body limit |
| Username enumeration via directory | Accepted for self-host sharing UX; keep instances private if that is unacceptable |

## Out of scope for current security features

- Email verification, 2FA, email-based password **reset** flows
- OIDC / SSO
- Fine-grained RBAC beyond owner vs single `member` role
- Audit log UI

Authenticated password **change** (current + new password) is in scope; see `POST /api/auth/change-password`.

Operators should keep the instance private (VPN / auth proxy) if exposed to the public internet without additional hardening.
