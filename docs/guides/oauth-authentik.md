# OAuth / OIDC with Authentik

Genesis Lists supports third-party sign-in via [OpenID Connect](https://openid.net/connect/) the same way Immich does: configure a confidential OAuth2/OIDC client in your IdP, then point Genesis Lists at it with environment variables.

This guide uses [Authentik](https://goauthentik.io/). Other OIDC providers (Authelia, Keycloak, Google) use the same Genesis Lists env vars; only the IdP-side screens differ.

## Prerequisites

- Genesis Lists reachable at a stable public URL (HTTPS in production), e.g. `https://lists.example.com`
- An Authentik instance the Genesis Lists **server** can reach for discovery and token exchange
- Operator access to set container env vars and recreate the app

## 1. Create an application and provider in Authentik

1. Open the Authentik Admin interface.
2. **Applications → Applications → Create with Provider** (or New Application).
3. Provider type: **OAuth2 / OpenID Connect**.
4. Configure the provider:

| Setting | Value |
|---------|--------|
| Client type | Confidential |
| Grant types | Authorization code |
| Redirect URIs | `https://lists.example.com/api/auth/oidc/callback` (Strict) |
| Signing key | Any available RS256 signing key |
| Encryption key | Leave **empty** (encrypted ID tokens are not supported) |

5. Note the **Client ID**, **Client Secret**, and application **slug**.
6. Optional: set the Authentik Launch URL to `https://lists.example.com/login?autoLaunch=1` so the Authentik app catalog jumps straight into OIDC.

Issuer URL pattern (trailing slash matters for Authentik):

```text
https://authentik.example.com/application/o/<application_slug>/
```

Discovery document (either form works; Genesis Lists appends `.well-known/openid-configuration` when needed):

```text
https://authentik.example.com/application/o/<application_slug>/.well-known/openid-configuration
```

Confirm discovery returns JSON **from inside the Genesis Lists container** (same network/TLS path the app uses):

```bash
docker compose exec app wget -qO- \
  'https://authentik.example.com/application/o/<slug>/.well-known/openid-configuration' | head
```

## 2. Configure Genesis Lists

Add to your production `.env` (see [self-hosting](../06-self-hosting.md)):

```bash
PUBLIC_BASE_URL=https://lists.example.com

OIDC_ENABLED=true
OIDC_ISSUER_URL=https://authentik.example.com/application/o/<application_slug>/
OIDC_CLIENT_ID=<client-id-from-authentik>
OIDC_CLIENT_SECRET=<client-secret-from-authentik>
OIDC_SCOPE=openid profile email
OIDC_BUTTON_TEXT=Login with OAuth
OIDC_AUTO_REGISTER=true
OIDC_AUTO_LAUNCH=false
OIDC_EMAIL_CLAIM=email
OIDC_NAME_CLAIM=name
# Keep the default (true). If local Authentik users fail with
# reason=email_unverified, verify the address in Authentik first.
# Only then, and only for an IdP that cannot self-enroll arbitrary emails:
# OIDC_REQUIRE_EMAIL_VERIFIED=false
OIDC_DISABLE_PASSWORD_LOGIN=false
```

`OIDC_BUTTON_TEXT` is cosmetic and provider-neutral (default **Login with OAuth**). It is not Authentik-specific. Existing deploys that set an older value (for example `Sign in with Authentik`) should update or unset `OIDC_BUTTON_TEXT` and recreate the container.

Recreate the container so env changes apply:

```bash
docker compose --env-file .env up -d
```

If the process exits immediately, check logs for missing OIDC settings or discovery failure.

### Recommended household setup (Authentik-only)

Keep one bootstrap local admin until OIDC works, then:

```bash
OIDC_DISABLE_PASSWORD_LOGIN=true
OIDC_AUTO_REGISTER=true
```

Existing local users whose email matches the Authentik `email` claim are **linked** on first OIDC login (for example Authentik `alice@example.com` → the Genesis Lists account registered as `alice@example.com`). This is how an instance that already had accounts adopts Authentik without recreating them: make sure each Authentik user's email matches the address the person registered with.

## 3. Redirect URI checklist

| Environment | Redirect URI |
|-------------|--------------|
| Production hostname | `https://lists.example.com/api/auth/oidc/callback` |
| Local HTTP try-out | `http://localhost:3000/api/auth/oidc/callback` (set `PUBLIC_BASE_URL` accordingly; OIDC against a real IdP still needs that IdP to allow this URI) |

If the public URL differs from how the container sees itself, set `PUBLIC_BASE_URL` to the browser-facing origin, or set `OIDC_REDIRECT_URI` to the full callback URL.

## 4. Email and name claims

The `email` scope must be granted to the provider, and every Authentik user signing in must have an email address set. Login fails without one.

| Genesis Lists setting | Default | Authentik |
|-----------------------|---------|-----------|
| `OIDC_EMAIL_CLAIM` | `email` | The account identifier. Must be a valid address; it is matched (lower-cased) against `users.email` to link or create the local account |
| `OIDC_NAME_CLAIM` | `name` | Display name used when creating a new account. Falls back to the part of the email before the `@`. Only applied at creation, so a user's own renames are not overwritten |

Genesis Lists refuses the login unless `email_verified` is absent or affirmative, or you set `OIDC_REQUIRE_EMAIL_VERIFIED=false`. Authentik local users typically send `email_verified=false` until you mark the address verified (Directory → Users → the user). For a private Authentik you control, set `OIDC_REQUIRE_EMAIL_VERIFIED=false` in the Genesis Lists env and recreate the container.

## 5. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Container exits; OIDC discovery error | Issuer URL, trailing slash, TLS/CA inside the container, proxy not returning HTML/login page for `.well-known` |
| Redirect URI mismatch | Authentik Strict URI must equal `PUBLIC_BASE_URL` + `/api/auth/oidc/callback` (or `OIDC_REDIRECT_URI`) |
| Login works at IdP then `/login?error=oidc` | Server logs; missing or invalid `email` claim; `email_verified` present and not affirmative (verify the address in Authentik, or set `OIDC_REQUIRE_EMAIL_VERIFIED=false`); `OIDC_AUTO_REGISTER=false` with no matching local user |
| Android **OIDC sign-in failed** after Authentik | Same email-claim / `email_verified` causes as web. Custom Tabs get an HTML interstitial from `/oidc/start` so `genesis_oidc_state` can persist; callback still requires that cookie. On `http://`, COOKIE_SECURE must be false for the session cookie after ticket exchange. |
| Password form still shown | `OIDC_DISABLE_PASSWORD_LOGIN` only applies when `OIDC_ENABLED=true`; recreate container after env change |
| Encryption / token errors with Authentik | Leave the provider **encryption key** empty; keep a signing key |

## Related

- [ADR 0005](../adr/0005-oidc.md)
- [Self-hosting env table](../06-self-hosting.md)
- [OIDC acceptance checklist](../acceptance/oidc-checklist.md)
- Immich’s OAuth docs (same operator shape): https://docs.immich.app/administration/oauth/
- Authentik Immich integration (IdP-side pattern): https://integrations.goauthentik.io/media/immich/
