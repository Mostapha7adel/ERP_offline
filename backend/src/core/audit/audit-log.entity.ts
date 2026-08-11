import { z } from "zod";

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  actorId: string;
  actorEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip?: string;
  details?: unknown;
}

export const auditLogSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  actorId: z.string(),
  actorEmail: z.string(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  ip: z.string().optional(),
  details: z.unknown().optional(),
});
