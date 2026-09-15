import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const passwordSchema = z.string().min(8).max(128);

export const authCredentialsSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export type ChangePassword = z.infer<typeof changePasswordSchema>;

export const PREVIEW_ITEM_LIMIT = 8;

export type ListItemPreviewDto = {
  id: string;
  text: string;
  checked: boolean;
};

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const updateListSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const createItemSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const updateItemSchema = z
  .object({
    text: z.string().trim().min(1).max(500).optional(),
    checked: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => v.text !== undefined || v.checked !== undefined || v.position !== undefined, {
    message: "At least one field required",
  });

export type AuthProvider = "local" | "oidc";

export type UserDto = {
  id: string;
  username: string;
  email?: string | null;
  authProviders: AuthProvider[];
};

export type OidcPublicConfigDto = {
  enabled: boolean;
  buttonText: string;
  autoLaunch: boolean;
};

export type AuthConfigDto = {
  registrationOpen: boolean;
  passwordLoginEnabled: boolean;
  oidc: OidcPublicConfigDto;
};

export type ListDto = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  previewItems: ListItemPreviewDto[];
  itemCount: number;
};

export type ListItemDto = {
  id: string;
  listId: string;
  text: string;
  checked: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type RegistrationStatusDto = {
  open: boolean;
};

export type HealthDto = {
  status: "ok";
  version: string;
  schemaVersion: number;
};

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
  };
};
