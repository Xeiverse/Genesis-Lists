import type { ListDto, ListItemDto, UserDto, ApiErrorBody } from "@genesis-lists/shared";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.status = status;
    this.code = body.error.code;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data ?? { error: { code: "INTERNAL_ERROR", message: res.statusText } });
  }
  return data as T;
}

export const api = {
  me: () => request<UserDto>("/api/auth/me"),
  register: (username: string, password: string) =>
    request<UserDto>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<UserDto>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  lists: () => request<{ lists: ListDto[] }>("/api/lists"),
  createList: (name: string) =>
    request<ListDto>("/api/lists", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  renameList: (id: string, name: string) =>
    request<ListDto>(`/api/lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteList: (id: string) =>
    request<void>(`/api/lists/${id}`, { method: "DELETE" }),
  items: (listId: string) =>
    request<{ items: ListItemDto[] }>(`/api/lists/${listId}/items`),
  createItem: (listId: string, text: string) =>
    request<ListItemDto>(`/api/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  updateItem: (
    id: string,
    patch: { text?: string; checked?: boolean; position?: number },
  ) =>
    request<ListItemDto>(`/api/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteItem: (id: string) =>
    request<void>(`/api/items/${id}`, { method: "DELETE" }),
};
