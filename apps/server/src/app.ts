import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { createDb, dbIsReady, getSchemaVersion } from "./db/index.js";
import { registerAuth } from "./routes/auth.js";
import { registerListRoutes } from "./routes/lists.js";
import {
  BODY_LIMIT_BYTES,
  sendError,
  type RegistrationMode,
} from "./util.js";

export type AppConfig = {
  databasePath: string;
  sessionSecret: string;
  cookieSecure: boolean;
  staticDir?: string;
  registrationMode?: RegistrationMode;
  version?: string;
};

async function buildFastify(config: AppConfig) {
  const db = createDb(config.databasePath);
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT_BYTES });

  // Empty bodies with Content-Type: application/json (common from fetch clients) must not 500.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      const text = typeof body === "string" ? body.trim() : "";
      if (!text) {
        done(null, null);
        return;
      }
      try {
        done(null, JSON.parse(text));
      } catch {
        const err = new Error("Invalid JSON body") as Error & {
          statusCode: number;
          code: string;
        };
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        done(err, undefined);
      }
    },
  );

  app.setErrorHandler((err, _request, reply) => {
    if (reply.sent) return;
    const error = err as Error & { statusCode?: number; code?: string };
    const code = error.code;
    const statusCode = error.statusCode;
    if (code === "FST_ERR_CTP_BODY_TOO_LARGE" || statusCode === 413) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Request body too large");
    }
    if (
      code === "FST_ERR_CTP_EMPTY_JSON_BODY" ||
      (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500)
    ) {
      return sendError(
        reply,
        typeof statusCode === "number" && statusCode >= 400 && statusCode < 500
          ? statusCode
          : 400,
        "VALIDATION_ERROR",
        error.message || "Invalid request body",
      );
    }
    app.log.error?.(err);
    return sendError(reply, 500, "INTERNAL_ERROR", "Internal server error");
  });

  const version = config.version ?? "0.0.0";

  app.get("/api/health", async (_request, reply) => {
    if (!dbIsReady(db)) {
      return reply.status(503).send({ status: "error" as const, version });
    }
    return {
      status: "ok" as const,
      version,
      schemaVersion: getSchemaVersion(db),
    };
  });

  await registerAuth(app, db, {
    cookieSecure: config.cookieSecure,
    sessionSecret: config.sessionSecret,
    registrationMode: config.registrationMode ?? "bootstrap",
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
