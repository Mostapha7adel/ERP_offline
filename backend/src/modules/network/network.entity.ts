import { z } from "zod";

export interface NetworkWorkspace {
  id: string;
  name: string;
  joinCode: string;
  hostDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkDevice {
  id: string;
  deviceId: string;
  name: string;
  ip?: string;
  userAgent?: string;
  token?: string;
  currentUserId?: string;
  currentUserName?: string;
  isHost: boolean;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Workspace metadata safe to expose to any authenticated caller. */
export const networkWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  joinCode: z.string(),
  hostDeviceId: z.string().nullable(),
  createdAt: z.string(),
});

/** A device entry without its secret token. */
export const networkDeviceSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  name: z.string(),
  ip: z.string().optional(),
  currentUserName: z.string().optional(),
  isHost: z.boolean(),
  lastSeenAt: z.string().optional(),
  createdAt: z.string(),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(120),
  deviceId: z.string().min(1, "deviceId is required").max(128),
  deviceName: z.string().min(1, "deviceName is required").max(120),
});

export const joinWorkspaceSchema = z.object({
  code: z.string().min(1, "Join code is required").max(16),
  deviceId: z.string().min(1, "deviceId is required").max(128),
  deviceName: z.string().min(1, "deviceName is required").max(120),
});

export const heartbeatSchema = z.object({
  token: z.string().min(1),
  deviceId: z.string().min(1).max(128),
  deviceName: z.string().min(1).max(120),
  currentUserName: z.string().optional(),
  isHost: z.boolean().optional(),
});

export const kickDeviceSchema = z.object({
  deviceId: z.string().min(1),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type JoinWorkspaceInput = z.infer<typeof joinWorkspaceSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
