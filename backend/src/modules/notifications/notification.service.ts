import { notificationRepository } from "./notification.repository.js";
import { broadcastSync } from "../../core/realtime/realtime.js";
import { logger } from "../../core/logger/logger.js";
import type { AuthPrincipal } from "../../core/security/rbac.js";
import type { NotificationEntry } from "./notification.entity.js";

/**
 * Writes in-app notifications to the shared database and broadcasts a `sync`
 * event so every connected device re-hydrates its notification feed. Failures
 * never break the main request flow (mirrors the audit service).
 */
export class NotificationService {
  async create(input: {
    kind: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    resource?: string;
    resourceId?: string;
    actor?: AuthPrincipal;
  }): Promise<NotificationEntry | undefined> {
    try {
      const entry = await notificationRepository.create({
        data: {
          kind: input.kind,
          title: input.title,
          message: input.message,
          resource: input.resource,
          resourceId: input.resourceId,
          actorId: input.actor?.sub,
          actorName: input.actor?.name,
          read: false,
        },
      });
      broadcastSync({ resource: "notifications" });
      return entry;
    } catch (error) {
      logger.error({ error }, "Failed to write notification");
      return undefined;
    }
  }
}

export const notificationService = new NotificationService();
