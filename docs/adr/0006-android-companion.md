# ADR 0006: Native Android companion (cookie session + read cache)

## Status

Accepted

## Context

Genesis Lists is self-hosted with cookie-session auth (`genesis_session`). The roadmap called for native clients against the OpenAPI contract. Users need a phone companion without changing the API auth model or building offline-first writes.

## Decision

- Ship an official Android app under `apps/android/` (Kotlin, Jetpack Compose, Material 3).
- Talk to a user-configured server base URL; reuse the existing REST API unchanged.
- Persist `genesis_session` with OkHttp `CookieJar` + EncryptedSharedPreferences (no Bearer/JWT).
- Cache list/item GETs in Room for **offline read only**; mutations require network; server remains source of truth.

## Consequences

- CORS remains irrelevant for native OkHttp; HTTPS is preferred, with documented cleartext for private LAN.
- Sharing, OIDC mobile redirects, offline writes, and Play distribution stay follow-ups.
- Web and Android stay feature-aligned through OpenAPI rather than a shared UI toolkit.
