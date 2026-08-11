import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { notificationRepository } from "./notification.repository.js";
import { notificationEntrySchema } from "./notification.entity.js";
import { paginated, computeMeta, ok } from "../../core/response/response.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

/**
 * Notification feed. Accessible to every authenticated user — any member can
 * see the shared workspace feed (who added what), not just admins.
 */
export function registerNotificationsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/notifications", {
    schema: {
      description: "List in-app notifications",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(notificationEntrySchema), meta: z.any() }) },
    },
  }, async (request) => {
    const options = parseListOptions(request.query as Record<string, unknown>);
    const result = await notificationRepository.list({ ...options, limit: 60 });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.post("/notifications/:id/read", {
    schema: {
      description: "Mark a notification as read",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: notificationEntrySchema }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    await notificationRepository.markRead(id);
    const updated = await notificationRepository.findById(id);
    if (!updated) {
      return ok({
        id,
        kind: "info" as const,
        title: "Notification",
        message: "Notification no longer available",
        read: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return ok(updated);
  });

  typed.post("/notifications/read-all", {
    schema: {
      description: "Mark every notification as read",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.object({ success: z.boolean() }) }) },
    },
  }, async () => {
    await notificationRepository.markAllRead();
    return ok({ success: true });
  });
}
