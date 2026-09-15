# ADR 0002: Session-Based Authentication

## Status

Accepted

## Context

MVP needs multi-user auth without OIDC complexity. SPA on same origin can use cookies safely.

## Decision

- Use **HTTP-only session cookies** after register/login. Cookies are **signed** with `SESSION_SECRET`; the payload is still a random session id.
- Hash passwords with **argon2id**.
- Store sessions server-side in SQLite (table `sessions`) keyed by that session id, so logout and rotation are straightforward.
- Defer JWT access tokens for the SPA. OIDC (when enabled) still ends in these same session cookies — see [ADR 0005](0005-oidc.md).

## Consequences

- Simple browser auth; no token storage in localStorage.
- Horizontal multi-instance later needs shared session store or sticky sessions (acceptable for MVP single-instance).
- OIDC identity linking does not rewrite list APIs.
