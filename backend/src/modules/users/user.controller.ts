import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { registerCrudController } from "../../core/controller/crud-controller.js";
import { userService } from "./user.service.js";
import {
  userCreateSchema,
  userUpdateSchema,
  profileUpdateSchema,
  publicUserSchema,
  changeStatusSchema,
  resetPasswordSchema,
} from "./user.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { getPrincipal, requirePermission, requireSuperAdmin } from "../../core/security/rbac.js";
import { z } from "zod";

export async function registerUsersController(app: FastifyInstance): Promise<void> {
  registerCrudController({
    app,
    path: "/users",
    service: userService,
    searchFields: ["name", "email", "phone"],
    // Only the super admin manages users & roles; all other roles are hidden
    // from the UI and blocked at the API level too.
    preHandler: requireSuperAdmin(),
    permissions: {
      read: PERMISSIONS["users:read"],
      create: PERMISSIONS["users:create"],
      update: PERMISSIONS["users:update"],
      delete: PERMISSIONS["users:delete"],
    },
    schemas: {
      entity: publicUserSchema,
      create: userCreateSchema,
      update: userUpdateSchema,
      id: z.object({ id: z.string() }),
    },
    serialize: (user) => userService.toPublic(user),
  });

  const typed = app.withTypeProvider<ZodTypeProvider>();

  // Any authenticated user may update their own profile (name/phone/jobTitle/avatar).
  typed.put("/users/me", {
    schema: {
      description: "Update the signed-in user's own profile",
      security: [{ bearerAuth: [] }],
      body: profileUpdateSchema,
      response: { 200: z.object({ success: z.literal(true), data: publicUserSchema }) },
    },
  }, async (request) => {
    const principal = getPrincipal(request);
    const updated = await userService.updateProfile(principal.sub, request.body as z.infer<typeof profileUpdateSchema>, getAuditContext(request));
    return ok(updated);
  });

  typed.post("/users/:id/status", {
    preHandler: requirePermission(PERMISSIONS["users:update"]),
    schema: {
      description: "Activate or deactivate a user",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: changeStatusSchema,
      response: { 200: z.object({ success: z.literal(true), data: publicUserSchema }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await userService.setStatus(id, request.body.status, getAuditContext(request)));
  });

  typed.post("/users/:id/reset-password", {
    preHandler: requireSuperAdmin(),
    schema: {
      description: "Reset a user's password (super admin only)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: resetPasswordSchema,
      response: { 200: z.object({ success: z.literal(true), data: z.object({ success: z.boolean() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    await userService.resetPassword(id, request.body.password, getAuditContext(request));
    return ok({ success: true });
  });
}
