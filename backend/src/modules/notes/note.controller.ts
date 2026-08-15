import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createNoteService } from "./note.service.js";
import { noteCreateSchema, noteSchema } from "./note.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerNotesController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const service = createNoteService();
  const singleResponse = z.object({ success: z.literal(true), data: noteSchema });

  typed.get("/notes", {
    preHandler: requirePermission(PERMISSIONS["notes:read"]),
    schema: {
      description: "List credit/debit notes",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        type: z.enum(["sales", "purchase"]).optional(),
        noteType: z.enum(["credit", "debit"]).optional(),
        partyId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const filters: Record<string, string[]> = {};
    if (query.type) filters.type = [String(query.type)];
    if (query.noteType) filters.noteType = [String(query.noteType)];
    if (query.partyId) filters.partyId = [String(query.partyId)];
    const result = await service.list({ ...options, filters });
    return paginated(await Promise.all(result.items.map((n) => service.enrich(n))), computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/notes/:id", {
    preHandler: requirePermission(PERMISSIONS["notes:read"]),
    schema: {
      description: "Get a credit/debit note by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await service.enrich(await service.getById(id)));
  });

  typed.post("/notes", {
    preHandler: requirePermission(PERMISSIONS["notes:create"]),
    schema: {
      description: "Create a credit/debit note",
      security: [{ bearerAuth: [] }],
      body: noteCreateSchema,
      response: { 201: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request, reply) => {
    const note = await service.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(await service.enrich(note));
  });

  typed.post("/notes/:id/void", {
    preHandler: requirePermission(PERMISSIONS["notes:void"]),
    schema: {
      description: "Void a credit/debit note (reverses stock and invoice adjustments)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await service.enrich(await service.void(id, getAuditContext(request))));
  });
}
