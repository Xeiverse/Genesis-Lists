import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

function getCookie(res: { headers: Record<string, unknown> }) {
  const raw = res.headers["set-cookie"];
  if (!raw) return undefined;
  const first = Array.isArray(raw) ? raw[0] : String(raw);
  return first.split(";")[0];
}

describe("Genesis Lists API contract", async () => {
  let app: FastifyInstance;
  let dbPath: string;
  let cookieA = "";
  let cookieB = "";
  let listId = "";
  let itemId = "";

  before(async () => {
    dbPath = path.join(os.tmpdir(), `genesis-test-${Date.now()}.db`);
    app = await buildApp({
      databasePath: dbPath,
      sessionSecret: "test-secret",
      cookieSecure: false,
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = dbPath + suffix;
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // Windows may briefly keep handles; ignore cleanup errors
      }
    }
  });

  await it("GET /api/health", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: "ok" });
  });

  await it("register alice", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "alice", password: "password1" },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.username, "alice");
    assert.ok(body.id);
    cookieA = getCookie(res)!;
    assert.ok(cookieA.includes("genesis_session="));
  });

  await it("duplicate username conflicts", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "alice", password: "password1" },
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error.code, "CONFLICT");
  });

  await it("register bob", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "bob", password: "password1" },
    });
    assert.equal(res.statusCode, 201);
    cookieB = getCookie(res)!;
  });

  await it("GET /api/auth/me", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().username, "alice");
  });

  await it("create and list lists", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/lists",
      headers: { cookie: cookieA },
      payload: { name: "Groceries" },
    });
    assert.equal(create.statusCode, 201);
    listId = create.json().id;
    assert.deepEqual(create.json().previewItems, []);
    assert.equal(create.json().itemCount, 0);

    const list = await app.inject({
      method: "GET",
      url: "/api/lists",
      headers: { cookie: cookieA },
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().lists.length, 1);
    assert.equal(list.json().lists[0].name, "Groceries");
    assert.deepEqual(list.json().lists[0].previewItems, []);
    assert.equal(list.json().lists[0].itemCount, 0);
  });

  await it("bob cannot see alice lists", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/lists",
      headers: { cookie: cookieB },
    });
    assert.equal(res.json().lists.length, 0);
  });

  await it("rename list", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/lists/${listId}`,
      headers: { cookie: cookieA },
      payload: { name: "Weekly shop" },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().name, "Weekly shop");
  });

  await it("add edit toggle delete items", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/api/lists/${listId}/items`,
      headers: { cookie: cookieA },
      payload: { text: "Milk" },
    });
    assert.equal(create.statusCode, 201);
    itemId = create.json().id;
    assert.equal(create.json().checked, false);

    const listed = await app.inject({
      method: "GET",
      url: "/api/lists",
      headers: { cookie: cookieA },
    });
    assert.equal(listed.json().lists[0].itemCount, 1);
    assert.deepEqual(listed.json().lists[0].previewItems, [
      { text: "Milk", checked: false },
    ]);

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/items/${itemId}`,
      headers: { cookie: cookieA },
      payload: { text: "Oat milk", checked: true },
    });
    assert.equal(patch.statusCode, 200);
    assert.equal(patch.json().text, "Oat milk");
    assert.equal(patch.json().checked, true);

    const items = await app.inject({
      method: "GET",
      url: `/api/lists/${listId}/items`,
      headers: { cookie: cookieA },
    });
    assert.equal(items.json().items.length, 1);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/items/${itemId}`,
      headers: { cookie: cookieA },
    });
    assert.equal(del.statusCode, 204);
  });

  await it("bob gets 404 on alice list", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/lists/${listId}/items`,
      headers: { cookie: cookieB },
    });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, "NOT_FOUND");
  });

  await it("delete list", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/lists/${listId}`,
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 204);
  });

  await it("logout", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 204);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: cookieA },
    });
    assert.equal(me.statusCode, 401);
  });

  await it("login works", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "bob", password: "password1" },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().username, "bob");
    cookieB = getCookie(res)!;
  });

  await it("change password", async () => {
    const bad = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: cookieB },
      payload: { currentPassword: "wrongpass", newPassword: "password2" },
    });
    assert.equal(bad.statusCode, 401);

    const ok = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: cookieB },
      payload: { currentPassword: "password1", newPassword: "password2" },
    });
    assert.equal(ok.statusCode, 204);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "bob", password: "password1" },
    });
    assert.equal(oldLogin.statusCode, 401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "bob", password: "password2" },
    });
    assert.equal(newLogin.statusCode, 200);
  });

  await it("bad login", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "bob", password: "wrongpass" },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, "UNAUTHORIZED");
  });
});
