import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { deliveryNoteService } from "./delivery-note.service.js";
import { deliveryNoteLineRepository } from "./delivery-note.repository.js";
import {
  deliveryNoteSchema,
  deliveryNoteLineWithIdSchema,
  deliveryNoteCreateSchema,
  deliveryNoteUpdateSchema,
} from "./delivery-note.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";
import { registerCrudController } from "../../core/controller/crud-controller.js";

export function registerDeliveryNotesController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  registerCrudController({
    app,
    path: "/delivery-notes",
    service: deliveryNoteService,
    searchFields: ["number", "receivedBy", "notes"],
    permissions: {
      read: PERMISSIONS["delivery-notes:read"],
      create: PERMISSIONS["delivery-notes:create"],
      update: PERMISSIONS["delivery-notes:update"],
      delete: PERMISSIONS["delivery-notes:delete"],
    },
    schemas: {
      entity: deliveryNoteSchema,
      create: deliveryNoteCreateSchema,
      update: deliveryNoteUpdateSchema,
      id: z.object({ id: z.string() }),
    },
  });

  typed.get("/delivery-notes/:id/lines", {
    preHandler: requirePermission(PERMISSIONS["delivery-notes:read"]),
    schema: {
      description: "List lines for a delivery note",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(deliveryNoteLineWithIdSchema) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    await deliveryNoteService.getById(id);
    const lines = await deliveryNoteLineRepository.findByDeliveryNoteId(id);
    return ok(lines);
  });
}
