import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { settingsService } from "./settings.service.js";
import { companySettingsSchema, preferencesSchema, settingsUpdateSchema } from "./settings.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerSettingsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

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
    const { key } = request.params as { key: string };
    return ok(await settingsService.getByKey(key));
  });

  // ── Page Visibility (admin-only) ──

  typed.get("/settings/page-visibility", {
    preHandler: requirePermission(PERMISSIONS["settings:update"]),
    schema: {
      description: "Get hidden pages list (admin only)",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.object({ hiddenPages: z.array(z.string()) }) }) },
    },
  }, async () => {
    const hidden = await settingsService.getHiddenPages();
    return ok({ hiddenPages: hidden });
  });

  typed.put("/settings/page-visibility", {
    preHandler: requirePermission(PERMISSIONS["settings:update"]),
    schema: {
      description: "Update hidden pages list (admin only)",
      security: [{ bearerAuth: [] }],
      body: z.object({ hiddenPages: z.array(z.string()) }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ hiddenPages: z.array(z.string()) }) }) },
    },
  }, async (request) => {
    const { hiddenPages } = request.body as { hiddenPages: string[] };
    await settingsService.setHiddenPages(hiddenPages, getAuditContext(request));
    return ok({ hiddenPages });
  });
}
