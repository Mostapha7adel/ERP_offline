import { z } from "zod";

export interface Backup {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  sizeBytes: number;
  recordCount: number;
  /** Snapshot of the memory database at backup time. */
  data: Record<string, unknown[]>;
}

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

/**
 * Accepts either the raw wrapped download format `{ app, version, data }`
 * or the legacy client envelope `{ label?, data }`.
 */
export const restorePayloadSchema = z
  .object({
    label: z.string().max(200).optional(),
    app: z.string().optional(),
    version: z.number().optional(),
    data: z.unknown().optional(),
  })
  .passthrough();

export type CreateBackupInput = z.infer<typeof createBackupSchema>;
export type RestoreRequestInput = z.infer<typeof restoreRequestSchema>;
