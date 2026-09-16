# Changelog

## Unreleased

### Breaking: accounts are identified by email

- Sign in with an email address and password instead of a username. Emails are unique, and are compared trimmed and lower-cased.
- Accounts gain a separate display name (1–64 characters, not unique). It defaults to the part of the email before the `@` and can be changed in Settings via the new `PATCH /api/auth/me`. It is the only user field the share picker and shared-list cards show, so email addresses are never exposed to other accounts.
- OIDC links identities by the email claim instead of the username claim, so an account created before the identity provider was connected is claimed by the matching IdP user on first login. `OIDC_USERNAME_CLAIM` is replaced by `OIDC_EMAIL_CLAIM` (default `email`) and `OIDC_NAME_CLAIM` (default `name`). A login is refused when the IdP asserts `email_verified: false`.
- **Schema version 4 deletes data.** Back up your database before upgrading. An account is kept when an email can be recovered for it — its username if that is already an address, otherwise an address a previous OIDC login stored on it. Every other account is deleted along with the lists it owns, those lists' items and memberships, its memberships of other people's lists, and its sessions. Removed accounts are named in the startup log. See [self-hosting](docs/06-self-hosting.md) and [ADR 0006](docs/adr/0006-email-login-identifier.md).
- API fields renamed: `User` is now `{ id, email, name, authProviders }`, `GET /api/users` returns `{ id, name }`, `List.ownerUsername` is `ownerName`, and `ListMember.username` is `name`.

## 0.2.0

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

### License

- Relicensed under AGPL-3.0-only so modified network deployments must offer source

## 0.1.0

First release for self-hosting.

- Personal lists and checklist items, including a collapsed ticked section with clear-all
- Local accounts, signed session cookies, and password change that signs out other sessions
- Registration that stays open only until the first account, unless you set `ALLOW_REGISTRATION`
- SQLite on a Docker volume, with versioned schema steps so later upgrades can change tables
- `/api/health` reports the app version and schema version, and fails if the database is unreachable
