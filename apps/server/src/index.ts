import path from "node:path";
import { buildApp } from "./app.js";
import { resolveSessionSecret } from "./util.js";

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

const staticDir =
  process.env.STATIC_DIR ??
  path.join(process.cwd(), "..", "web", "dist");

const app = await buildApp({
  databasePath,
  sessionSecret,
  cookieSecure,
  staticDir: process.env.NODE_ENV === "production" ? staticDir : undefined,
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`Genesis Lists API listening on :${port}`);
