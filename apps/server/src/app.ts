import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { createDb } from "./db/index.js";
import { registerAuth } from "./routes/auth.js";
import { registerListRoutes } from "./routes/lists.js";
import { BODY_LIMIT_BYTES, sendError } from "./util.js";

export type AppConfig = {
  databasePath: string;
  sessionSecret: string;
  cookieSecure: boolean;
  staticDir?: string;
};

async function buildFastify(config: AppConfig) {
  const db = createDb(config.databasePath);
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT_BYTES });

  app.setErrorHandler((err, _request, reply) => {
    if (reply.sent) return;
    const code = (err as { code?: string }).code;
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (code === "FST_ERR_CTP_BODY_TOO_LARGE" || statusCode === 413) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Request body too large");
    }
    if (code === "FST_ERR_CTP_EMPTY_JSON_BODY" || (statusCode !== undefined && statusCode >= 400 && statusCode < 500)) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
    }
    app.log.error?.(err);
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
