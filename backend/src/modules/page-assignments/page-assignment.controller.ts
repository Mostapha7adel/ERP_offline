import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { pageAssignmentService } from "./page-assignment.service.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { settingsService } from "../settings/settings.service.js";

const pagesArray = z.array(z.string());

export function registerPageAssignmentController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/page-assignments/roles", {
    preHandler: requirePermission(PERMISSIONS["settings:update"]),
    schema: {
      description: "Get all role page assignments",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.object({ roleId: z.string(), pages: pagesArray })) }) },
    },
  }, async () => {
    const assignments = await pageAssignmentService.getAllRoleAssignments();
    return ok(assignments);
  });

  typed.put("/page-assignments/roles/:roleId", {
    preHandler: requirePermission(PERMISSIONS["settings:update"]),
    schema: {
      description: "Set pages for a role",
      security: [{ bearerAuth: [] }],
      params: z.object({ roleId: z.string() }),
      body: z.object({ pages: pagesArray }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ roleId: z.string(), pages: pagesArray }) }) },
    },
  }, async (request) => {
    const { roleId } = request.params as { roleId: string };
    const { pages } = request.body as { pages: string[] };
    await pageAssignmentService.setRolePages(roleId, pages);
    return ok({ roleId, pages });
  });

  typed.get("/page-assignments/users", {
    preHandler: requirePermission(PERMISSIONS["settings:update"]),
    schema: {
      description: "Get all user page assignments",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.object({ userId: z.string(), pages: pagesArray })) }) },
    },
  }, async () => {
    const assignments = await pageAssignmentService.getAllUserAssignments();
    return ok(assignments);
  });

  typed.put("/page-assignments/users/:userId", {
    preHandler: requirePermission(PERMISSIONS["settings:update"]),
    schema: {
      description: "Set pages for a user",
      security: [{ bearerAuth: [] }],
      params: z.object({ userId: z.string() }),
      body: z.object({ pages: pagesArray }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ userId: z.string(), pages: pagesArray }) }) },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const { pages } = request.body as { pages: string[] };
    await pageAssignmentService.setUserPages(userId, pages);
    return ok({ userId, pages });
  });

  typed.get("/page-assignments/effective/:userId", {
    preHandler: requirePermission(PERMISSIONS["settings:update"]),
    schema: {
      description: "Get effective pages for a user (user overrides role, role overrides none)",
      security: [{ bearerAuth: [] }],
      params: z.object({ userId: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ userId: z.string(), pages: pagesArray.nullable(), source: z.enum(["user", "role", "none"]) }) }) },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const user = await settingsService.getUserForAssignment(userId);
    if (!user) return ok({ userId, pages: null, source: "none" as const });
    const result = await pageAssignmentService.getEffectivePages(userId, user.roleId);
    return ok({ userId, ...result });
  });

  typed.get("/page-assignments/my-pages", {
    schema: {
      description: "Get effective page IDs for the current user",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.object({ pages: pagesArray.nullable(), source: z.enum(["user", "role", "none"]) }) }) },
    },
  }, async (request) => {
    const principal = (request as any).principal;
    if (!principal) return ok({ pages: null, source: "none" as const });
    const result = await pageAssignmentService.getEffectivePages(principal.sub, principal.roleId);
    return ok(result);
  });
}
