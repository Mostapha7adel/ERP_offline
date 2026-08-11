import { registerCrudController } from "../../core/controller/crud-controller.js";
import { userService } from "./user.service.js";
import { userCreateSchema, userUpdateSchema, publicUserSchema, changeStatusSchema, resetPasswordSchema, } from "./user.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { z } from "zod";
export async function registerUsersController(app) {
    registerCrudController({
        app,
        path: "/users",
        service: userService,
        searchFields: ["name", "email", "phone"],
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
    const typed = app.withTypeProvider();
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
        const { id } = request.params;
        return ok(await userService.setStatus(id, request.body.status, getAuditContext(request)));
    });
    typed.post("/users/:id/reset-password", {
        preHandler: requirePermission(PERMISSIONS["users:update"]),
        schema: {
            description: "Reset a user's password",
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
            body: resetPasswordSchema,
            response: { 200: z.object({ success: z.literal(true), data: z.object({ success: z.boolean() }) }) },
        },
    }, async (request) => {
        const { id } = request.params;
        await userService.resetPassword(id, request.body.password, getAuditContext(request));
        return ok({ success: true });
    });
}
