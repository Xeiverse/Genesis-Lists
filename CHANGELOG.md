# Changelog

## 1.1.0

- Optional OpenID Connect login (Authentik and compatible IdPs) via environment variables
- Username merge links IdP users to existing local accounts; optional email from claims
- `OIDC_DISABLE_PASSWORD_LOGIN` for IdP-only households
- Schema version 2: nullable passwords, `user_identities`, OIDC login state

## 1.0.0

First release for self-hosting.

- Personal lists and checklist items, including a collapsed ticked section with clear-all
- Local accounts, signed session cookies, and password change that signs out other sessions
- Registration that stays open only until the first account, unless you set `ALLOW_REGISTRATION`
- SQLite on a Docker volume, with versioned schema steps so later upgrades can change tables
- `/api/health` reports the app version and schema version, and fails if the database is unreachable
