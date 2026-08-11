import { z } from "zod";
import { ALL_PERMISSIONS } from "../../core/security/permissions.js";

/** Accepts a URL or a base64 `data:image/...` string (avatars stored in DB). */
const avatarField = z
  .string()
  .max(2_000_000)
  .refine((v) => v === "" || v.startsWith("data:image/") || v.startsWith("http"), {
    message: "Avatar must be an image data URI or a URL",
  });

export const roleCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  avatarUrl: avatarField.optional().or(z.literal("").optional()),
  permissions: z.array(z.string()).refine(
    (perms) => perms.every((p) => (ALL_PERMISSIONS as readonly string[]).includes(p)),
    { message: "One or more permissions are invalid" },
  ),
});

export const roleUpdateSchema = roleCreateSchema.partial();

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  avatarUrl: z.string().optional(),
  permissions: z.array(z.string()),
  isSystem: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
