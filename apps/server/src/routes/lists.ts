import type { FastifyInstance } from "fastify";
import {
  PREVIEW_ITEM_LIMIT,
  createItemSchema,
  createListSchema,
  putListMembersSchema,
  updateItemSchema,
  updateListSchema,
  type ListDto,
  type ListItemDto,
  type ListItemPreviewDto,
  type ListMemberDto,
} from "@genesis-lists/shared";
import type { Db, ItemRow, ListRow } from "../db/index.js";
import { nowIso, requireUser, sendError, uuid } from "../util.js";

type ListAccess = "owner" | "member" | "none";

type ListWithOwner = ListRow & { owner_name: string };

function getListAccess(db: Db, listId: string, userId: string): ListAccess {
  const list = db
    .prepare(`SELECT owner_id FROM lists WHERE id = ?`)
    .get(listId) as { owner_id: string } | undefined;
  if (!list) return "none";
  if (list.owner_id === userId) return "owner";
  const member = db
    .prepare(`SELECT 1 AS ok FROM list_members WHERE list_id = ? AND user_id = ?`)
    .get(listId, userId);
  return member ? "member" : "none";
}

function loadListWithOwner(
  db: Db,
  listId: string,
): ListWithOwner | undefined {
  return db
    .prepare(
      `SELECT l.*, u.name AS owner_name
       FROM lists l
       INNER JOIN users u ON u.id = l.owner_id
       WHERE l.id = ?`,
    )
    .get(listId) as ListWithOwner | undefined;
}

function toListDto(
  row: ListRow,
  opts: {
    previewItems?: ListItemPreviewDto[];
    itemCount?: number;
    isOwner: boolean;
    ownerName: string;
  },
): ListDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    previewItems: opts.previewItems ?? [],
    itemCount: opts.itemCount ?? 0,
    isOwner: opts.isOwner,
    ownerName: opts.ownerName,
  };
}

