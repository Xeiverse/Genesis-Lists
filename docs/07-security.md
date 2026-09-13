# Security

## Authentication model (MVP)

- Local **username + password** accounts.
- Passwords hashed with **argon2id** before storage; plaintext never logged or returned.
- Sessions established on register/login via an **HTTP-only**, **signed** cookie (not accessible to JS). The cookie payload is a random session id; the server looks it up in the `sessions` table.
- Cookie is signed with `SESSION_SECRET`. `Secure` flag on when HTTPS / `COOKIE_SECURE=true`; `SameSite=Lax`.
- Logout deletes the server-side session row and clears the cookie.

## Password & username policy

See [01-requirements.md](01-requirements.md). Request bodies larger than 16 KiB are rejected (`400 VALIDATION_ERROR`). Max lengths are enforced at the validation layer (Zod).

## Authorization

- Every list/item operation checks ownership.
- Fail closed: missing/invalid session → `401`.
- Cross-user resource access → `404`.

## Threat notes (MVP posture)

| Threat | Mitigation |
|--------|------------|
| Password theft at rest | argon2id |
| XSS stealing session | HTTP-only cookie; signed cookie; no `dangerouslySetInnerHTML` |
| CSRF | SameSite=Lax + same-origin SPA; consider CSRF token if cookie auth expands to cross-site |
| Brute force | Soft limit: no distributed rate limit in the app; operators should rate-limit `/api/auth/*` at the reverse proxy |
| Path traversal / SQLi | Parameterized SQL via `node:sqlite` prepared statements |
| Secret leakage | `SESSION_SECRET` via env; never commit secrets; refuse placeholders and secrets shorter than 32 characters when `COOKIE_SECURE=true` |
| Oversize payloads | 16 KiB JSON body limit |

## Out of scope for MVP security features

- Email verification, 2FA, email-based password **reset** flows
- OIDC / SSO
- Fine-grained RBAC beyond owner isolation
- Audit log UI

Authenticated password **change** (current + new password) is in scope; see `POST /api/auth/change-password`.

Operators should keep the instance private (VPN / auth proxy) if exposed to the public internet without additional hardening.
