import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEV_SESSION_SECRET,
  MIN_SESSION_SECRET_LENGTH,
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
