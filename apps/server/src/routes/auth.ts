import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import argon2 from "argon2";
import {
  authCredentialsSchema,
  changePasswordSchema,
  displayNameFromEmail,
  registerSchema,
  updateProfileSchema,
  type AuthProvider,
  type UserDto,
} from "@genesis-lists/shared";
import { isUniqueViolation, type Db, type UserRow } from "../db/index.js";
import {
  OIDC_STATE_TTL_MS,
  newOidcStateMaterials,
  type OidcClaims,
  type OidcProvider,
  type OidcSettings,
} from "../oidc.js";
import {
  OIDC_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_DAYS,
  nowIso,
  sendError,
  uuid,
  type RegistrationMode,
} from "../util.js";

function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d.toISOString();
}

function oidcStateExpiry() {
  return new Date(Date.now() + OIDC_STATE_TTL_MS).toISOString();
}

function validationDetail(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return (
    error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ") || "Invalid request body"
  );
}

function disabledOidcSettings(): OidcSettings {
  return {
    enabled: false,
    issuerUrl: "",
    clientId: "",
    clientSecret: "",
    scope: "openid profile email",
    buttonText: "Sign in with OIDC",
    autoRegister: true,
    autoLaunch: false,
    emailClaim: "email",
    nameClaim: "name",
    disablePasswordLogin: false,
    redirectUri: "",
  };
}

