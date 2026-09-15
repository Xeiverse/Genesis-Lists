# OIDC Acceptance Checklist

Verify against [01-requirements.md](../01-requirements.md) (`REQ-OIDC-*`) and `docs/openapi/openapi.yaml`. Automated items run in `pnpm test`.

## Config & ops

- [x] **REQ-OIDC-01** `OIDC_ENABLED=false` (default): OIDC start returns `404`; process starts without issuer settings — *API test*
- [ ] **REQ-OIDC-01** `OIDC_ENABLED=true` without required env or with bad discovery: process refuses to start — *manual / ops*
- [x] **REQ-OIDC-06** `GET /api/auth/config` returns `registrationOpen`, `passwordLoginEnabled`, and `oidc.{ enabled, buttonText, autoLaunch }` — *API test*

## Login flows

- [x] **REQ-OIDC-02** OIDC start redirects to the IdP; successful callback sets `genesis_session` and redirects to `/` — *API test with mock provider*
- [x] **REQ-OIDC-03** Second login with the same `(issuer, sub)` reuses the same local user — *covered by identity lookup before merge*
- [x] **REQ-OIDC-04** Existing local user `alice` links when IdP username claim is `alice` — *API test (bob merge)*
- [x] **REQ-OIDC-04** Unknown username with `OIDC_AUTO_REGISTER=true` creates a user with null password and optional email — *API test*
- [x] **REQ-OIDC-04** Unknown username with `OIDC_AUTO_REGISTER=false` fails auth without creating a user — *API test*
- [ ] **REQ-OIDC-04** Invalid username claim (fails local username rules) fails auth — *unit path via `extractOidcClaims`; exercise against a live IdP*
- [ ] **REQ-OIDC-07** Auto-launch redirects from `/login` unless `?autoLaunch=0`; `?autoLaunch=1` forces it — *UI*
- [x] **REQ-OIDC-08** Email claim stored and returned from `/api/auth/me` when present — *API test*

## Password disable

- [x] **REQ-OIDC-05** With `OIDC_DISABLE_PASSWORD_LOGIN=true`, login and register return `403`; UI hides password forms — *API test + UI*
- [x] **REQ-AUTH-05** OIDC-only user cannot change password (`403`); local user still can — *API test*

## Contract

- [x] OpenAPI paths for `/api/auth/config`, `/api/auth/oidc/start`, `/api/auth/oidc/callback` and extended `User` schema are covered by tests or manual checks
- [ ] Authentik guide steps match a working env table in [guides/oauth-authentik.md](../guides/oauth-authentik.md) — *manual against a live Authentik*
