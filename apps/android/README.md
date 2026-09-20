# Genesis Lists — Android companion

Native Kotlin / Jetpack Compose client for a **self-hosted** Genesis Lists server.

Application id / namespace: `uk.co.xeiverse.genesislists`.

## Requirements

- JDK 17+
- Android SDK (compile/target SDK 35, min SDK 26)
- A reachable Genesis Lists server (Docker or `pnpm` API)

## Build

From this directory:

```bash
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease
./gradlew :app:testDebugUnitTest
```

CI runs `:app:testDebugUnitTest` on every pull request (see `.github/workflows/ci.yml`).
Tagged releases also run [Android Release](../../.github/workflows/android-release.yml) when the GitHub Release is published, which builds a release APK and attaches `genesis-lists-<version>.apk`. Without `ANDROID_KEYSTORE_*` secrets the APK is debug-signed so it stays sideloadable; set those secrets for a stable signing key. The workflow signs with `apksigner` when the tag's Gradle config leaves the APK unsigned (as `v0.3.0` does).

Debug APK: `app/build/outputs/apk/debug/app-debug.apk`

Release APK: `app/build/outputs/apk/release/app-release.apk` (override version with `-PversionName=0.3.0`)

Install on a device/emulator:

```bash
./gradlew :app:installDebug
```

## First run

1. Enter the server **base URL** (no `/api` suffix), e.g. `https://lists.example.com` or `http://10.0.2.2:3000` for an emulator talking to a host machine API.
2. The app validates the URL (HTTPS always; HTTP only for private/local hosts), calls `GET /api/health`, then shows login/register.
3. After sign-in, lists sync into a local Room **read cache**.

## Network / cleartext

**Prefer HTTPS.** The network security config permits cleartext because Android XML cannot express RFC1918 CIDRs. The app enforces an allowlist in `ServerUrlPolicy` before any request:

- Private IPv4: `10/8`, `172.16/12`, `192.168/16`
- Link-local `169.254/16`
- `localhost`, `127.0.0.1`, `::1`
- Emulator host loopback `10.0.2.2`
- `.local` mDNS hostnames

Public HTTP hosts (e.g. `http://lists.example.com`) are rejected with an error. Do **not** expose Genesis Lists over cleartext on the public internet. Use a reverse proxy with TLS for any remote access (see root [Self-hosting](../../docs/06-self-hosting.md)).

Session auth uses the same `genesis_session` cookie as the web app, persisted in EncryptedSharedPreferences via OkHttp’s cookie jar. No Bearer/JWT API changes are required.

## OIDC (Login with OAuth)

When the server has OIDC enabled (`GET /api/auth/config` → `oidc.enabled`), Auth shows a button labeled with `oidc.buttonText` (default **Login with OAuth**; below the password form when both are on; OAuth-only when password login is disabled).

The server and app **must both** include mobile OIDC support. Config must expose `oidc.mobileLogin: true`. If OIDC is enabled but `mobileLogin` is missing/false (older server), the app shows an upgrade message instead of opening Custom Tabs into a web-only login.

If `GET /api/auth/config` fails, Auth shows an error and **Retry** — it does not fall back to defaults that would hide OIDC.

Flow:

1. App opens `{baseUrl}/api/auth/oidc/start?client=android` in a Chrome Custom Tab.
2. IdP redirects to the **web** callback (`PUBLIC_BASE_URL/api/auth/oidc/callback`) — no extra IdP redirect URI for mobile.
3. Server redirects Custom Tabs to HTTPS `{baseUrl}/api/auth/oidc/android-handoff?ticket=...` (HTML auto-opens the app scheme; no session cookie in the browser).
4. Deep link `uk.co.xeiverse.genesislists://oauth-callback?ticket=...` reaches the app; the intent URI is cleared after parse. The app exchanges via `POST /api/auth/oidc/mobile-exchange` and stores `genesis_session` in the cookie jar. If a session already exists (e.g. activity recreation with a stale deep link), exchange is skipped.

Operators only need the usual OIDC env (`OIDC_*`, `PUBLIC_BASE_URL`); see [OIDC guide](../../docs/guides/oauth-authentik.md) and [ADR 0007](../../docs/adr/0007-android-companion.md). If an existing deploy still sets `OIDC_BUTTON_TEXT=Sign in with Authentik` (or similar), update or unset it and recreate the container so the button shows **Login with OAuth**.

The app URL scheme must match `COOKIE_SECURE`. `COOKIE_SECURE=true` (typical production HTTPS env) on `http://192.168.x.x` makes Chrome Custom Tabs and OkHttp drop the login cookies: password login shows a Secure-cookie hint, and OIDC returns **OIDC sign-in failed**. Point the app at the HTTPS origin, or set `COOKIE_SECURE=false` only on HTTP-only LAN instances and recreate the container.

## Settings & custom proxy headers

- **Settings** is reachable from server setup and sign-in (ghost text button), as well as from the lists app bar. Back returns without clearing the server URL or session.
- Changing the **server base URL** (Save & verify) clears the cookie jar and Room cache when the normalized URL changes, then returns you to Auth. Custom proxy headers are kept.
- Under **Advanced → Custom proxy headers**, you can add name/value pairs (e.g. Cloudflare Access service tokens). They are stored in encrypted prefs and attached by an OkHttp interceptor on every API request, additive to the session cookie. Logout does **not** clear these headers.

## Offline behavior

- **Read:** cached lists/items remain viewable offline.
- **Write:** create / rename / delete / toggle require network; the UI explains when offline.
- **Sync:** pull after login, on app resume when online, and via pull-to-refresh. Server is source of truth. Lists removed from the server index also drop their cached items.

## Out of scope (this phase)

Offline writes, sharing UI, push, widgets, Play Store publishing.
