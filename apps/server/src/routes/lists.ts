import type { FastifyInstance } from "fastify";
import {
  createItemSchema,
  createListSchema,
  updateItemSchema,
  updateListSchema,
  type ListDto,
  type ListItemDto,
} from "@genesis-lists/shared";
import type { Db, ItemRow, ListRow } from "../db/index.js";
import { nowIso, requireUser, sendError, uuid } from "../util.js";

function toListDto(row: ListRow): ListDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toItemDto(row: ItemRow): ListItemDto {
  return {
    id: row.id,
    listId: row.list_id,
    text: row.text,
    checked: row.checked === 1,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function registerListRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/lists", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const rows = db
      .prepare(`SELECT * FROM lists WHERE owner_id = ? ORDER BY created_at ASC`)
      .all(user.id) as ListRow[];

    return reply.send({ lists: rows.map(toListDto) });
  });

  app.post("/api/lists", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const parsed = createListSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const id = uuid();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO lists (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, user.id, parsed.data.name, ts, ts);

    return reply.status(201).send(
      toListDto({
        id,
        owner_id: user.id,
        name: parsed.data.name,
        created_at: ts,
        updated_at: ts,
      }),
    );
  });

  app.patch("/api/lists/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const parsed = updateListSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const existing = db
      .prepare(`SELECT * FROM lists WHERE id = ? AND owner_id = ?`)
      .get(id, user.id) as ListRow | undefined;

    if (!existing) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    const updatedAt = nowIso();
    db.prepare(`UPDATE lists SET name = ?, updated_at = ? WHERE id = ?`).run(
      parsed.data.name,
      updatedAt,
      id,
    );

    return reply.send(
      toListDto({ ...existing, name: parsed.data.name, updated_at: updatedAt }),
    );
  });

  app.delete("/api/lists/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const existing = db
      .prepare(`SELECT id FROM lists WHERE id = ? AND owner_id = ?`)
      .get(id, user.id);

    if (!existing) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    db.prepare(`DELETE FROM lists WHERE id = ?`).run(id);
    return reply.status(204).send();
  });

  app.get("/api/lists/:id/items", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const list = db
      .prepare(`SELECT id FROM lists WHERE id = ? AND owner_id = ?`)
      .get(id, user.id);

    if (!list) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    const rows = db
      .prepare(
        `SELECT * FROM list_items WHERE list_id = ? ORDER BY position ASC`,
      )
      .all(id) as ItemRow[];

    return reply.send({ items: rows.map(toItemDto) });
  });

  app.post("/api/lists/:id/items", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id: listId } = request.params as { id: string };
    const parsed = createItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const list = db
      .prepare(`SELECT id FROM lists WHERE id = ? AND owner_id = ?`)
      .get(listId, user.id);

    if (!list) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    const maxRow = db
      .prepare(`SELECT MAX(position) AS max_pos FROM list_items WHERE list_id = ?`)
      .get(listId) as { max_pos: number | null };
    const position = (maxRow.max_pos ?? -1) + 1;
    const id = uuid();
    const ts = nowIso();

    db.prepare(
      `INSERT INTO list_items (id, list_id, text, checked, position, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
    ).run(id, listId, parsed.data.text, position, ts, ts);

    return reply.status(201).send(
      toItemDto({
        id,
        list_id: listId,
        text: parsed.data.text,
        checked: 0,
        position,
        created_at: ts,
        updated_at: ts,
      }),
    );
  });

  app.patch("/api/items/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const parsed = updateItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const row = db
      .prepare(
        `SELECT i.*, l.owner_id AS owner_id
         FROM list_items i
         INNER JOIN lists l ON l.id = i.list_id
         WHERE i.id = ?`,
      )
      .get(id) as (ItemRow & { owner_id: string }) | undefined;

    if (!row || row.owner_id !== user.id) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    const updatedAt = nowIso();
    const text = parsed.data.text ?? row.text;
    const checked =
      parsed.data.checked !== undefined
        ? parsed.data.checked
          ? 1
          : 0
        : row.checked;
    const position = parsed.data.position ?? row.position;

    db.prepare(
      `UPDATE list_items SET text = ?, checked = ?, position = ?, updated_at = ? WHERE id = ?`,
    ).run(text, checked, position, updatedAt, id);

    return reply.send(
      toItemDto({
        id: row.id,
        list_id: row.list_id,
        text,
        checked,
        position,
        created_at: row.created_at,
        updated_at: updatedAt,
      }),
    );
  });

  app.delete("/api/items/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const row = db
      .prepare(
        `SELECT i.id AS id, l.owner_id AS owner_id
         FROM list_items i
         INNER JOIN lists l ON l.id = i.list_id
         WHERE i.id = ?`,
      )
      .get(id) as { id: string; owner_id: string } | undefined;

    if (!row || row.owner_id !== user.id) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    db.prepare(`DELETE FROM list_items WHERE id = ?`).run(id);
    return reply.status(204).send();
  });
}
