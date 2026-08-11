import { registerCrudController } from "../../core/controller/crud-controller.js";
import { roleService } from "./role.service.js";
import { roleCreateSchema, roleUpdateSchema, roleSchema } from "./role.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { z } from "zod";
export function registerRolesController(app) {
    registerCrudController({
        app,
        path: "/roles",
        service: roleService,
        searchFields: ["name", "description"],
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
