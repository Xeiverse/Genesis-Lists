import { z } from "zod";

/** Login identifier. Trimmed and lower-cased so accounts are case-insensitive. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email().max(254));

/**
 * Control characters and bidi overrides, which let one display name render as
 * another in the share picker. Names are not unique, so the rendered form is
 * all a sharer has to go on.
 */
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

export const DISPLAY_NAME_UNSAFE_CHARS_MESSAGE =
  "Display name may not contain control or text-direction characters.";

/** Display name shown to other users. Not unique. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((v) => !UNSAFE_NAME_CHARS.test(v), {
    message: DISPLAY_NAME_UNSAFE_CHARS_MESSAGE,
  });

export const passwordSchema = z.string().min(8).max(128);

/** Fallback display name for accounts that never supplied one. */
export function displayNameFromEmail(email: string): string {
  const localPart = email.slice(0, email.lastIndexOf("@"));
  return localPart.slice(0, 64) || email.slice(0, 64);
}

export const authCredentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;

export const registerSchema = authCredentialsSchema.extend({
  name: displayNameSchema.optional(),
});

export type RegisterCredentials = z.infer<typeof registerSchema>;

export const updateProfileSchema = z.object({
  name: displayNameSchema,
});

export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export type ChangePassword = z.infer<typeof changePasswordSchema>;

/** Label for a personal access token (shown in Settings; not a secret). */
export const apiTokenNameSchema = z.string().trim().min(1).max(64);

export const createApiTokenSchema = z.object({
  name: apiTokenNameSchema,
});

export type CreateApiToken = z.infer<typeof createApiTokenSchema>;

/** Metadata for a PAT. The plaintext secret is only returned once on create. */
export type ApiTokenDto = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type CreatedApiTokenDto = ApiTokenDto & {
  token: string;
};

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

/** The authenticated user. Only ever describes the caller's own account. */
export type UserDto = {
  id: string;
  email: string;
  name: string;
  authProviders: AuthProvider[];
};

/**
 * Directory entry for the share picker (`GET /api/users`). Display names are not
 * unique, so the address is what tells two people apart. Omitted when the
 * operator sets `DIRECTORY_SHOW_EMAILS=false`.
 */
export type UserDirectoryDto = {
  id: string;
  name: string;
  email?: string;
};

export type OidcPublicConfigDto = {
  enabled: boolean;
  buttonText: string;
  autoLaunch: boolean;
  /** True when Android Custom Tabs OIDC handoff is supported. */
  mobileLogin: boolean;
};

export type AuthConfigDto = {
  registrationOpen: boolean;
  passwordLoginEnabled: boolean;
  oidc: OidcPublicConfigDto;
};

export type ListMemberDto = {
  userId: string;
  name: string;
};

export const putListMembersSchema = z.object({
  userIds: z.array(z.string().uuid()),
});

export type PutListMembers = z.infer<typeof putListMembersSchema>;

export type ListDto = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  previewItems: ListItemPreviewDto[];
  itemCount: number;
  isOwner: boolean;
  ownerName: string;
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
