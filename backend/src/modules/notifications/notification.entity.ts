import { z } from "zod";

export interface NotificationEntry {
  id: string;
  kind: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  resource?: string;
  resourceId?: string;
  actorId?: string;
  actorName?: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export const notificationEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(["info", "success", "warning", "error"]),
  title: z.string(),
  message: z.string(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  actorId: z.string().optional(),
  actorName: z.string().optional(),
  read: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createNotificationSchema = z.object({
  kind: z.enum(["info", "success", "warning", "error"]).default("info"),
  title: z.string().min(1).max(200),
  message: z.string().max(1000),
  resource: z.string().max(60).optional(),
  resourceId: z.string().max(120).optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
