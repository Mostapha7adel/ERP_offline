import type { FastifyInstance } from "fastify";
import { registerCrudController } from "../../core/controller/crud-controller.js";
import { roleService } from "./role.service.js";
import { roleCreateSchema, roleUpdateSchema, roleSchema } from "./role.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { requireSuperAdmin } from "../../core/security/rbac.js";
import { z } from "zod";

export function registerRolesController(app: FastifyInstance): void {
  registerCrudController({
    app,
    path: "/roles",
    service: roleService,
    searchFields: ["name", "description"],
    // Role management is reserved for the super admin (see users controller).
    preHandler: requireSuperAdmin(),
    permissions: {
      read: PERMISSIONS["roles:read"],
      create: PERMISSIONS["roles:create"],
      update: PERMISSIONS["roles:update"],
      delete: PERMISSIONS["roles:delete"],
    },
    schemas: {
      entity: roleSchema,
      create: roleCreateSchema,
      update: roleUpdateSchema,
      id: z.object({ id: z.string() }),
    },
  });
}
