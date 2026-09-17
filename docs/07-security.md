# Security

## Authentication model

- Local **email + password** accounts (optional when OIDC-only mode is enabled). The email is an identifier only: it is never verified and nothing is sent to it.
- Passwords hashed with **argon2id** before storage; plaintext never logged or returned. OIDC-only users may have a null `password_hash`.
- Sessions established on register/login/OIDC callback via an **HTTP-only**, **signed** cookie (not accessible to JS). The cookie payload is a random session id; the server looks it up in the `sessions` table.
- Cookie is signed with `SESSION_SECRET`. `Secure` flag on when HTTPS / `COOKIE_SECURE=true`; `SameSite=Lax`.
- Logout deletes the server-side session row and clears the cookie. It does **not** call the IdP end-session endpoint in this release.
- Changing a password deletes every other session for that user. The session that submitted the change stays signed in so Settings does not kick you out. Users without a password cannot use change-password.

## OIDC

- Authorization Code flow with PKCE; confidential client secret via `OIDC_CLIENT_SECRET`.
- Authorization `state` (and PKCE verifier / nonce) stored server-side with a short TTL; callback rejects unknown, reused, or expired state. A signed HTTP-only cookie binds `state` to the initiating browser.
- Expired OIDC login-state rows are pruned during start/callback as well as at startup.
- Redirect URI is fixed to `{PUBLIC_BASE_URL}/api/auth/oidc/callback` or an explicit `OIDC_REDIRECT_URI` — never taken from user input.
- IdP tokens are used only during the callback exchange; they are not persisted.
- Email claims must satisfy the same rules as local registration and are normalized the same way before merge or auto-register. A login with a missing or malformed email claim is refused.
- A login is refused unless `email_verified` is absent or affirmative. An absent claim is accepted because not every IdP emits it; anything present must say `true` (or `"true"` / `1` / `"1"`), so an IdP that serializes the flag as the string `"false"` is not mistaken for a verifying one. Note that the flag is read under its standard name even when `OIDC_EMAIL_CLAIM` points at a non-standard claim, where it may describe a different address.
- **Linking by email trusts the IdP.** On first OIDC login, an identity whose email matches an existing local account takes over that account — that is what lets an instance adopt an IdP after accounts already exist. An IdP that lets users set an arbitrary, unverified email can therefore take over a local account. Only connect an IdP you control, and prefer one that verifies addresses. See [ADR 0006](adr/0006-email-login-identifier.md).
- `OIDC_CLIENT_SECRET` and related secrets live in env; never commit them.
- Startup fails if `OIDC_ENABLED=true` but discovery or required env is invalid.

See [ADR 0005](adr/0005-oidc.md) and [guides/oauth-authentik.md](guides/oauth-authentik.md).

## Password & email policy

See [01-requirements.md](01-requirements.md). Request bodies larger than 16 KiB are rejected (`400 VALIDATION_ERROR`). Max lengths are enforced at the validation layer (Zod).

## Authorization

- List/item operations require the authenticated user to be the **owner** or a **member** (`list_members`).
- **Owner-only** capabilities: delete list, get/put members.
- **Member** capabilities: read/write items, rename, leave list (`DELETE .../members/me`).
- Fail closed: missing/invalid session → `401`.
- No access (not owner, not member) → `404` (no existence leak).
- Access without capability (e.g. member deletes list) → `403 FORBIDDEN`.

## User directory

- `GET /api/users` returns every account’s `id`, display `name`, and `email` to any signed-in user.
- **The address is what makes the share picker unambiguous.** Display names are not unique and anyone can rename themselves onto someone else's, so without an address two rows in the picker can be indistinguishable at the moment an owner grants access. Display names additionally reject control characters and bidi overrides, which would otherwise let one name render as another.
- `DIRECTORY_SHOW_EMAILS=false` omits `email` from the response for operators who prefer the ambiguity to the exposure. The directory stays fully populated, because there is no admin role to fall back on and sharing needs it (see [ADR 0006](adr/0006-email-login-identifier.md)).
- Intended for household / small self-host installs so the share dialog can list people to tick.
- Do not expose a public Genesis Lists instance without understanding that every signed-in account can read every address on it.

## Threat notes

| Threat | Mitigation |
|--------|------------|
| Password theft at rest | argon2id |
| XSS stealing session | HTTP-only cookie; signed cookie; no `dangerouslySetInnerHTML` |
| CSRF | SameSite=Lax + same-origin SPA; consider CSRF token if cookie auth expands to cross-site |
| OIDC CSRF / replay | `state` + PKCE + signed `genesis_oidc_state` cookie bound to the initiating browser; one-time server-side state rows |
| Brute force | Soft limit: no distributed rate limit in the app; operators should rate-limit `/api/auth/*` at the reverse proxy |
| Path traversal / SQLi | Parameterized SQL via `node:sqlite` prepared statements |
| Secret leakage | `SESSION_SECRET` / `OIDC_CLIENT_SECRET` via env; never commit secrets; refuse placeholders and secrets shorter than 32 characters when `COOKIE_SECURE=true` |
| Open registration | `ALLOW_REGISTRATION` (see [self-hosting](06-self-hosting.md)). Unset/`bootstrap` closes after the first account. A public instance with registration open lets anyone create accounts |
| Oversize payloads | 16 KiB JSON body limit |
| Address enumeration via directory | Accepted for self-host sharing UX: an unambiguous share picker needs the address. `DIRECTORY_SHOW_EMAILS=false` removes it at the cost of indistinguishable rows. Keep instances private if neither trade-off is acceptable |
| Display-name spoofing in the share picker | Names are not unique and are freely changeable, so the address is shown alongside; control characters and bidi overrides are rejected so a name cannot render as another |
| Account takeover via IdP email spoofing | Refuse any `email_verified` that is present and not affirmative; document that email linking trusts the IdP; operators should only connect IdPs they control |
| Registration email enumeration | `409 CONFLICT` on register reveals that an address is registered. Accepted: closed/bootstrap registration is the default, and rate limiting belongs at the reverse proxy |
| Login timing enumeration | An unknown address returns before argon2 runs, so response time also reveals whether an address is registered. Accepted on the same terms as the `409` above; rate-limit `/api/auth/*` at the reverse proxy |

## Out of scope for current security features

- Email verification, 2FA, email-based password **reset** flows
- Fine-grained RBAC beyond owner vs single `member` role
- Audit log UI
- OIDC backchannel logout / IdP single logout
- SAML

Authenticated password **change** (current + new password) remains in scope for users with a local password; see `POST /api/auth/change-password`.

Operators should keep the instance private (VPN / auth proxy) if exposed to the public internet without additional hardening.
