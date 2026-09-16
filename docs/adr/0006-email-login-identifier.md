# ADR 0006: Email as the Login Identifier

## Status

Accepted

## Context

Accounts were identified by a username (3–32 chars, `[a-zA-Z0-9_-]`) with an optional, non-unique email that only OIDC populated ([ADR 0005](0005-oidc.md)). That created two problems.

First, OIDC linking matched `OIDC_USERNAME_CLAIM` against `users.username`. Usernames are local to each system, so an operator who created accounts before connecting an IdP had to make the two sets of usernames agree by hand. The email address is the identifier both sides already share.

Second, a username is a second credential to invent and remember for an app that has no other use for it. It is neither verifiable nor a good display label.

## Decision

- **Email is the sole login identifier.** `users.email` is `NOT NULL UNIQUE`, stored trimmed and lower-cased, and compared after the same normalization. `users.username` is dropped.
- **A separate display name.** `users.name` (`NOT NULL`, 1–64 chars, not unique) is what the UI shows: avatars, "Shared by …", and the share picker. Users can change it from Settings via `PATCH /api/auth/me`. When registration or OIDC does not supply one, it defaults to the local part of the email.
- **The user directory never exposes emails.** `GET /api/users` returns `{ id, name }`. Sharing is still performed by user id.
- **OIDC links by email.** Lookup order on callback is `(issuer, subject)` → `users.email` matching the email claim → auto-register when enabled. `OIDC_USERNAME_CLAIM` is replaced by `OIDC_EMAIL_CLAIM` (default `email`) and `OIDC_NAME_CLAIM` (default `name`). A login is refused when the IdP asserts `email_verified: false`.
- **Schema version 4 is destructive.** Accounts whose username is not a valid email cannot be migrated and are deleted along with their lists, items, memberships, sessions, and identity rows. Accounts whose username is already a valid email keep their password, lists, and shares. Following [ADR 0003](0003-sqlite-default.md), this happens as an ordered startup step recorded in `schema_migrations`.

## Consequences

- Upgrading is a breaking change for any instance whose users are not named by email. Operators must back up `genesis.db` first and recreate those accounts. The migration logs the addresses it removed.
- An instance that adopts an IdP later links automatically: a local account with the same email is claimed by the matching IdP account on first OIDC login.
- That automatic link means the IdP is trusted to assert email ownership. An IdP that lets a user set an arbitrary unverified email can take over a local account. The `email_verified: false` check is a partial mitigation; operators should only connect IdPs they control ([07-security.md](../07-security.md)).
- The directory now leaks display names rather than login identifiers, which is a smaller enumeration surface than either usernames or emails were.
- Display names are not unique, so two users can be indistinguishable in the share picker. Sharing by id keeps this a presentation problem rather than a correctness one; a disambiguating hint can be added later if it proves confusing.
- Email verification and password reset remain out of scope; the address is an identifier, not a proven contact channel.
