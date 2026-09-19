# ADR 0007: Native Android companion (cookie session + read cache)

## Status

Accepted

## Context

Genesis Lists is self-hosted with cookie-session auth (`genesis_session`). The roadmap called for native clients against the OpenAPI contract. Users need a phone companion without changing the API auth model or building offline-first writes. Web OIDC already ships (ADR 0005); Custom Tabs keep cookies in the browser store, so Android needs a ticket handoff.

## Decision

- Ship an official Android app under `apps/android/` (Kotlin, Jetpack Compose, Material 3), package `uk.co.xeiverse.genesislists`.
- Talk to a user-configured server base URL; reuse the existing REST API unchanged.
- Persist `genesis_session` with OkHttp `CookieJar` + EncryptedSharedPreferences (no Bearer/JWT).
- Cache list/item GETs in Room for **offline read only**; mutations require network; server remains source of truth. When the list index is replaced, item rows whose `listId` is no longer present are deleted.
- Settings is available before login. **Advanced → Custom proxy headers** stores extra request headers in encrypted prefs and applies them via an OkHttp interceptor (additive to cookies; not cleared on logout). Changing the configured server URL clears cookies and the Room cache (headers kept) and returns the user to Auth.
- **Cleartext:** Network Security Config permits cleartext globally (Android XML cannot express CIDRs). The app rejects `http://` unless the host is private LAN, link-local, localhost, emulator `10.0.2.2`, or `.local`.
- **OIDC on Android:** `GET /api/auth/oidc/start?client=android` → IdP (web callback URI) → `302` to HTTPS `/api/auth/oidc/android-handoff?ticket=...` (HTML opens `uk.co.xeiverse.genesislists://oauth-callback?...`) → `POST /api/auth/oidc/mobile-exchange` sets the session cookie in the app jar. The deep-link intent URI is cleared after parse; ticket exchange is skipped if a session already exists. Auth config exposes `oidc.mobileLogin: true` so old servers without the handoff path can be detected. A failed config fetch shows Retry instead of defaulting to “OIDC unsupported.”
- CI runs `./gradlew :app:testDebugUnitTest` on pull requests.
- When a GitHub Release is published, Actions builds a release APK and attaches it for sideloading.

## Consequences

- CORS remains irrelevant for native OkHttp; HTTPS is preferred, with app-enforced cleartext allowlist for private LAN.
- Reverse-proxy auth headers and OIDC both work without Bearer tokens.
- Operators need no extra IdP redirect URI for mobile (web callback forwards to the app).
- Offline writes, Play distribution, and IdP SLO stay follow-ups.
