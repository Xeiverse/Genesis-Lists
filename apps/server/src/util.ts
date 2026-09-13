import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiErrorBody, ErrorCode } from "@genesis-lists/shared";

export function sendError(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  message: string,
) {
  const body: ApiErrorBody = { error: { code, message } };
  return reply.status(status).send(body);
}

export const SESSION_COOKIE = "genesis_session";
export const SESSION_DAYS = 30;
export const BODY_LIMIT_BYTES = 16 * 1024;
export const DEV_SESSION_SECRET = "dev-insecure-session-secret-change-me";
export const MIN_SESSION_SECRET_LENGTH = 32;

const WEAK_SESSION_SECRETS = new Set([
  DEV_SESSION_SECRET,
  "change-me",
  "change-me-to-a-long-random-string",
  "replace-with-long-random-value",
  "secret",
]);

function isWeakSessionSecret(secret: string): boolean {
  return (
    WEAK_SESSION_SECRETS.has(secret) || secret.length < MIN_SESSION_SECRET_LENGTH
  );
}

export function resolveSessionSecret(opts: {
  sessionSecret: string | undefined;
  cookieSecure: boolean;
}): string {
  const trimmed = opts.sessionSecret?.trim();
  const secret = trimmed || DEV_SESSION_SECRET;
  const weak = !trimmed || isWeakSessionSecret(secret);

  if (opts.cookieSecure && weak) {
    throw new Error(
      `SESSION_SECRET is required when COOKIE_SECURE=true. Use at least ${MIN_SESSION_SECRET_LENGTH} random characters; do not use a placeholder.`,
    );
  }

  if (weak) {
    console.warn(
      "Warning: using a weak or default SESSION_SECRET. Set a strong secret before exposing this instance.",
    );
  }

  return secret;
}

export type AuthUser = { id: string; username: string };

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function uuid() {
  return crypto.randomUUID();
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
  }
  return request.user;
}
