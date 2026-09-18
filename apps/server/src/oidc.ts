import * as openid from "openid-client";
import {
  displayNameFromEmail,
  displayNameSchema,
  emailSchema,
} from "@genesis-lists/shared";
import { envFlag } from "./util.js";

export type OidcSettings = {
  enabled: boolean;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  buttonText: string;
  autoRegister: boolean;
  autoLaunch: boolean;
  emailClaim: string;
  nameClaim: string;
  disablePasswordLogin: boolean;
  redirectUri: string;
};

export type OidcClaims = {
  issuer: string;
  subject: string;
  email: string;
  name: string;
};

export type OidcProvider = {
  settings: OidcSettings;
  /** Issuer identifier string used for identity rows (from discovery). */
  issuer: string;
  buildAuthorizationUrl: (input: {
    state: string;
    codeVerifier: string;
    nonce: string | null;
  }) => Promise<URL>;
  exchangeCallback: (input: {
    callbackUrl: URL;
    codeVerifier: string;
    expectedState: string;
    expectedNonce: string | null;
  }) => Promise<OidcClaims>;
};

function requireWhenEnabled(
  enabled: boolean,
  name: string,
  value: string | undefined,
): string {
  const trimmed = value?.trim() ?? "";
  if (enabled && !trimmed) {
    throw new Error(`${name} is required when OIDC_ENABLED=true`);
  }
  return trimmed;
}

export function resolveOidcSettingsFromEnv(env: NodeJS.ProcessEnv): OidcSettings {
  const enabled = envFlag(env.OIDC_ENABLED, false);
  const issuerUrl = requireWhenEnabled(enabled, "OIDC_ISSUER_URL", env.OIDC_ISSUER_URL);
  const clientId = requireWhenEnabled(enabled, "OIDC_CLIENT_ID", env.OIDC_CLIENT_ID);
  const clientSecret = requireWhenEnabled(
    enabled,
    "OIDC_CLIENT_SECRET",
    env.OIDC_CLIENT_SECRET,
  );

  const redirectOverride = env.OIDC_REDIRECT_URI?.trim() ?? "";
  const publicBase = env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  let redirectUri = redirectOverride;
  if (!redirectUri) {
    if (enabled && !publicBase) {
      throw new Error(
        "PUBLIC_BASE_URL or OIDC_REDIRECT_URI is required when OIDC_ENABLED=true",
      );
    }
    redirectUri = publicBase ? `${publicBase}/api/auth/oidc/callback` : "";
  }

  return {
    enabled,
    issuerUrl,
    clientId,
    clientSecret,
    scope: env.OIDC_SCOPE?.trim() || "openid profile email",
    buttonText: env.OIDC_BUTTON_TEXT?.trim() || "Login with OAuth",
    autoRegister: envFlag(env.OIDC_AUTO_REGISTER, true),
    autoLaunch: envFlag(env.OIDC_AUTO_LAUNCH, false),
    emailClaim: env.OIDC_EMAIL_CLAIM?.trim() || "email",
    nameClaim: env.OIDC_NAME_CLAIM?.trim() || "name",
    disablePasswordLogin: enabled && envFlag(env.OIDC_DISABLE_PASSWORD_LOGIN, false),
    redirectUri,
  };
}

function claimString(
  claims: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = claims[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

/**
 * Absent means "this IdP does not emit the claim" and is accepted. Anything
 * present must say yes: IdPs serialize booleans as strings and as 0/1, so
 * matching only `=== false` would let `"false"` through.
 */
function emailIsVerified(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return value === true || value === "true" || value === 1 || value === "1";
}

export function extractOidcClaims(
  settings: OidcSettings,
  issuer: string,
  claims: Record<string, unknown>,
): OidcClaims {
  const subject = claimString(claims, "sub");
  if (!subject) {
    throw new Error("OIDC token is missing sub claim");
  }

  // An IdP that lets users set an unverified address could otherwise claim
  // someone else's account (07-security.md). An absent claim is accepted
  // because not every IdP emits it.
  if (!emailIsVerified(claims.email_verified)) {
    throw new Error("OIDC token does not assert email_verified");
  }

  const emailRaw = claimString(claims, settings.emailClaim);
  if (!emailRaw) {
    throw new Error(`OIDC token is missing ${settings.emailClaim} claim`);
  }

  const parsedEmail = emailSchema.safeParse(emailRaw);
  if (!parsedEmail.success) {
    throw new Error(
      `OIDC ${settings.emailClaim} claim is not a valid email address`,
    );
  }
  const email = parsedEmail.data;

  const parsedName = displayNameSchema.safeParse(
    claimString(claims, settings.nameClaim) ?? "",
  );

  return {
    issuer,
    subject,
    email,
    name: parsedName.success ? parsedName.data : displayNameFromEmail(email),
  };
}

export async function createOidcProvider(
  settings: OidcSettings,
): Promise<OidcProvider | null> {
  if (!settings.enabled) return null;

  const config = await openid.discovery(
    new URL(settings.issuerUrl),
    settings.clientId,
    settings.clientSecret,
  );
  const issuer = config.serverMetadata().issuer;

  return {
    settings,
    issuer,
    async buildAuthorizationUrl({ state, codeVerifier, nonce }) {
      const codeChallenge = await openid.calculatePKCECodeChallenge(codeVerifier);
      const parameters: Record<string, string> = {
        redirect_uri: settings.redirectUri,
        scope: settings.scope,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
      };
      if (nonce) {
        parameters.nonce = nonce;
      }
      return openid.buildAuthorizationUrl(config, parameters);
    },
    async exchangeCallback({
      callbackUrl,
      codeVerifier,
      expectedState,
      expectedNonce,
    }) {
      const tokens = await openid.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState,
        expectedNonce: expectedNonce ?? undefined,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims) {
        throw new Error("OIDC token response missing ID token claims");
      }
      return extractOidcClaims(
        settings,
        issuer,
        claims as unknown as Record<string, unknown>,
      );
    },
  };
}

export function createMockOidcProvider(
  settings: OidcSettings,
  handler: {
    authorizeUrl?: string;
    exchange: (callbackUrl: URL) => Promise<OidcClaims> | OidcClaims;
  },
): OidcProvider {
  if (!settings.enabled) {
    throw new Error("Mock OIDC provider requires OIDC enabled settings");
  }
  return {
    settings,
    issuer: settings.issuerUrl.replace(/\/+$/, ""),
    async buildAuthorizationUrl({ state }) {
      const url = new URL(
        handler.authorizeUrl ?? "https://idp.example.com/authorize",
      );
      url.searchParams.set("state", state);
      url.searchParams.set("redirect_uri", settings.redirectUri);
      return url;
    },
    async exchangeCallback({ callbackUrl }) {
      return handler.exchange(callbackUrl);
    },
  };
}

export const OIDC_STATE_TTL_MS = 10 * 60 * 1000;

/** One-time ticket lifetime for Android Custom Tabs → app handoff. */
export const OIDC_MOBILE_TICKET_TTL_MS = 2 * 60 * 1000;

/** Deep link the Android app registers for OIDC completion. */
export const ANDROID_OAUTH_CALLBACK_URI = "uk.co.xeiverse.genesislists://oauth-callback";


export function newOidcStateMaterials() {
  const state = openid.randomState();
  const codeVerifier = openid.randomPKCECodeVerifier();
  const nonce = openid.randomNonce();
  return { state, codeVerifier, nonce };
}
