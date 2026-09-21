# Changelog

## Unreleased

- Android: ticking or editing a list item no longer sends `null` for omitted PATCH fields (`text`/`position`), which the API rejects as Invalid request body
- Personal access tokens (Bearer) for list/item APIs: create/list/revoke via session (`/api/auth/tokens`), Settings UI, schema version 6 (`api_tokens` stores hash only)

## 0.3.1

### Android GitHub Release APK

- GitHub Actions builds the Android companion APK when a GitHub Release is published and attaches `genesis-lists-<version>.apk`
- Release Gradle builds are debug-signed when no keystore is provided, so sideloading works without Play signing secrets
- Android Release signs unsigned APKs with `apksigner` so older tags without a Gradle signing config (including `v0.3.0`) still attach an installable artifact
- Release `versionName` / `versionCode` can be overridden with `-PversionName=` (versionCode is derived from semver)

### Android session cookies on HTTP

- Android explains password-login failures when `COOKIE_SECURE=true` is used with an `http://` server URL (the session cookie cannot be sent). A blocked Secure cookie is not treated as a signed-in session, so a later OIDC retry still exchanges the ticket. HTTP OIDC Custom Tabs failures hint at the same mismatch without asserting it as the only cause.

## 0.3.0

### Native Android companion

- Official Kotlin / Jetpack Compose client under `apps/android/` (`uk.co.xeiverse.genesislists`) for self-hosted servers
- Cookie-session auth with EncryptedSharedPreferences; Room offline **read** cache; mutations require network
- Pre-auth Settings and custom proxy headers (OkHttp interceptor) for reverse-proxy auth
- OIDC via Custom Tabs: `client=android` → HTTPS android-handoff → one-time mobile ticket exchange (schema version 5)
- Default OAuth button text **Login with OAuth**; `oidc.mobileLogin` gates older servers
- Review hardening: clear stale OAuth intents, purge Room orphan items, clear session on server URL change, cleartext allowlist for private/local hosts, auth-config Retry, Android unit tests in CI

### Breaking: accounts are identified by email

- Sign in with an email address and password instead of a username. Emails are unique, and are compared trimmed and lower-cased.
- Accounts gain a separate display name (1–64 characters, not unique). It defaults to the part of the email before the `@` and can be changed in Settings via the new `PATCH /api/auth/me`. Control characters and bidi overrides are refused.
- The share picker shows each person's email under their display name, following Immich, so two people sharing a name can still be told apart. `DIRECTORY_SHOW_EMAILS=false` drops the addresses from `GET /api/users` while leaving the directory populated.
- OIDC links identities by the email claim instead of the username claim, so an account created before the identity provider was connected is claimed by the matching IdP user on first login. `OIDC_USERNAME_CLAIM` is replaced by `OIDC_EMAIL_CLAIM` (default `email`) and `OIDC_NAME_CLAIM` (default `name`). A login is refused unless `email_verified` is absent or affirmative; values such as `"false"` and `0` are treated as unverified.
- **Schema version 4 deletes data, and in practice removes every local password account.** Back up your database before upgrading. An account is kept only when an email can be recovered for it — its username if that is already an address, which the old `[a-zA-Z0-9_-]` username rules made impossible, or otherwise an address a previous OIDC login stored on it. A kept account whose username was not itself an address keeps that username as its display name. Every other account is deleted along with the lists it owns, those lists' items and memberships, its memberships of other people's lists, and its sessions. Removed accounts are named in the startup log. You can rescue an account by writing a public-form address (dotted domain) into `users.email` before upgrading; `admin@localhost` is not accepted. See [self-hosting](docs/06-self-hosting.md) and [ADR 0006](docs/adr/0006-email-login-identifier.md).
- API fields renamed: `User` is now `{ id, email, name, authProviders }`, `GET /api/users` returns `{ id, name, email }` (`email` omitted when `DIRECTORY_SHOW_EMAILS=false`), `List.ownerUsername` is `ownerName`, and `ListMember.username` is `name`.

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
