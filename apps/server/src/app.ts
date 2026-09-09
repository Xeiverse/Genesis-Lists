import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { createDb } from "./db/index.js";
import { registerAuth } from "./routes/auth.js";
import { registerListRoutes } from "./routes/lists.js";
import { sendError } from "./util.js";

export type AppConfig = {
  databasePath: string;
  sessionSecret: string;
  cookieSecure: boolean;
  staticDir?: string;
};

async function buildFastify(config: AppConfig) {
  const db = createDb(config.databasePath);
  const app = Fastify({ logger: false });

  app.setErrorHandler((err, _request, reply) => {
    app.log.error?.(err);
    if (reply.sent) return;
    return sendError(reply, 500, "INTERNAL_ERROR", "Internal server error");
  });

  app.get("/api/health", async () => ({ status: "ok" as const }));

  await registerAuth(app, db, {
    cookieSecure: config.cookieSecure,
    sessionSecret: config.sessionSecret,
  });
  await registerListRoutes(app, db);

  if (config.staticDir && fs.existsSync(config.staticDir)) {
    await app.register(fastifyStatic, {
      root: path.resolve(config.staticDir),
      wildcard: false,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return sendError(reply, 404, "NOT_FOUND", "Not found");
      }
      return reply.sendFile("index.html");
    });
  }

  return { app, db };
}

export async function buildApp(config: AppConfig) {
  const { app, db } = await buildFastify(config);
  app.addHook("onClose", async () => {
    db.close();
  });
  return app;
}
