import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import {
  authCredentialsSchema,
  changePasswordSchema,
  createApiTokenSchema,
  displayNameFromEmail,
  registerSchema,
  updateProfileSchema,
  type ApiTokenDto,
  type AuthProvider,
  type CreatedApiTokenDto,
  type UserDto,
} from "@genesis-lists/shared";
import { isUniqueViolation, type Db, type UserRow } from "../db/index.js";
import {
  OIDC_STATE_TTL_MS,
  OIDC_MOBILE_TICKET_TTL_MS,
  ANDROID_OAUTH_CALLBACK_URI,
  OidcLoginError,
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
  pathAllowsBearerAuth,
  requireSessionUser,
  sendError,
  uuid,
  type RegistrationMode,
} from "../util.js";
import { z } from "zod";

/** Prefix for personal access tokens (plaintext shown once on create). */
const API_TOKEN_PREFIX = "gls_";

function hashApiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function generateApiToken(): string {
  return `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

function toApiTokenDto(row: {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}): ApiTokenDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d.toISOString();
}

function oidcStateExpiry() {
  return new Date(Date.now() + OIDC_STATE_TTL_MS).toISOString();
}

function oidcMobileTicketExpiry() {
  return new Date(Date.now() + OIDC_MOBILE_TICKET_TTL_MS).toISOString();
}

const mobileExchangeSchema = z.object({
  ticket: z.string().trim().min(1).max(128),
});


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
    buttonText: "Login with OAuth",
    autoRegister: true,
    autoLaunch: false,
    emailClaim: "email",
    nameClaim: "name",
    disablePasswordLogin: false,
    requireEmailVerified: true,
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

  function readBearerToken(request: FastifyRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    if (!match) return undefined;
    return match[1];
  }

  app.addHook("preHandler", async (request) => {
    const sessionId = readSessionId(request);
    if (sessionId) {
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
        request.authMethod = "session";
        return;
      }
    }

    // PATs authenticate list/item APIs only — not account, directory, or token CRUD.
    if (!pathAllowsBearerAuth(request.url)) return;

    const bearer = readBearerToken(request);
    if (!bearer || !bearer.startsWith(API_TOKEN_PREFIX)) return;

    const tokenHash = hashApiToken(bearer);
    const row = db
      .prepare(
        `SELECT t.id AS token_id, u.id AS id, u.email AS email, u.name AS name
         FROM api_tokens t
         INNER JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ?`,
      )
      .get(tokenHash) as
      | { token_id: string; id: string; email: string; name: string }
      | undefined;

    if (!row) return;

    const usedAt = nowIso();
    db.prepare(`UPDATE api_tokens SET last_used_at = ? WHERE id = ?`).run(
      usedAt,
      row.token_id,
    );
    request.user = { id: row.id, email: row.email, name: row.name };
    request.authMethod = "bearer";
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
    db.prepare(`DELETE FROM oidc_mobile_tickets WHERE expires_at <= ?`).run(nowIso());
  }

  function androidHandoffPath(query: Record<string, string>) {
    const params = new URLSearchParams(query);
    return `/api/auth/oidc/android-handoff?${params.toString()}`;
  }

  function androidAppDeepLink(query: Record<string, string>) {
    const url = new URL(ANDROID_OAUTH_CALLBACK_URI);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    return url.href;
  }

  function androidOidcStartHtml(idpUrl: string) {
    const escapedHref = idpUrl
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const escapedJs = idpUrl
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Continue sign-in</title>
  <meta http-equiv="refresh" content="0;url=${escapedHref}"/>
  <script>location.replace('${escapedJs}');</script>
</head>
<body>
  <p><a href="${escapedHref}">Continue to sign-in</a></p>
</body>
</html>`;
  }

  function androidHandoffHtml(deepLink: string) {
    const escapedHref = deepLink
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const escapedJs = deepLink
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Open Genesis Lists</title>
  <meta http-equiv="refresh" content="0;url=${escapedHref}"/>
  <script>location.replace('${escapedJs}');</script>
</head>
<body>
  <p><a href="${escapedHref}">Open Genesis Lists</a></p>
</body>
</html>`;
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
        throw new OidcLoginError("email_taken", "OIDC_EMAIL_TAKEN");
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
      throw new OidcLoginError(
        "auto_register_disabled",
        "OIDC_AUTO_REGISTER_DISABLED",
      );
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
      mobileLogin: true,
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

  app.get("/api/auth/oidc/start", async (request, reply) => {
    if (!oidc || !oidcSettings.enabled) {
      return sendError(reply, 404, "NOT_FOUND", "OIDC is not enabled");
    }

    const query = request.query as Record<string, string | undefined>;
    const clientRaw = (query.client ?? "").trim().toLowerCase();
    const client = clientRaw === "android" ? "android" : null;

    try {
      pruneOidcLoginStates();
      const { state, codeVerifier, nonce } = newOidcStateMaterials();
      db.prepare(
        `INSERT INTO oidc_login_states (state, code_verifier, nonce, client, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(state, codeVerifier, nonce, client, oidcStateExpiry(), nowIso());

      const url = await oidc.buildAuthorizationUrl({
        state,
        codeVerifier,
        nonce,
      });
      setOidcStateCookie(reply, state);
      // Custom Tabs drop Set-Cookie on a 302 that immediately leaves the site
      // (bounce tracking). A document response lets genesis_oidc_state stick
      // before navigating to the IdP, so callback CSRF still binds the agent.
      if (client === "android") {
        return reply
          .type("text/html; charset=utf-8")
          .header("Cache-Control", "no-store")
          .send(androidOidcStartHtml(url.href));
      }
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
    pruneOidcLoginStates();

    const query = request.query as Record<string, string | undefined>;
    const state = query.state;
    const cookieState = readOidcStateCookie(request);

    let androidClient = false;
    if (state) {
      const peek = db
        .prepare(`SELECT client FROM oidc_login_states WHERE state = ?`)
        .get(state) as { client: string | null } | undefined;
      androidClient = peek?.client === "android";
    }

    const failRedirect = (reason: string) => {
      clearOidcStateCookie(reply);
      if (androidClient) {
        return reply.redirect(androidHandoffPath({ error: "oidc", reason }));
      }
      const login = new URLSearchParams({ error: "oidc", reason });
      return reply.redirect(`/login?${login.toString()}`);
    };

    if (!oidc || !oidcSettings.enabled) {
      return failRedirect("oidc_disabled");
    }

    if (query.error) {
      if (state) {
        db.prepare(`DELETE FROM oidc_login_states WHERE state = ?`).run(state);
      }
      return failRedirect("idp_error");
    }

    if (!state) {
      return failRedirect("missing_state");
    }
    if (!cookieState) {
      db.prepare(`DELETE FROM oidc_login_states WHERE state = ?`).run(state);
      return failRedirect("missing_state_cookie");
    }
    if (state !== cookieState) {
      db.prepare(`DELETE FROM oidc_login_states WHERE state = ?`).run(state);
      return failRedirect("state_cookie_mismatch");
    }

    const stored = db
      .prepare(
        `SELECT state, code_verifier, nonce, client, expires_at FROM oidc_login_states WHERE state = ?`,
      )
      .get(state) as
      | {
          state: string;
          code_verifier: string;
          nonce: string | null;
          client: string | null;
          expires_at: string;
        }
      | undefined;

    db.prepare(`DELETE FROM oidc_login_states WHERE state = ?`).run(state);
    androidClient = stored?.client === "android";

    if (!stored || stored.expires_at <= nowIso()) {
      return failRedirect("missing_or_expired_login_state");
    }

    try {
      const callbackUrl = new URL(oidcSettings.redirectUri);
      for (const [key, value] of Object.entries(query)) {
        const text = Array.isArray(value) ? value[0] : value;
        if (typeof text === "string") callbackUrl.searchParams.set(key, text);
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

      if (androidClient) {
        const ticket = uuid();
        db.prepare(
          `INSERT INTO oidc_mobile_tickets (ticket, session_id, expires_at, created_at)
           VALUES (?, ?, ?, ?)`,
        ).run(ticket, sessionId, oidcMobileTicketExpiry(), nowIso());
        return reply.redirect(androidHandoffPath({ ticket }));
      }

      setSessionCookie(reply, sessionId);
      return reply.redirect("/");
    } catch (err) {
      app.log.error?.(err);
      const reason =
        err instanceof OidcLoginError ? err.reason : "exchange_or_user_failed";
      return failRedirect(reason);
    }
  });

  app.get("/api/auth/oidc/android-handoff", async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const ticket = query.ticket?.trim();
    const error = query.error?.trim();

    const deepLinkQuery: Record<string, string> = {};
    if (ticket) {
      deepLinkQuery.ticket = ticket;
    } else if (error) {
      deepLinkQuery.error = error;
    } else {
      deepLinkQuery.error = "oidc";
    }
    const reason = query.reason?.trim();
    if (reason) {
      deepLinkQuery.reason = reason;
    }

    const deepLink = androidAppDeepLink(deepLinkQuery);
    return reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "no-store")
      .send(androidHandoffHtml(deepLink));
  });

  app.post("/api/auth/oidc/mobile-exchange", async (request, reply) => {
    if (!oidc || !oidcSettings.enabled) {
      return sendError(reply, 404, "NOT_FOUND", "OIDC is not enabled");
    }

    const parsed = mobileExchangeSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", validationDetail(parsed.error));
    }

    pruneOidcLoginStates();

    const ticket = parsed.data.ticket;
    const row = db
      .prepare(
        `SELECT ticket, session_id, expires_at FROM oidc_mobile_tickets WHERE ticket = ?`,
      )
      .get(ticket) as
      | { ticket: string; session_id: string; expires_at: string }
      | undefined;

    if (!row) {
      return sendError(reply, 401, "UNAUTHORIZED", "Invalid or expired ticket");
    }

    db.prepare(`DELETE FROM oidc_mobile_tickets WHERE ticket = ?`).run(ticket);

    if (row.expires_at <= nowIso()) {
      return sendError(reply, 401, "UNAUTHORIZED", "Invalid or expired ticket");
    }

    const session = db
      .prepare(`SELECT id, user_id, expires_at FROM sessions WHERE id = ?`)
      .get(row.session_id) as
      | { id: string; user_id: string; expires_at: string }
      | undefined;

    if (!session || session.expires_at <= nowIso()) {
      return sendError(reply, 401, "UNAUTHORIZED", "Invalid or expired ticket");
    }

    setSessionCookie(reply, session.id);
    const user = toUserDto(session.user_id);
    if (!user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Invalid or expired ticket");
    }
    return reply.send(user);
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const user = await requireSessionUser(request, reply);
    if (!user) return;
    const sessionId = readSessionId(request);
    if (sessionId) {
      db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
    }
    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  app.get("/api/auth/me", async (request, reply) => {
    const sessionUser = await requireSessionUser(request, reply);
    if (!sessionUser) return;
    const user = toUserDto(sessionUser.id);
    if (!user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }
    return reply.send(user);
  });

  app.patch("/api/auth/me", async (request, reply) => {
    const sessionUser = await requireSessionUser(request, reply);
    if (!sessionUser) return;

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", validationDetail(parsed.error));
    }

    db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(
      parsed.data.name,
      sessionUser.id,
    );

    const user = toUserDto(sessionUser.id);
    if (!user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }
    return reply.send(user);
  });

  app.post("/api/auth/change-password", async (request, reply) => {
    const sessionUser = await requireSessionUser(request, reply);
    if (!sessionUser) return;

    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const { currentPassword, newPassword } = parsed.data;
    const row = db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(sessionUser.id) as UserRow | undefined;
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
      sessionUser.id,
    );

    // Lockout: invalidate other sessions and revoke all PATs.
    const sessionId = readSessionId(request);
    if (sessionId) {
      db.prepare(`DELETE FROM sessions WHERE user_id = ? AND id != ?`).run(
        sessionUser.id,
        sessionId,
      );
    } else {
      db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(sessionUser.id);
    }
    db.prepare(`DELETE FROM api_tokens WHERE user_id = ?`).run(sessionUser.id);

    return reply.status(204).send();
  });

  app.get("/api/auth/tokens", async (request, reply) => {
    const user = await requireSessionUser(request, reply);
    if (!user) return;

    const rows = db
      .prepare(
        `SELECT id, name, created_at, last_used_at
         FROM api_tokens
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
      .all(user.id) as Array<{
      id: string;
      name: string;
      created_at: string;
      last_used_at: string | null;
    }>;

    return reply.send({ tokens: rows.map(toApiTokenDto) });
  });

  app.post("/api/auth/tokens", async (request, reply) => {
    const user = await requireSessionUser(request, reply);
    if (!user) return;

    const parsed = createApiTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", validationDetail(parsed.error));
    }

    const id = uuid();
    const token = generateApiToken();
    const tokenHash = hashApiToken(token);
    const createdAt = nowIso();

    db.prepare(
      `INSERT INTO api_tokens (id, user_id, name, token_hash, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    ).run(id, user.id, parsed.data.name, tokenHash, createdAt);

    const body: CreatedApiTokenDto = {
      id,
      name: parsed.data.name,
      createdAt,
      lastUsedAt: null,
      token,
    };
    return reply.status(201).send(body);
  });

  app.delete("/api/auth/tokens/:id", async (request, reply) => {
    const user = await requireSessionUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const result = db
      .prepare(`DELETE FROM api_tokens WHERE id = ? AND user_id = ?`)
      .run(id, user.id);

    if (Number(result.changes) === 0) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }
    return reply.status(204).send();
  });
}
