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
