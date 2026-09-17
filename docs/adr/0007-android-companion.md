# ADR 0007: Native Android companion (cookie session + read cache)

## Status

Accepted

## Context

Genesis Lists is self-hosted with cookie-session auth (`genesis_session`). The roadmap called for native clients against the OpenAPI contract. Users need a phone companion without changing the API auth model or building offline-first writes. Web OIDC already ships (ADR 0005); Custom Tabs keep cookies in the browser store, so Android needs a ticket handoff.

## Decision

- Ship an official Android app under `apps/android/` (Kotlin, Jetpack Compose, Material 3), package `uk.co.xeiverse.genesislists`.
- Talk to a user-configured server base URL; reuse the existing REST API unchanged.
- Persist `genesis_session` with OkHttp `CookieJar` + EncryptedSharedPreferences (no Bearer/JWT).
- Cache list/item GETs in Room for **offline read only**; mutations require network; server remains source of truth.
- Settings is available before login. **Advanced → Custom proxy headers** stores extra request headers in encrypted prefs and applies them via an OkHttp interceptor (additive to cookies; not cleared on logout).
- **OIDC on Android:** `GET /api/auth/oidc/start?client=android` → IdP (web callback URI) → deep link `uk.co.xeiverse.genesislists://oauth-callback?ticket=...` → `POST /api/auth/oidc/mobile-exchange` sets the session cookie in the app jar.

## Consequences

- CORS remains irrelevant for native OkHttp; HTTPS is preferred, with documented cleartext for private LAN.
- Reverse-proxy auth headers and OIDC both work without Bearer tokens.
- Operators need no extra IdP redirect URI for mobile (web callback forwards to the app).
- Offline writes, Play distribution, and IdP SLO stay follow-ups.
