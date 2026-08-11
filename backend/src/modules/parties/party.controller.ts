import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { registerCrudController } from "../../core/controller/crud-controller.js";
import { createPartyService } from "./party.service.js";
import { partyCreateSchema, partyUpdateSchema, partySchema } from "./party.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { z } from "zod";

const PERMISSION_MAP = {
  customer: {
    read: PERMISSIONS["customers:read"],
    create: PERMISSIONS["customers:create"],
    update: PERMISSIONS["customers:update"],
    delete: PERMISSIONS["customers:delete"],
  },
  supplier: {
    read: PERMISSIONS["suppliers:read"],
    create: PERMISSIONS["suppliers:create"],
    update: PERMISSIONS["suppliers:update"],
    delete: PERMISSIONS["suppliers:delete"],
  },
} as const;

export function registerPartyController(app: FastifyInstance): void {
  for (const [type, path] of [
    ["customer", "/customers"],
    ["supplier", "/suppliers"],
  ] as const) {
    registerCrudController({
      app,
      path,
      service: createPartyService(type),
      searchFields: ["name", "code", "email", "phone", "taxNumber", "city", "contactName"],
      permissions: PERMISSION_MAP[type],
      schemas: {
        entity: partySchema,
        create: partyCreateSchema,
        update: partyUpdateSchema,
        id: z.object({ id: z.string() }),
      },
    });
  }
}
