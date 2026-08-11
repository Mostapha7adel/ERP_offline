import { z } from "zod";
export const userCreateSchema = z.object({
    name: z.string().min(1, "Name is required").max(150),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    roleId: z.string().min(1, "Role is required"),
    status: z.enum(["active", "inactive"]).default("active"),
    phone: z.string().max(30).optional(),
    avatarUrl: z.string().url().optional().or(z.literal("")),
});
export const userUpdateSchema = z.object({
    name: z.string().min(1).max(150).optional(),
    email: z.string().email().optional(),
    roleId: z.string().min(1).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    phone: z.string().max(30).optional().or(z.literal("").optional()),
    avatarUrl: z.string().url().optional().or(z.literal("").optional()),
});
/** Safe projection returned to clients (never exposes passwordHash). */
export const publicUserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    roleId: z.string(),
    status: z.enum(["active", "inactive"]),
    phone: z.string().optional(),
    avatarUrl: z.string().optional(),
    lastLoginAt: z.string().optional(),
    roleName: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export const changeStatusSchema = z.object({
    status: z.enum(["active", "inactive"]),
});
export const resetPasswordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
});
