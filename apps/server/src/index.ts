import { createRequire } from "node:module";
import path from "node:path";
import { buildApp } from "./app.js";
import { createOidcProvider, resolveOidcSettingsFromEnv } from "./oidc.js";
import { resolveRegistrationMode, resolveSessionSecret } from "./util.js";

function readAppVersion() {
  const fromEnv = process.env.APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const port = Number(process.env.PORT ?? 3000);
const databasePath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "dev.db");
const cookieSecure =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";
const sessionSecret = resolveSessionSecret({
  sessionSecret: process.env.SESSION_SECRET,
  cookieSecure,
});
const registrationMode = resolveRegistrationMode(process.env.ALLOW_REGISTRATION);
if (registrationMode === "open") {
  console.warn(
    "Warning: registration is open. Anyone who can reach this server can create an account.",
  );
}

const oidcSettings = resolveOidcSettingsFromEnv(process.env);
let oidc = null;
if (oidcSettings.enabled) {
  try {
    oidc = await createOidcProvider(oidcSettings);
    console.log(`OIDC enabled (issuer discovery ok): ${oidcSettings.issuerUrl}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`OIDC startup failed: ${message}`);
    process.exit(1);
  }
}

const staticDir =
  process.env.STATIC_DIR ??
  path.join(process.cwd(), "..", "web", "dist");

const app = await buildApp({
  databasePath,
  sessionSecret,
  cookieSecure,
  registrationMode,
  version: readAppVersion(),
  staticDir: process.env.NODE_ENV === "production" ? staticDir : undefined,
  oidc,
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`Genesis Lists API listening on :${port}`);
