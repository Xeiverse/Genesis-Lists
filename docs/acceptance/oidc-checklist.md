# OIDC Acceptance Checklist

Verify against [01-requirements.md](../01-requirements.md) (`REQ-OIDC-*`) and `docs/openapi/openapi.yaml`. Automated items run in `pnpm test`.

## Config & ops

- [x] **REQ-OIDC-01** `OIDC_ENABLED=false` (default): OIDC start returns `404`; process starts without issuer settings — *API test*
- [ ] **REQ-OIDC-01** `OIDC_ENABLED=true` without required env or with bad discovery: process refuses to start — *manual / ops*
- [x] **REQ-OIDC-06** `GET /api/auth/config` returns `registrationOpen`, `passwordLoginEnabled`, and `oidc.{ enabled, buttonText, autoLaunch, mobileLogin }` — *API test*

## Login flows

- [x] **REQ-OIDC-02** OIDC start redirects to the IdP; successful callback sets `genesis_session` and redirects to `/` — *API test with mock provider*
- [x] Android `?client=android`: callback redirects to HTTPS android-handoff with a one-time ticket (no session cookie); `POST /api/auth/oidc/mobile-exchange` sets the cookie; ticket reuse returns `401` — *API test*
- [ ] Android: after successful OIDC login, activity recreation (rotation) stays signed in without re-exchanging a stale deep-link ticket — *manual*
- [x] **REQ-OIDC-03** Second login with the same `(issuer, sub)` reuses the same local user — *covered by identity lookup before merge*
- [x] **REQ-OIDC-04** Existing local account registered before the IdP was connected links when the IdP email claim matches its email, case-insensitively — *API test (bob merge)*
- [x] **REQ-OIDC-04** Unknown email with `OIDC_AUTO_REGISTER=true` creates a user with null password, the claimed email, and a display name from the name claim — *API test*
- [x] **REQ-OIDC-04** Unknown email with `OIDC_AUTO_REGISTER=false` fails auth without creating a user — *API test*
- [x] **REQ-OIDC-04** Missing or malformed email claim fails auth — *unit test via `extractOidcClaims`*
- [x] **REQ-OIDC-04** `email_verified` that is present and not affirmative (`false`, `"false"`, `0`) fails auth unless `OIDC_REQUIRE_EMAIL_VERIFIED=false`; an absent or affirmative (`true`, `"true"`, `1`) claim is accepted — *unit test via `extractOidcClaims`*
- [ ] **REQ-OIDC-07** Auto-launch redirects from `/login` unless `?autoLaunch=0`; `?autoLaunch=1` forces it — *UI*
- [x] **REQ-OIDC-08** Email claim stored and returned from `/api/auth/me` — *API test*

## Password disable

- [x] **REQ-OIDC-05** With `OIDC_DISABLE_PASSWORD_LOGIN=true`, login and register return `403`; UI hides password forms — *API test + UI*
- [x] **REQ-AUTH-05** OIDC-only user cannot change password (`403`); local user still can — *API test*

## Contract

- [x] OpenAPI paths for `/api/auth/config`, `/api/auth/oidc/start`, `/api/auth/oidc/callback` and extended `User` schema are covered by tests or manual checks
- [ ] Authentik guide steps match a working env table in [guides/oauth-authentik.md](../guides/oauth-authentik.md) — *manual against a live Authentik*
