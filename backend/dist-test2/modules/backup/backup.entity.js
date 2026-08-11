import { z } from "zod";
export const backupSchema = z.object({
    id: z.string(),
    label: z.string(),
    createdAt: z.string(),
    createdBy: z.string(),
    sizeBytes: z.number(),
    recordCount: z.number(),
});
export const createBackupSchema = z.object({
    label: z.string().max(200).optional(),
});
export const restoreRequestSchema = z.object({
    backupId: z.string().min(1, "backupId is required"),
});
export const restorePayloadSchema = z.object({
    label: z.string().max(200).optional(),
    data: z.record(z.string(), z.array(z.unknown())),
});
