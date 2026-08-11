import { z } from "zod";
export const warehouseCreateSchema = z.object({
    code: z.string().min(1).max(30).optional(),
    name: z.string().min(1, "Name is required").max(200),
    address: z.string().max(300).optional(),
    manager: z.string().max(150).optional(),
    phone: z.string().max(30).optional(),
    isDefault: z.boolean().default(false),
    status: z.enum(["active", "inactive"]).default("active"),
});
export const warehouseUpdateSchema = warehouseCreateSchema.partial();
export const warehouseSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    address: z.string().optional(),
    manager: z.string().optional(),
    phone: z.string().optional(),
    isDefault: z.boolean(),
    status: z.enum(["active", "inactive"]),
    createdAt: z.string(),
    updatedAt: z.string(),
});
