# Changelog

## Unreleased

### OIDC

- Optional OpenID Connect login (Authentik and compatible IdPs) via environment variables
- Username merge links IdP users to existing local accounts; optional email from claims
- `OIDC_DISABLE_PASSWORD_LOGIN` for IdP-only households
- Schema version 3: nullable passwords, `user_identities`, OIDC login state

### Sharing

- Share lists with other accounts via an Immich-style user picker (search + checkboxes)
- Members can read/write items and rename; only the owner can delete the list or manage members
- Members can leave a shared list
- `GET /api/users` directory for the share picker; schema version 2 (`list_members`)

## 1.0.0

First release for self-hosting.

- Personal lists and checklist items, including a collapsed ticked section with clear-all
- Local accounts, signed session cookies, and password change that signs out other sessions
- Registration that stays open only until the first account, unless you set `ALLOW_REGISTRATION`
- SQLite on a Docker volume, with versioned schema steps so later upgrades can change tables
- `/api/health` reports the app version and schema version, and fails if the database is unreachable