function loadListPreviews(
  db: Db,
  listIds: string[],
): Map<string, { previewItems: ListItemPreviewDto[]; itemCount: number }> {
  const result = new Map<
    string,
    { previewItems: ListItemPreviewDto[]; itemCount: number }
  >();
  for (const id of listIds) {
    result.set(id, { previewItems: [], itemCount: 0 });
  }
  if (listIds.length === 0) return result;

  const placeholders = listIds.map(() => "?").join(", ");

  const countRows = db
    .prepare(
      `SELECT list_id, COUNT(*) AS cnt FROM list_items
       WHERE list_id IN (${placeholders})
       GROUP BY list_id`,
    )
    .all(...listIds) as Array<{ list_id: string; cnt: number }>;
  for (const row of countRows) {
    const entry = result.get(row.list_id);
    if (entry) entry.itemCount = row.cnt;
  }

  const previewRows = db
    .prepare(
      `SELECT id, list_id, text, checked, position
       FROM (
         SELECT id, list_id, text, checked, position,
           ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY position ASC) AS rn
         FROM list_items
         WHERE list_id IN (${placeholders})
       )
       WHERE rn <= ?
       ORDER BY list_id ASC, position ASC`,
    )
    .all(...listIds, PREVIEW_ITEM_LIMIT) as Array<{
    id: string;
    list_id: string;
    text: string;
    checked: number;
    position: number;
  }>;

  for (const row of previewRows) {
    const entry = result.get(row.list_id);
    if (!entry) continue;
    entry.previewItems.push({
      id: row.id,
      text: row.text,
      checked: row.checked === 1,
    });
  }

  return result;
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

function loadMembers(db: Db, listId: string): ListMemberDto[] {
  const rows = db
    .prepare(
      `SELECT m.user_id AS user_id, u.name AS name
       FROM list_members m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.list_id = ?
       ORDER BY u.name ASC`,
    )
    .all(listId) as Array<{ user_id: string; name: string }>;
  return rows.map((r) => ({ userId: r.user_id, name: r.name }));
}

function userCanAccessItem(
  db: Db,
  itemId: string,
  userId: string,
): ItemRow | undefined {
  const row = db
    .prepare(
      `SELECT i.*
       FROM list_items i
       INNER JOIN lists l ON l.id = i.list_id
       WHERE i.id = ?
         AND (
           l.owner_id = ?
           OR EXISTS (
             SELECT 1 FROM list_members m
             WHERE m.list_id = l.id AND m.user_id = ?
           )
         )`,
    )
    .get(itemId, userId, userId) as ItemRow | undefined;
  return row;
}

export async function registerListRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/users", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const rows = db
      .prepare(`SELECT id, name FROM users ORDER BY name ASC`)
      .all() as Array<{ id: string; name: string }>;

    return reply.send({
      users: rows.map((r) => ({ id: r.id, name: r.name })),
    });
  });

  app.get("/api/lists", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const rows = db
      .prepare(
        `SELECT l.*, u.name AS owner_name
         FROM lists l
         INNER JOIN users u ON u.id = l.owner_id
         WHERE l.owner_id = ?
            OR EXISTS (
              SELECT 1 FROM list_members m
              WHERE m.list_id = l.id AND m.user_id = ?
            )
         ORDER BY l.created_at ASC`,
      )
      .all(user.id, user.id) as ListWithOwner[];

    const previews = loadListPreviews(
      db,
      rows.map((r) => r.id),
    );

    return reply.send({
      lists: rows.map((row) => {
        const preview = previews.get(row.id) ?? {
          previewItems: [],
          itemCount: 0,
        };
        return toListDto(row, {
          previewItems: preview.previewItems,
          itemCount: preview.itemCount,
          isOwner: row.owner_id === user.id,
          ownerName: row.owner_name,
        });
      }),
    });
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
      toListDto(
        {
          id,
          owner_id: user.id,
          name: parsed.data.name,
          created_at: ts,
          updated_at: ts,
        },
        { isOwner: true, ownerName: user.name },
      ),
    );
  });

  app.patch("/api/lists/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const access = getListAccess(db, id, user.id);
    if (access === "none") {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    const parsed = updateListSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const existing = loadListWithOwner(db, id);
    if (!existing) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    const updatedAt = nowIso();
    db.prepare(`UPDATE lists SET name = ?, updated_at = ? WHERE id = ?`).run(
      parsed.data.name,
      updatedAt,
      id,
    );

    const previews = loadListPreviews(db, [id]);
    const preview = previews.get(id) ?? { previewItems: [], itemCount: 0 };

    return reply.send(
      toListDto(
        { ...existing, name: parsed.data.name, updated_at: updatedAt },
        {
          previewItems: preview.previewItems,
          itemCount: preview.itemCount,
          isOwner: access === "owner",
          ownerName: existing.owner_name,
        },
      ),
    );
  });

  app.delete("/api/lists/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const access = getListAccess(db, id, user.id);
    if (access === "none") {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }
    if (access !== "owner") {
      return sendError(
        reply,
        403,
        "FORBIDDEN",
        "Only the list owner can perform this action",
      );
    }

    db.prepare(`DELETE FROM lists WHERE id = ?`).run(id);
    return reply.status(204).send();
  });

  app.get("/api/lists/:id/members", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const access = getListAccess(db, id, user.id);
    if (access === "none") {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }
    if (access !== "owner") {
      return sendError(
        reply,
        403,
        "FORBIDDEN",
        "Only the list owner can perform this action",
      );
    }

    return reply.send({ members: loadMembers(db, id) });
  });

  app.put("/api/lists/:id/members", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const access = getListAccess(db, id, user.id);
    if (access === "none") {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }
    if (access !== "owner") {
      return sendError(
        reply,
        403,
        "FORBIDDEN",
        "Only the list owner can perform this action",
      );
    }

    const parsed = putListMembersSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const list = db
      .prepare(`SELECT owner_id FROM lists WHERE id = ?`)
      .get(id) as { owner_id: string };

    const uniqueIds = [...new Set(parsed.data.userIds)];
    if (uniqueIds.includes(list.owner_id)) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "Cannot add the list owner as a member",
      );
    }

    for (const userId of uniqueIds) {
      const exists = db
        .prepare(`SELECT id FROM users WHERE id = ?`)
        .get(userId);
      if (!exists) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Unknown user id");
      }
    }

    const ts = nowIso();
    db.exec("BEGIN");
    try {
      db.prepare(`DELETE FROM list_members WHERE list_id = ?`).run(id);
      const insert = db.prepare(
        `INSERT INTO list_members (list_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)`,
      );
      for (const userId of uniqueIds) {
        insert.run(id, userId, ts);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    return reply.send({ members: loadMembers(db, id) });
  });

  app.delete("/api/lists/:id/members/me", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const access = getListAccess(db, id, user.id);
    if (access === "none") {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }
    if (access === "owner") {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "List owners cannot leave; delete the list instead",
      );
    }

    db.prepare(
      `DELETE FROM list_members WHERE list_id = ? AND user_id = ?`,
    ).run(id, user.id);
    return reply.status(204).send();
  });

  app.get("/api/lists/:id/items", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    if (getListAccess(db, id, user.id) === "none") {
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
    if (getListAccess(db, listId, user.id) === "none") {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    const parsed = createItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
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

  app.delete("/api/lists/:id/items/checked", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    if (getListAccess(db, id, user.id) === "none") {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    db.prepare(`DELETE FROM list_items WHERE list_id = ? AND checked = 1`).run(id);
    return reply.status(204).send();
  });

  app.patch("/api/items/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const row = userCanAccessItem(db, id, user.id);
    if (!row) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    const parsed = updateItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body");
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
    const row = userCanAccessItem(db, id, user.id);
    if (!row) {
      return sendError(reply, 404, "NOT_FOUND", "Not found");
    }

    db.prepare(`DELETE FROM list_items WHERE id = ?`).run(id);
    return reply.status(204).send();
  });
}
