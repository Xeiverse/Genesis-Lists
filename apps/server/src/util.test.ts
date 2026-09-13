import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEV_SESSION_SECRET,
  MIN_SESSION_SECRET_LENGTH,
  resolveRegistrationMode,
  resolveSessionSecret,
} from "./util.js";

const strong = "a".repeat(MIN_SESSION_SECRET_LENGTH);

describe("resolveSessionSecret", () => {
  it("allows placeholders when COOKIE_SECURE is false", () => {
    const secret = resolveSessionSecret({
      sessionSecret: DEV_SESSION_SECRET,
      cookieSecure: false,
    });
    assert.equal(secret, DEV_SESSION_SECRET);
  });

  it("rejects placeholders when COOKIE_SECURE is true", () => {
    assert.throws(
      () =>
        resolveSessionSecret({
          sessionSecret: "secret",
          cookieSecure: true,
        }),
      /SESSION_SECRET is required/,
    );
    assert.throws(
      () =>
        resolveSessionSecret({
          sessionSecret: "replace-with-long-random-value",
          cookieSecure: true,
        }),
      /SESSION_SECRET is required/,
    );
  });

  it("rejects short secrets when COOKIE_SECURE is true", () => {
    assert.throws(
      () =>
        resolveSessionSecret({
          sessionSecret: "not-a-placeholder-but-short",
          cookieSecure: true,
        }),
      /SESSION_SECRET is required/,
    );
  });

  it("accepts a long secret when COOKIE_SECURE is true", () => {
    assert.equal(
      resolveSessionSecret({ sessionSecret: strong, cookieSecure: true }),
      strong,
    );
  });
});

describe("resolveRegistrationMode", () => {
  it("treats unset, empty, and bootstrap as first-run bootstrap", () => {
    assert.equal(resolveRegistrationMode(undefined), "bootstrap");
    assert.equal(resolveRegistrationMode(""), "bootstrap");
    assert.equal(resolveRegistrationMode("bootstrap"), "bootstrap");
  });

  it("accepts true and false", () => {
    assert.equal(resolveRegistrationMode("true"), "open");
    assert.equal(resolveRegistrationMode("false"), "closed");
  });

  it("rejects unknown values", () => {
    assert.throws(() => resolveRegistrationMode("yes"), /ALLOW_REGISTRATION/);
  });
});
