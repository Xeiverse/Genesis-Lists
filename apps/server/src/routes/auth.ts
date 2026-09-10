import type { FastifyInstance, FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import argon2 from "argon2";
import {
  authCredentialsSchema,
  type UserDto,
} from "@genesis-lists/shared";
import type { Db, UserRow } from "../db/index.js";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  nowIso,
  sendError,
  uuid,
} from "../util.js";

function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d.toISOString();
}

export async function registerAuth(
  app: FastifyInstance,
  db: Db,
  opts: { cookieSecure: boolean; sessionSecret: string },
) {
  await app.register(cookie, {
    secret: opts.sessionSecret,
  });

  app.decorateRequest("user", undefined);

  app.addHook("preHandler", async (request) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (!sessionId) return;

    const row = db
      .prepare(
        `SELECT u.id AS id, u.username AS username
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > ?`,
      )
      .get(sessionId, nowIso()) as { id: string; username: string } | undefined;

    if (row) {
      request.user = { id: row.id, username: row.username };
    }
  });

  function setSessionCookie(reply: FastifyReply, sessionId: string) {
    reply.setCookie(SESSION_COOKIE, sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: opts.cookieSecure,
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
  }

  function clearSessionCookie(reply: FastifyReply) {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  function createSession(userId: string) {
    const id = uuid();
    db.prepare(
      `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    ).run(id, userId, sessionExpiry(), nowIso());
    return id;
  }

  app.post("/api/auth/register", async (request, reply) => {
    const parsed = authCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      return sendError(reply, 400, "VALIDATION_ERROR", detail || "Invalid request body");
    }

    const { username, password } = parsed.data;
    const existing = db
      .prepare(`SELECT id FROM users WHERE username = ?`)
      .get(username);
    if (existing) {
      return sendError(reply, 409, "CONFLICT", "Username already taken");
    }

    const id = uuid();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const createdAt = nowIso();

    db.prepare(
      `INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`,
    ).run(id, username, passwordHash, createdAt);

    const sessionId = createSession(id);
    setSessionCookie(reply, sessionId);

    const user: UserDto = { id, username };
    return reply.status(201).send(user);
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = authCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      return sendError(reply, 400, "VALIDATION_ERROR", detail || "Invalid request body");
    }

    const { username, password } = parsed.data;
    const row = db
      .prepare(`SELECT * FROM users WHERE username = ?`)
      .get(username) as UserRow | undefined;
    if (!row) {
      return sendError(reply, 401, "UNAUTHORIZED", "Invalid username or password");
    }

    const ok = await argon2.verify(row.password_hash, password);
    if (!ok) {
      return sendError(reply, 401, "UNAUTHORIZED", "Invalid username or password");
    }

    const sessionId = createSession(row.id);
    setSessionCookie(reply, sessionId);

    const user: UserDto = { id: row.id, username: row.username };
    return reply.send(user);
  });

  app.post("/api/auth/logout", async (request, reply) => {
    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
    }
    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  app.get("/api/auth/me", async (request, reply) => {
    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }
    const user: UserDto = {
      id: request.user.id,
      username: request.user.username,
    };
    return reply.send(user);
  });
}