export async function registerAuth(
  app: FastifyInstance,
  db: Db,
  opts: {
    cookieSecure: boolean;
    sessionSecret: string;
    registrationMode: RegistrationMode;
    oidc?: OidcProvider | null;
  },
) {
  const oidc = opts.oidc ?? null;
  const oidcSettings = oidc?.settings ?? disabledOidcSettings();

  function registrationOpen() {
    if (oidcSettings.disablePasswordLogin) return false;
    if (opts.registrationMode === "open") return true;
    if (opts.registrationMode === "closed") return false;
    const row = db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as {
      n: number | bigint;
    };
    return Number(row.n) === 0;
  }

  function passwordLoginEnabled() {
    return !oidcSettings.disablePasswordLogin;
  }

  function toUserDto(userId: string): UserDto | null {
    const row = db
      .prepare(`SELECT id, email, name, password_hash FROM users WHERE id = ?`)
      .get(userId) as
      | {
          id: string;
          email: string;
          name: string;
          password_hash: string | null;
        }
      | undefined;
    if (!row) return null;

    const hasOidc = db
      .prepare(`SELECT 1 AS ok FROM user_identities WHERE user_id = ? LIMIT 1`)
      .get(userId) as { ok: number } | undefined;

    const authProviders: AuthProvider[] = [];
    if (row.password_hash) authProviders.push("local");
    if (hasOidc) authProviders.push("oidc");
    if (authProviders.length === 0) authProviders.push("local");

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      authProviders,
    };
  }

  await app.register(cookie, {
    secret: opts.sessionSecret,
  });

  app.decorateRequest("user", undefined);

  function readSessionId(request: FastifyRequest) {
    const raw = request.cookies[SESSION_COOKIE];
    if (!raw) return undefined;
    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return undefined;
    return unsigned.value;
  }

  app.addHook("preHandler", async (request) => {
    const sessionId = readSessionId(request);
    if (!sessionId) return;

    const row = db
      .prepare(
        `SELECT u.id AS id, u.email AS email, u.name AS name
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > ?`,
      )
      .get(sessionId, nowIso()) as
      | { id: string; email: string; name: string }
      | undefined;

    if (row) {
      request.user = { id: row.id, email: row.email, name: row.name };
    }
  });

  function setSessionCookie(reply: FastifyReply, sessionId: string) {
    reply.setCookie(SESSION_COOKIE, sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: opts.cookieSecure,
      signed: true,
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
  }

  function clearSessionCookie(reply: FastifyReply) {
    reply.clearCookie(SESSION_COOKIE, { path: "/", signed: true });
  }

  function setOidcStateCookie(reply: FastifyReply, state: string) {
    reply.setCookie(OIDC_STATE_COOKIE, state, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: opts.cookieSecure,
      signed: true,
      maxAge: Math.floor(OIDC_STATE_TTL_MS / 1000),
    });
  }

  function clearOidcStateCookie(reply: FastifyReply) {
    reply.clearCookie(OIDC_STATE_COOKIE, { path: "/", signed: true });
  }

  function readOidcStateCookie(request: FastifyRequest) {
    const raw = request.cookies[OIDC_STATE_COOKIE];
    if (!raw) return undefined;
    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return undefined;
    return unsigned.value;
  }

  function pruneOidcLoginStates() {
    db.prepare(`DELETE FROM oidc_login_states WHERE expires_at <= ?`).run(nowIso());
  }

  function createSession(userId: string) {
    const id = uuid();
    db.prepare(
      `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    ).run(id, userId, sessionExpiry(), nowIso());
    return id;
  }

  function findUserIdByEmail(email: string): string | undefined {
    const row = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as
      | { id: string }
      | undefined;
    return row?.id;
  }

  function resolveUserFromOidcClaims(claims: OidcClaims): { userId: string } {
    const existingIdentity = db
      .prepare(
        `SELECT user_id FROM user_identities WHERE issuer = ? AND subject = ?`,
      )
      .get(claims.issuer, claims.subject) as { user_id: string } | undefined;

    if (existingIdentity) {
      // Follow an address change at the IdP, unless it collides with another
      // account: silently merging two accounts would hand one user the other's data.
      const holder = findUserIdByEmail(claims.email);
      if (!holder) {
        db.prepare(`UPDATE users SET email = ? WHERE id = ?`).run(
          claims.email,
          existingIdentity.user_id,
        );
      } else if (holder !== existingIdentity.user_id) {
        throw new Error("OIDC_EMAIL_TAKEN");
      }
      return { userId: existingIdentity.user_id };
    }

    // Links an account created before the IdP was connected (ADR 0006).
    const byEmail = findUserIdByEmail(claims.email);

    if (byEmail) {
      db.prepare(
        `INSERT INTO user_identities (id, user_id, issuer, subject, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(uuid(), byEmail, claims.issuer, claims.subject, nowIso());
      return { userId: byEmail };
    }

    if (!oidcSettings.autoRegister) {
      throw new Error("OIDC_AUTO_REGISTER_DISABLED");
    }

    const userId = uuid();
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, created_at)
       VALUES (?, ?, ?, NULL, ?)`,
    ).run(userId, claims.email, claims.name, nowIso());
    db.prepare(
      `INSERT INTO user_identities (id, user_id, issuer, subject, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(uuid(), userId, claims.issuer, claims.subject, nowIso());
    return { userId };
  }

  app.get("/api/auth/registration", async () => ({
    open: registrationOpen(),
  }));

  app.get("/api/auth/config", async () => ({
    registrationOpen: registrationOpen(),
    passwordLoginEnabled: passwordLoginEnabled(),
    oidc: {
      enabled: oidcSettings.enabled,
      buttonText: oidcSettings.buttonText,
      autoLaunch: oidcSettings.autoLaunch,
    },
  }));

  app.post("/api/auth/register", async (request, reply) => {
    if (!passwordLoginEnabled()) {
      return sendError(reply, 403, "FORBIDDEN", "Password registration is disabled");
    }
    if (!registrationOpen()) {
      return sendError(reply, 403, "FORBIDDEN", "Registration is closed");
    }

    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", validationDetail(parsed.error));
    }

    const { email, password } = parsed.data;
    if (findUserIdByEmail(email)) {
      return sendError(reply, 409, "CONFLICT", "Email already registered");
    }

    const id = uuid();
    const name = parsed.data.name ?? displayNameFromEmail(email);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const createdAt = nowIso();

    try {
      db.prepare(
        `INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
      ).run(id, email, name, passwordHash, createdAt);
    } catch (err) {
      // Hashing the password yields the event loop, so a concurrent request can
      // take the address between the check above and this insert.
      if (isUniqueViolation(err)) {
        return sendError(reply, 409, "CONFLICT", "Email already registered");
      }
      throw err;
    }

    const sessionId = createSession(id);
    setSessionCookie(reply, sessionId);

    const user = toUserDto(id)!;
    return reply.status(201).send(user);
  });

  app.post("/api/auth/login", async (request, reply) => {
    if (!passwordLoginEnabled()) {
      return sendError(reply, 403, "FORBIDDEN", "Password login is disabled");
    }

    const parsed = authCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", validationDetail(parsed.error));
    }

    const { email, password } = parsed.data;
    const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as
      | UserRow
      | undefined;
    if (!row || !row.password_hash) {
      return sendError(reply, 401, "UNAUTHORIZED", "Invalid email or password");
    }

    const ok = await argon2.verify(row.password_hash, password);
    if (!ok) {
      return sendError(reply, 401, "UNAUTHORIZED", "Invalid email or password");
    }

    const sessionId = createSession(row.id);
    setSessionCookie(reply, sessionId);

    return reply.send(toUserDto(row.id)!);
  });

  app.get("/api/auth/oidc/start", async (_request, reply) => {
    if (!oidc || !oidcSettings.enabled) {
      return sendError(reply, 404, "NOT_FOUND", "OIDC is not enabled");
    }

    try {
      pruneOidcLoginStates();
      const { state, codeVerifier, nonce } = newOidcStateMaterials();
      db.prepare(
        `INSERT INTO oidc_login_states (state, code_verifier, nonce, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(state, codeVerifier, nonce, oidcStateExpiry(), nowIso());

      const url = await oidc.buildAuthorizationUrl({
        state,
        codeVerifier,
        nonce,
      });
      setOidcStateCookie(reply, state);
      return reply.redirect(url.href);
    } catch (err) {
      app.log.error?.(err);
      return sendError(
        reply,
        503,
        "INTERNAL_ERROR",
        "OIDC authorization is temporarily unavailable",
      );
    }
  });

  app.get("/api/auth/oidc/callback", async (request, reply) => {
    const failRedirect = () => {
      clearOidcStateCookie(reply);
      return reply.redirect("/login?error=oidc");
    };

    if (!oidc || !oidcSettings.enabled) {
      return failRedirect();
    }

    pruneOidcLoginStates();

    const query = request.query as Record<string, string | undefined>;
    const state = query.state;
    const cookieState = readOidcStateCookie(request);

    if (query.error) {
      if (state) {
        db.prepare(`DELETE FROM oidc_login_states WHERE state = ?`).run(state);
      }
      return failRedirect();
    }

    if (!state || !cookieState || state !== cookieState) {
      if (state) {
        db.prepare(`DELETE FROM oidc_login_states WHERE state = ?`).run(state);
      }
      return failRedirect();
    }

    const stored = db
      .prepare(
        `SELECT state, code_verifier, nonce, expires_at FROM oidc_login_states WHERE state = ?`,
      )
      .get(state) as
      | {
          state: string;
          code_verifier: string;
          nonce: string | null;
          expires_at: string;
        }
      | undefined;

    db.prepare(`DELETE FROM oidc_login_states WHERE state = ?`).run(state);

    if (!stored || stored.expires_at <= nowIso()) {
      return failRedirect();
    }

    try {
      const callbackUrl = new URL(oidcSettings.redirectUri);
      for (const [key, value] of Object.entries(query)) {
        if (value != null) callbackUrl.searchParams.set(key, value);
      }

      const claims = await oidc.exchangeCallback({
        callbackUrl,
        codeVerifier: stored.code_verifier,
        expectedState: stored.state,
        expectedNonce: stored.nonce,
      });

      const { userId } = resolveUserFromOidcClaims(claims);
      const sessionId = createSession(userId);
      clearOidcStateCookie(reply);
      setSessionCookie(reply, sessionId);
      return reply.redirect("/");
    } catch (err) {
      app.log.error?.(err);
      return failRedirect();
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }
    const sessionId = readSessionId(request);
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
    const user = toUserDto(request.user.id);
    if (!user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }
    return reply.send(user);
  });

  app.patch("/api/auth/me", async (request, reply) => {
    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", validationDetail(parsed.error));
    }

    db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(
      parsed.data.name,
      request.user.id,
    );

    const user = toUserDto(request.user.id);
    if (!user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }
    return reply.send(user);
  });

  app.post("/api/auth/change-password", async (request, reply) => {
    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const { currentPassword, newPassword } = parsed.data;
    const row = db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(request.user.id) as UserRow | undefined;
    if (!row) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }
    if (!row.password_hash) {
      return sendError(
        reply,
        403,
        "FORBIDDEN",
        "Password change is not available for this account",
      );
    }

    const ok = await argon2.verify(row.password_hash, currentPassword);
    if (!ok) {
      return sendError(reply, 401, "UNAUTHORIZED", "Current password is incorrect");
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
      passwordHash,
      request.user.id,
    );

    const sessionId = readSessionId(request);
    if (sessionId) {
      db.prepare(`DELETE FROM sessions WHERE user_id = ? AND id != ?`).run(
        request.user.id,
        sessionId,
      );
    } else {
      db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(request.user.id);
    }

    return reply.status(204).send();
  });
}
