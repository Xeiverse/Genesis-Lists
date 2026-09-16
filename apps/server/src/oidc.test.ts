import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractOidcClaims, resolveOidcSettingsFromEnv } from "./oidc.js";

const issuer = "https://idp.example.com/application/o/genesis";

function settings(overrides: Partial<ReturnType<typeof resolveOidcSettingsFromEnv>> = {}) {
  return {
    ...resolveOidcSettingsFromEnv({} as NodeJS.ProcessEnv),
    enabled: true,
    ...overrides,
  };
}

describe("resolveOidcSettingsFromEnv", () => {
  it("defaults the claim names", () => {
    const resolved = resolveOidcSettingsFromEnv({} as NodeJS.ProcessEnv);
    assert.equal(resolved.emailClaim, "email");
    assert.equal(resolved.nameClaim, "name");
  });

  it("allows the claim names to be overridden", () => {
    const resolved = resolveOidcSettingsFromEnv({
      OIDC_EMAIL_CLAIM: " mail ",
      OIDC_NAME_CLAIM: "display_name",
    } as NodeJS.ProcessEnv);
    assert.equal(resolved.emailClaim, "mail");
    assert.equal(resolved.nameClaim, "display_name");
  });
});

describe("extractOidcClaims", () => {
  it("normalizes the email and takes the name claim", () => {
    const claims = extractOidcClaims(settings(), issuer, {
      sub: "sub-1",
      email: "  Alice@Example.COM ",
      name: "Alice Example",
    });
    assert.deepEqual(claims, {
      issuer,
      subject: "sub-1",
      email: "alice@example.com",
      name: "Alice Example",
    });
  });

  it("falls back to the email local part when the name claim is absent", () => {
    const claims = extractOidcClaims(settings(), issuer, {
      sub: "sub-1",
      email: "alice@example.com",
    });
    assert.equal(claims.name, "alice");
  });

  it("reads the configured claim names", () => {
    const claims = extractOidcClaims(
      settings({ emailClaim: "mail", nameClaim: "display_name" }),
      issuer,
      { sub: "sub-1", mail: "bob@example.com", display_name: "Bob" },
    );
    assert.equal(claims.email, "bob@example.com");
    assert.equal(claims.name, "Bob");
  });

  it("rejects a missing email claim", () => {
    assert.throws(
      () => extractOidcClaims(settings(), issuer, { sub: "sub-1", name: "Alice" }),
      /missing email claim/,
    );
  });

  it("rejects a malformed email claim", () => {
    assert.throws(
      () =>
        extractOidcClaims(settings(), issuer, {
          sub: "sub-1",
          email: "not-an-address",
        }),
      /not a valid email address/,
    );
  });

  it("rejects an unverified email", () => {
    assert.throws(
      () =>
        extractOidcClaims(settings(), issuer, {
          sub: "sub-1",
          email: "alice@example.com",
          email_verified: false,
        }),
      /email_verified/,
    );
  });

  it("accepts an absent email_verified claim", () => {
    const claims = extractOidcClaims(settings(), issuer, {
      sub: "sub-1",
      email: "alice@example.com",
    });
    assert.equal(claims.email, "alice@example.com");
  });

  it("rejects a missing sub claim", () => {
    assert.throws(
      () => extractOidcClaims(settings(), issuer, { email: "alice@example.com" }),
      /missing sub claim/,
    );
  });
});
