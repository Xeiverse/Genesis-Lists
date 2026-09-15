# Genesis Lists — Android companion

Native Kotlin / Jetpack Compose client for a **self-hosted** Genesis Lists server.

## Requirements

- JDK 17+
- Android SDK (compile/target SDK 35, min SDK 26)
- A reachable Genesis Lists server (Docker or `pnpm` API)

## Build

From this directory:

```bash
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
```

Debug APK: `app/build/outputs/apk/debug/app-debug.apk`

Install on a device/emulator:

```bash
./gradlew :app:installDebug
```

## First run

1. Enter the server **base URL** (no `/api` suffix), e.g. `https://lists.example.com` or `http://10.0.2.2:3000` for an emulator talking to a host machine API.
2. The app calls `GET /api/health`, then shows login/register.
3. After sign-in, lists sync into a local Room **read cache**.

## Network / cleartext

**Prefer HTTPS.** The app’s network security config permits cleartext HTTP so private-LAN self-hosts (`http://192.168.x.x`, `http://10.x.x.x`, emulator `10.0.2.2`) work. Do **not** expose Genesis Lists over cleartext on the public internet. Use a reverse proxy with TLS for any remote access (see root [Self-hosting](../../docs/06-self-hosting.md)).

Session auth uses the same `genesis_session` cookie as the web app, persisted in EncryptedSharedPreferences via OkHttp’s cookie jar. No Bearer/JWT API changes are required.

## Offline behavior

- **Read:** cached lists/items remain viewable offline.
- **Write:** create / rename / delete / toggle require network; the UI explains when offline.
- **Sync:** pull after login, on app resume when online, and via pull-to-refresh. Server is source of truth.

## Out of scope (this phase)

Offline writes, sharing UI, OIDC in-app, push, widgets, Play Store publishing.
