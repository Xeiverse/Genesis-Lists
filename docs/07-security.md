# Security

## Authentication model (MVP)

- Local **username + password** accounts.
- Passwords hashed with **argon2id** before storage; plaintext never logged or returned.
- Sessions established on register/login via **HTTP-only** cookie (not accessible to JS).
- `Secure` flag on when HTTPS / production; `SameSite=Lax`.
- Logout invalidates the server-side session (or clears signed cookie material per ADR 0002).

## Password & username policy

See [01-requirements.md](01-requirements.md). Reject oversize bodies; enforce max lengths at validation layer.

## Authorization

- Every list/item operation checks ownership.
- Fail closed: missing/invalid session → `401`.
- Cross-user resource access → `404`.

## Threat notes (MVP posture)

| Threat | Mitigation |
|--------|------------|
| Password theft at rest | argon2id |
| XSS stealing session | HTTP-only cookie; sanitize/avoid `dangerouslySetInnerHTML` |
| CSRF | SameSite=Lax + same-origin SPA; consider CSRF token if cookie auth expands to cross-site |
| Brute force | Soft limit: no distributed rate limit in MVP; document reverse-proxy rate limiting for operators |
| Path traversal / SQLi | Parameterized queries via ORM |
| Secret leakage | `SESSION_SECRET` via env; never commit secrets |

## Out of scope for MVP security features

- Email verification, 2FA, email-based password **reset** flows
- OIDC / SSO
- Fine-grained RBAC beyond owner isolation
- Audit log UI

Authenticated password **change** (current + new password) is in scope; see `POST /api/auth/change-password`.

Operators should keep the instance private (VPN / auth proxy) if exposed to the public internet without additional hardening.
