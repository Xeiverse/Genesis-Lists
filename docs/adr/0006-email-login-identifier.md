# ADR 0006: Email as the Login Identifier

## Status

Accepted

## Context

Accounts were identified by a username (3–32 chars, `[a-zA-Z0-9_-]`) with an optional, non-unique email that only OIDC populated ([ADR 0005](0005-oidc.md)). That created two problems.

First, OIDC linking matched `OIDC_USERNAME_CLAIM` against `users.username`. Usernames are local to each system, so an operator who created accounts before connecting an IdP had to make the two sets of usernames agree by hand. The email address is the identifier both sides already share.

Second, a username is a second credential to invent and remember for an app that has no other use for it. It is neither verifiable nor a good display label.

## Decision

- **Email is the sole login identifier.** `users.email` is `NOT NULL UNIQUE`, stored trimmed and lower-cased, and compared after the same normalization. `users.username` is dropped.
- **A separate display name.** `users.name` (`NOT NULL`, 1–64 chars, not unique) is what the UI shows: avatars, "Shared by …", and the share picker. Users can change it from Settings via `PATCH /api/auth/me`. When registration or OIDC does not supply one, it defaults to the local part of the email. Control characters and bidi overrides are rejected, because a name that renders as another person's is a mis-sharing risk rather than a cosmetic one.
- **The user directory carries the address.** `GET /api/users` returns `{ id, name, email }` and the share picker shows the address under the name. Since display names are not unique, the address is the only thing that tells two people apart at the moment an owner grants access. `DIRECTORY_SHOW_EMAILS=false` drops the address from the response for operators who would rather accept the ambiguity. Sharing is still performed by user id. See [Revision: the directory carries addresses](#revision-the-directory-carries-addresses).
- **OIDC links by email.** Lookup order on callback is `(issuer, subject)` → `users.email` matching the email claim → auto-register when enabled. `OIDC_USERNAME_CLAIM` is replaced by `OIDC_EMAIL_CLAIM` (default `email`) and `OIDC_NAME_CLAIM` (default `name`). A login is refused unless `email_verified` is absent or affirmative; any present value that does not say yes, including the string `"false"`, refuses the login.
- **Schema version 4 is destructive.** An account is migrated when an address can be recovered for it: its username if that is already a valid email (so password logins keep working), otherwise the optional email an IdP had stored on it. Those accounts keep their password, lists, and shares, and keep their username as the display name unless the username is itself an address, in which case the local part is used so the address does not become the label. Every other account is deleted along with its lists, items, memberships, sessions, and identity rows. Following [ADR 0003](0003-sqlite-default.md), this happens as an ordered startup step recorded in `schema_migrations`.

## Consequences

- Upgrading is a breaking change for any instance whose users are not named by email. Because pre-v4 usernames were restricted to `[a-zA-Z0-9_-]`, no username created through the app can be an address, so in practice every local password account is removed and only IdP-linked accounts survive. Operators must back up the database first, and can rescue accounts by writing a public-form address (dotted domain; `admin@localhost` is not accepted) into each `users.email` before upgrading. The migration logs the accounts it removed.
- An instance that adopts an IdP later links automatically: a local account with the same email is claimed by the matching IdP account on first OIDC login.
- That automatic link means the IdP is trusted to assert email ownership. An IdP that lets a user set an arbitrary unverified email can take over a local account. The `email_verified` check is a partial mitigation; operators should only connect IdPs they control ([07-security.md](../07-security.md)).
- Every signed-in user can read every address on the instance, which is a larger enumeration surface than usernames were. This is the cost of an unambiguous share picker on an instance with no concept of groups; `DIRECTORY_SHOW_EMAILS=false` is the lever for operators who weigh it the other way.
- Display names are still not unique, so an instance that turns addresses off can have two identical rows in the picker. Sharing by id keeps that from corrupting data, but the person choosing still cannot tell them apart.
- Email verification and password reset remain out of scope; the address is an identifier, not a proven contact channel.

## Revision: the directory carries addresses

The decision above originally read "the user directory never exposes emails", on the grounds that adding email logins should not turn the share picker into an address book. Review of the implementation found the cost of that: `GET /api/users` returned `{ id, name }` with non-unique names and no disambiguator, so two accounts named "Alice Smith" were identical in the picker, and any user could rename themselves onto a colleague's name and be picked by mistake. The share dialog is where an owner decides who gets access, so an ambiguous row there is an access-control problem, not a presentation one.

Immich, whose OIDC model this project follows ([ADR 0005](0005-oidc.md)), answers the same question by returning the address on every directory entry and rendering it beneath the name in its album share modal. Its privacy lever is an admin-level `publicUsers` setting that, when off, returns only the caller to non-admins so that sharing becomes admin-only. Genesis Lists has no admin role, so that exact lever would leave nobody able to share; `DIRECTORY_SHOW_EMAILS` therefore removes the addresses and leaves the directory populated.
