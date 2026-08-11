import { z } from "zod";
import { ALL_PERMISSIONS } from "../../core/security/permissions.js";
export const roleCreateSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional(),
    permissions: z.array(z.string()).refine((perms) => perms.every((p) => ALL_PERMISSIONS.includes(p)), { message: "One or more permissions are invalid" }),
});
export const roleUpdateSchema = roleCreateSchema.partial();
export const roleSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    permissions: z.array(z.string()),
    isSystem: z.boolean().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
