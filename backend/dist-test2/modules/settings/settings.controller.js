import { z } from "zod";
import { settingsService } from "./settings.service.js";
import { companySettingsSchema, preferencesSchema, settingsUpdateSchema } from "./settings.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
export function registerSettingsController(app) {
    const typed = app.withTypeProvider();
    typed.get("/settings", {
        preHandler: requirePermission(PERMISSIONS["settings:read"]),
        schema: {
            description: "Get company settings and preferences",
            security: [{ bearerAuth: [] }],
            response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
        },
    }, async () => {
        return ok(await settingsService.getAll());
    });
    typed.put("/settings", {
        preHandler: requirePermission(PERMISSIONS["settings:update"]),
        schema: {
            description: "Update company settings and/or preferences",
            security: [{ bearerAuth: [] }],
            body: settingsUpdateSchema,
            response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
        },
    }, async (request) => {
        return ok(await settingsService.updateAll(request.body, getAuditContext(request)));
    });
    typed.put("/settings/company", {
        preHandler: requirePermission(PERMISSIONS["settings:update"]),
        schema: {
            description: "Update company profile",
            security: [{ bearerAuth: [] }],
            body: companySettingsSchema,
            response: { 200: z.object({ success: z.literal(true), data: companySettingsSchema }) },
        },
    }, async (request) => {
        return ok(await settingsService.updateCompany(request.body, getAuditContext(request)));
    });
    typed.put("/settings/preferences", {
        preHandler: requirePermission(PERMISSIONS["settings:update"]),
        schema: {
            description: "Update user preferences",
            security: [{ bearerAuth: [] }],
            body: preferencesSchema,
            response: { 200: z.object({ success: z.literal(true), data: preferencesSchema }) },
        },
    }, async (request) => {
        return ok(await settingsService.updatePreferences(request.body, getAuditContext(request)));
    });
    typed.get("/settings/:key", {
        preHandler: requirePermission(PERMISSIONS["settings:read"]),
        schema: {
            description: "Get a single setting by key",
            security: [{ bearerAuth: [] }],
            params: z.object({ key: z.string() }),
            response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
        },
    }, async (request) => {
        const { key } = request.params;
        return ok(await settingsService.getByKey(key));
    });
}
