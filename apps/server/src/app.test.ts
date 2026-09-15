import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { BODY_LIMIT_BYTES } from "./util.js";

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
      registrationMode: "open",
      version: "1.0.0",
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
    assert.deepEqual(res.json(), {
      status: "ok",
      version: "1.0.0",
      schemaVersion: 2,
    });
  });

  await it("unauthenticated protected routes are 401", async () => {
    const me = await app.inject({ method: "GET", url: "/api/auth/me" });
    assert.equal(me.statusCode, 401);
    assert.equal(me.json().error.code, "UNAUTHORIZED");

    const lists = await app.inject({ method: "GET", url: "/api/lists" });
    assert.equal(lists.statusCode, 401);
    assert.equal(lists.json().error.code, "UNAUTHORIZED");
  });

  await it("invalid bodies are 400 VALIDATION_ERROR", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "ab", password: "short" },
    });
    assert.equal(register.statusCode, 400);
    assert.equal(register.json().error.code, "VALIDATION_ERROR");

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "short" },
    });
    assert.equal(login.statusCode, 400);
    assert.equal(login.json().error.code, "VALIDATION_ERROR");
  });

  await it("oversize body is 400 VALIDATION_ERROR", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      headers: { "content-type": "application/json" },
      payload: { username: "alice", password: "x".repeat(BODY_LIMIT_BYTES) },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, "VALIDATION_ERROR");
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
    // Signed cookies are value.signature
    assert.match(cookieA, /^genesis_session=.+\./);
  });

  await it("create list without auth is 401; invalid name is 400", async () => {
    const unauth = await app.inject({
      method: "POST",
      url: "/api/lists",
      payload: { name: "Groceries" },
    });
    assert.equal(unauth.statusCode, 401);
    assert.equal(unauth.json().error.code, "UNAUTHORIZED");

    const invalid = await app.inject({
      method: "POST",
      url: "/api/lists",
      headers: { cookie: cookieA },
      payload: { name: "   " },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
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
    assert.equal(create.json().isOwner, true);
    assert.equal(create.json().ownerUsername, "alice");

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
    assert.equal(list.json().lists[0].isOwner, true);
    assert.equal(list.json().lists[0].ownerUsername, "alice");
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
    assert.equal(res.json().itemCount, 0);
    assert.deepEqual(res.json().previewItems, []);
  });

  await it("add edit toggle items", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/api/lists/${listId}/items`,
      headers: { cookie: cookieA },
      payload: { text: "Milk" },
    });
    assert.equal(create.statusCode, 201);
    itemId = create.json().id;
    assert.equal(create.json().checked, false);
    assert.equal(create.json().position, 0);

    const listed = await app.inject({
      method: "GET",
      url: "/api/lists",
      headers: { cookie: cookieA },
    });
    assert.equal(listed.json().lists[0].itemCount, 1);
    assert.equal(listed.json().lists[0].previewItems.length, 1);
    assert.equal(listed.json().lists[0].previewItems[0].id, itemId);
    assert.equal(listed.json().lists[0].previewItems[0].text, "Milk");
    assert.equal(listed.json().lists[0].previewItems[0].checked, false);

    const listsWithPreview = await app.inject({
      method: "GET",
      url: "/api/lists",
      headers: { cookie: cookieA },
    });
    assert.equal(listsWithPreview.statusCode, 200);
    const previewList = listsWithPreview.json().lists[0];
    assert.equal(previewList.itemCount, 1);
    assert.equal(previewList.previewItems.length, 1);
    assert.equal(previewList.previewItems[0].text, "Milk");
    assert.equal(previewList.previewItems[0].checked, false);

    const renamed = await app.inject({
      method: "PATCH",
      url: `/api/lists/${listId}`,
      headers: { cookie: cookieA },
      payload: { name: "Weekly shop" },
    });
    assert.equal(renamed.statusCode, 200);
    assert.equal(renamed.json().itemCount, 1);
    assert.equal(renamed.json().previewItems[0].text, "Milk");

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
    assert.equal(items.json().items[0].text, "Oat milk");
  });

  await it("clear checked items leaves unchecked and is idempotent", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/lists",
      headers: { cookie: cookieA },
      payload: { name: "Clear me" },
    });
    assert.equal(created.statusCode, 201);
    const clearListId = created.json().id as string;

    const milk = await app.inject({
      method: "POST",
      url: `/api/lists/${clearListId}/items`,
      headers: { cookie: cookieA },
      payload: { text: "Milk" },
    });
    const bread = await app.inject({
      method: "POST",
      url: `/api/lists/${clearListId}/items`,
      headers: { cookie: cookieA },
      payload: { text: "Bread" },
    });
    assert.equal(milk.statusCode, 201);
    assert.equal(bread.statusCode, 201);

    const tick = await app.inject({
      method: "PATCH",
      url: `/api/items/${milk.json().id}`,
      headers: { cookie: cookieA },
      payload: { checked: true },
    });
    assert.equal(tick.statusCode, 200);

    const clear = await app.inject({
      method: "DELETE",
      url: `/api/lists/${clearListId}/items/checked`,
      headers: { cookie: cookieA },
    });
    assert.equal(clear.statusCode, 204);

    const remaining = await app.inject({
      method: "GET",
      url: `/api/lists/${clearListId}/items`,
      headers: { cookie: cookieA },
    });
    assert.equal(remaining.statusCode, 200);
    assert.deepEqual(
      remaining.json().items.map((item: { text: string; checked: boolean }) => ({
        text: item.text,
        checked: item.checked,
      })),
      [{ text: "Bread", checked: false }],
    );

    const again = await app.inject({
      method: "DELETE",
      url: `/api/lists/${clearListId}/items/checked`,
      headers: { cookie: cookieA },
    });
    assert.equal(again.statusCode, 204);

    const still = await app.inject({
      method: "GET",
      url: `/api/lists/${clearListId}/items`,
      headers: { cookie: cookieA },
    });
    assert.equal(still.json().items.length, 1);

    const foreign = await app.inject({
      method: "DELETE",
      url: `/api/lists/${clearListId}/items/checked`,
      headers: { cookie: cookieB },
    });
    assert.equal(foreign.statusCode, 404);
    assert.equal(foreign.json().error.code, "NOT_FOUND");

    const missing = await app.inject({
      method: "DELETE",
      url: "/api/lists/00000000-0000-4000-8000-000000000000/items/checked",
      headers: { cookie: cookieA },
    });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "NOT_FOUND");

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/lists/${clearListId}`,
      headers: { cookie: cookieA },
    });
    assert.equal(removed.statusCode, 204);
  });

  await it("bob gets 404 on alice list and items", async () => {
    const getItems = await app.inject({
      method: "GET",
      url: `/api/lists/${listId}/items`,
      headers: { cookie: cookieB },
    });
    assert.equal(getItems.statusCode, 404);
    assert.equal(getItems.json().error.code, "NOT_FOUND");

    const patchItem = await app.inject({
      method: "PATCH",
      url: `/api/items/${itemId}`,
      headers: { cookie: cookieB },
      payload: { text: "Stolen" },
    });
    assert.equal(patchItem.statusCode, 404);
    assert.equal(patchItem.json().error.code, "NOT_FOUND");

    const deleteItem = await app.inject({
      method: "DELETE",
      url: `/api/items/${itemId}`,
      headers: { cookie: cookieB },
    });
    assert.equal(deleteItem.statusCode, 404);
    assert.equal(deleteItem.json().error.code, "NOT_FOUND");
  });

  await it("delete item", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: `/api/items/${itemId}`,
      headers: { cookie: cookieA, "content-type": "application/json" },
    });
    assert.equal(del.statusCode, 204);

    const items = await app.inject({
      method: "GET",
      url: `/api/lists/${listId}/items`,
      headers: { cookie: cookieA },
    });
    assert.equal(items.json().items.length, 0);

    const create = await app.inject({
      method: "POST",
      url: `/api/lists/${listId}/items`,
      headers: { cookie: cookieA },
      payload: { text: "Eggs" },
    });
    assert.equal(create.statusCode, 201);
    itemId = create.json().id;
  });

  await it("delete list cascades items", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/lists/${listId}`,
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 204);

    const lists = await app.inject({
      method: "GET",
      url: "/api/lists",
      headers: { cookie: cookieA },
    });
    assert.equal(lists.json().lists.length, 0);

    const items = await app.inject({
      method: "GET",
      url: `/api/lists/${listId}/items`,
      headers: { cookie: cookieA },
    });
    assert.equal(items.statusCode, 404);

    const leftoverItem = await app.inject({
      method: "PATCH",
      url: `/api/items/${itemId}`,
      headers: { cookie: cookieA },
      payload: { checked: false },
    });
    assert.equal(leftoverItem.statusCode, 404);
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

    const otherSession = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "bob", password: "password1" },
    });
    assert.equal(otherSession.statusCode, 200);
    const cookieOther = getCookie(otherSession)!;

    const ok = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: cookieB },
      payload: { currentPassword: "password1", newPassword: "password2" },
    });
    assert.equal(ok.statusCode, 204);

    const otherMe = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: cookieOther },
    });
    assert.equal(otherMe.statusCode, 401);

    const meStill = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: cookieB },
    });
    assert.equal(meStill.statusCode, 200);

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

  await it("malformed JSON body returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "application/json" },
      payload: "{not-json",
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, "VALIDATION_ERROR");
  });
});

describe("registration gate", async () => {
  async function withApp(
    registrationMode: "bootstrap" | "closed" | "open",
    run: (app: FastifyInstance) => Promise<void>,
  ) {
    const dbPath = path.join(
      os.tmpdir(),
      `genesis-reg-${registrationMode}-${Date.now()}.db`,
    );
    const app = await buildApp({
      databasePath: dbPath,
      sessionSecret: "test-secret",
      cookieSecure: false,
      registrationMode,
      version: "1.0.0",
    });
    await app.ready();
    try {
      await run(app);
    } finally {
      await app.close();
      for (const suffix of ["", "-wal", "-shm"]) {
        try {
          if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
        } catch {
          // Windows may briefly keep handles
        }
      }
    }
  }

  await it("bootstrap allows the first account then closes", async () => {
    await withApp("bootstrap", async (app) => {
      const open = await app.inject({
        method: "GET",
        url: "/api/auth/registration",
      });
      assert.equal(open.statusCode, 200);
      assert.deepEqual(open.json(), { open: true });

      const first = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { username: "owner", password: "password1" },
      });
      assert.equal(first.statusCode, 201);

      const closed = await app.inject({
        method: "GET",
        url: "/api/auth/registration",
      });
      assert.deepEqual(closed.json(), { open: false });

      const second = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { username: "guest", password: "password1" },
      });
      assert.equal(second.statusCode, 403);
      assert.equal(second.json().error.code, "FORBIDDEN");
    });
  });

  await it("closed rejects registration even when there are no users", async () => {
    await withApp("closed", async (app) => {
      const status = await app.inject({
        method: "GET",
        url: "/api/auth/registration",
      });
      assert.deepEqual(status.json(), { open: false });

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { username: "owner", password: "password1" },
      });
      assert.equal(res.statusCode, 403);
      assert.equal(res.json().error.code, "FORBIDDEN");
    });
  });
});

describe("shared lists", async () => {
  let app: FastifyInstance;
  let dbPath: string;
  let cookieAlice = "";
  let cookieBob = "";
  let cookieCarol = "";
  let aliceId = "";
  let bobId = "";
  let carolId = "";
  let sharedListId = "";
  let sharedItemId = "";

  before(async () => {
    dbPath = path.join(os.tmpdir(), `genesis-share-${Date.now()}.db`);
    app = await buildApp({
      databasePath: dbPath,
      sessionSecret: "test-secret",
      cookieSecure: false,
      registrationMode: "open",
      version: "1.0.0",
    });
    await app.ready();

    const alice = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "alice", password: "password1" },
    });
    cookieAlice = getCookie(alice)!;
    aliceId = alice.json().id;

    const bob = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "bob", password: "password1" },
    });
    cookieBob = getCookie(bob)!;
    bobId = bob.json().id;

    const carol = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "carol", password: "password1" },
    });
    cookieCarol = getCookie(carol)!;
    carolId = carol.json().id;

    const created = await app.inject({
      method: "POST",
      url: "/api/lists",
      headers: { cookie: cookieAlice },
      payload: { name: "Household" },
    });
    sharedListId = created.json().id;
  });

  after(async () => {
    await app.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = dbPath + suffix;
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
  });

  await it("GET /api/users lists the directory", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: cookieAlice },
    });
    assert.equal(res.statusCode, 200);
    const users = res.json().users as Array<{ id: string; username: string }>;
    assert.equal(users.length, 3);
    assert.deepEqual(
      users.map((u) => u.username).sort(),
      ["alice", "bob", "carol"],
    );
    assert.ok(users.some((u) => u.id === aliceId));
    assert.ok(users.some((u) => u.id === bobId));
    assert.ok(users.some((u) => u.id === carolId));
  });

  await it("owner can put members; bob sees shared list", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieAlice },
      payload: { userIds: [bobId] },
    });
    assert.equal(put.statusCode, 200);
    assert.equal(put.json().members.length, 1);
    assert.equal(put.json().members[0].userId, bobId);
    assert.equal(put.json().members[0].username, "bob");

    const get = await app.inject({
      method: "GET",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieAlice },
    });
    assert.equal(get.statusCode, 200);
    assert.equal(get.json().members.length, 1);

    const bobLists = await app.inject({
      method: "GET",
      url: "/api/lists",
      headers: { cookie: cookieBob },
    });
    assert.equal(bobLists.statusCode, 200);
    assert.equal(bobLists.json().lists.length, 1);
    assert.equal(bobLists.json().lists[0].id, sharedListId);
    assert.equal(bobLists.json().lists[0].isOwner, false);
    assert.equal(bobLists.json().lists[0].ownerUsername, "alice");

    const carolLists = await app.inject({
      method: "GET",
      url: "/api/lists",
      headers: { cookie: cookieCarol },
    });
    assert.equal(carolLists.json().lists.length, 0);
  });

  await it("member can read write rename and clear; cannot delete or manage members", async () => {
    const add = await app.inject({
      method: "POST",
      url: `/api/lists/${sharedListId}/items`,
      headers: { cookie: cookieBob },
      payload: { text: "Milk" },
    });
    assert.equal(add.statusCode, 201);
    sharedItemId = add.json().id;

    const rename = await app.inject({
      method: "PATCH",
      url: `/api/lists/${sharedListId}`,
      headers: { cookie: cookieBob },
      payload: { name: "Household shop" },
    });
    assert.equal(rename.statusCode, 200);
    assert.equal(rename.json().name, "Household shop");
    assert.equal(rename.json().isOwner, false);
    assert.equal(rename.json().ownerUsername, "alice");

    const tick = await app.inject({
      method: "PATCH",
      url: `/api/items/${sharedItemId}`,
      headers: { cookie: cookieBob },
      payload: { checked: true },
    });
    assert.equal(tick.statusCode, 200);

    const clear = await app.inject({
      method: "DELETE",
      url: `/api/lists/${sharedListId}/items/checked`,
      headers: { cookie: cookieBob },
    });
    assert.equal(clear.statusCode, 204);

    const add2 = await app.inject({
      method: "POST",
      url: `/api/lists/${sharedListId}/items`,
      headers: { cookie: cookieBob },
      payload: { text: "Bread" },
    });
    assert.equal(add2.statusCode, 201);
    sharedItemId = add2.json().id;

    const delItem = await app.inject({
      method: "DELETE",
      url: `/api/items/${sharedItemId}`,
      headers: { cookie: cookieBob },
    });
    assert.equal(delItem.statusCode, 204);

    const delList = await app.inject({
      method: "DELETE",
      url: `/api/lists/${sharedListId}`,
      headers: { cookie: cookieBob },
    });
    assert.equal(delList.statusCode, 403);
    assert.equal(delList.json().error.code, "FORBIDDEN");

    const getMembers = await app.inject({
      method: "GET",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieBob },
    });
    assert.equal(getMembers.statusCode, 403);

    const putMembers = await app.inject({
      method: "PUT",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieBob },
      payload: { userIds: [carolId] },
    });
    assert.equal(putMembers.statusCode, 403);
  });

  await it("carol still gets 404; put rejects owner and unknown ids", async () => {
    const items = await app.inject({
      method: "GET",
      url: `/api/lists/${sharedListId}/items`,
      headers: { cookie: cookieCarol },
    });
    assert.equal(items.statusCode, 404);

    const invalidAsStranger = await app.inject({
      method: "PUT",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieCarol },
      payload: { userIds: "not-an-array" },
    });
    assert.equal(invalidAsStranger.statusCode, 404);
    assert.equal(invalidAsStranger.json().error.code, "NOT_FOUND");

    const invalidAsMember = await app.inject({
      method: "PUT",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieBob },
      payload: { userIds: "not-an-array" },
    });
    assert.equal(invalidAsMember.statusCode, 403);
    assert.equal(invalidAsMember.json().error.code, "FORBIDDEN");

    const ownerAsMember = await app.inject({
      method: "PUT",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieAlice },
      payload: { userIds: [aliceId] },
    });
    assert.equal(ownerAsMember.statusCode, 400);
    assert.equal(ownerAsMember.json().error.code, "VALIDATION_ERROR");

    const unknown = await app.inject({
      method: "PUT",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieAlice },
      payload: { userIds: ["00000000-0000-4000-8000-000000000099"] },
    });
    assert.equal(unknown.statusCode, 400);
  });

  await it("owner leave is 400; member can leave; revoke removes access", async () => {
    const ownerLeave = await app.inject({
      method: "DELETE",
      url: `/api/lists/${sharedListId}/members/me`,
      headers: { cookie: cookieAlice },
    });
    assert.equal(ownerLeave.statusCode, 400);

    const leave = await app.inject({
      method: "DELETE",
      url: `/api/lists/${sharedListId}/members/me`,
      headers: { cookie: cookieBob },
    });
    assert.equal(leave.statusCode, 204);

    const bobLists = await app.inject({
      method: "GET",
      url: "/api/lists",
      headers: { cookie: cookieBob },
    });
    assert.equal(bobLists.json().lists.length, 0);

    const bobItems = await app.inject({
      method: "GET",
      url: `/api/lists/${sharedListId}/items`,
      headers: { cookie: cookieBob },
    });
    assert.equal(bobItems.statusCode, 404);

    const reshare = await app.inject({
      method: "PUT",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieAlice },
      payload: { userIds: [bobId, carolId] },
    });
    assert.equal(reshare.statusCode, 200);
    assert.equal(reshare.json().members.length, 2);

    const revoke = await app.inject({
      method: "PUT",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieAlice },
      payload: { userIds: [bobId] },
    });
    assert.equal(revoke.statusCode, 200);
    assert.equal(revoke.json().members.length, 1);
    assert.equal(revoke.json().members[0].userId, bobId);

    const carolGone = await app.inject({
      method: "GET",
      url: `/api/lists/${sharedListId}/items`,
      headers: { cookie: cookieCarol },
    });
    assert.equal(carolGone.statusCode, 404);

    const clearAll = await app.inject({
      method: "PUT",
      url: `/api/lists/${sharedListId}/members`,
      headers: { cookie: cookieAlice },
      payload: { userIds: [] },
    });
    assert.equal(clearAll.statusCode, 200);
    assert.equal(clearAll.json().members.length, 0);
  });
});
