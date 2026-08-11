import type { FastifyInstance } from "fastify";
import { registerCrudController } from "../../core/controller/crud-controller.js";
import { warehouseService } from "./warehouse.service.js";
import { warehouseCreateSchema, warehouseUpdateSchema, warehouseSchema } from "./warehouse.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { z } from "zod";

export function registerWarehousesController(app: FastifyInstance): void {
  registerCrudController({
    app,
    path: "/warehouses",
    service: warehouseService,
    searchFields: ["code", "name", "address", "manager"],
    permissions: {
      read: PERMISSIONS["warehouses:read"],
      create: PERMISSIONS["warehouses:create"],
      update: PERMISSIONS["warehouses:update"],
      delete: PERMISSIONS["warehouses:delete"],
    },
    schemas: {
      entity: warehouseSchema,
      create: warehouseCreateSchema,
      update: warehouseUpdateSchema,
      id: z.object({ id: z.string() }),
    },
  });
}
