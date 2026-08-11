import type { FastifyInstance } from "fastify";
import { registerCrudController } from "../../core/controller/crud-controller.js";
import { productService } from "./product.service.js";
import { productCreateSchema, productUpdateSchema, productSchema } from "./product.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { z } from "zod";

export function registerProductsController(app: FastifyInstance): void {
  registerCrudController({
    app,
    path: "/products",
    service: productService,
    searchFields: ["name", "sku", "barcode", "category", "brand"],
    permissions: {
      read: PERMISSIONS["products:read"],
      create: PERMISSIONS["products:create"],
      update: PERMISSIONS["products:update"],
      delete: PERMISSIONS["products:delete"],
    },
    schemas: {
      entity: productSchema,
      create: productCreateSchema,
      update: productUpdateSchema,
      id: z.object({ id: z.string() }),
    },
  });
}
