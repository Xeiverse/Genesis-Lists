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
- Settings is available before login (server setup / auth). **Advanced → Custom proxy headers** stores extra request headers in the same encrypted server settings prefs and applies them via an OkHttp interceptor on every API call (additive to cookies; not cleared on logout).

## Consequences

- CORS remains irrelevant for native OkHttp; HTTPS is preferred, with documented cleartext for private LAN.
- Reverse-proxy auth (e.g. Cloudflare Access client headers) can be configured on-device without API changes.
- Sharing, OIDC mobile redirects, offline writes, and Play distribution stay follow-ups.
- Web and Android stay feature-aligned through OpenAPI rather than a shared UI toolkit.
