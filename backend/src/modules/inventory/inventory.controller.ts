import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { stockItemRepository, stockMovementRepository, batchRepository } from "./inventory.repository.js";
import { applyStockChange, recordBatch } from "./inventory.service.js";
import { productRepository } from "../products/product.repository.js";
import { warehouseRepository } from "../warehouses/warehouse.repository.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";
import { AppError } from "../../core/errors/app-error.js";
import { auditService } from "../../core/audit/audit.service.js";
import { withTransaction } from "../../core/database/transaction.js";

const adjustmentSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().refine((q) => q !== 0, "Quantity cannot be zero"),
  reason: z.string().min(1, "Reason is required").max(200),
  note: z.string().max(1000).optional(),
});

const transferSchema = z.object({
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
  note: z.string().max(1000).optional(),
});

export function registerInventoryController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/inventory", {
    preHandler: requirePermission(PERMISSIONS["inventory:read"]),
    schema: {
      description: "List stock levels across warehouses",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        search: z.string().optional(),
        warehouseId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const all = await stockItemRepository.findAll();
    const rows = [];
    for (const s of all) {
      if (query.warehouseId && s.warehouseId !== String(query.warehouseId)) continue;
      const product = await productRepository.findById(s.productId);
      const warehouse = await warehouseRepository.findById(s.warehouseId);
      rows.push({
        ...s,
        productName: product?.name,
        sku: product?.sku,
        warehouseName: warehouse?.name,
        stockValue: Math.round(s.quantityOnHand * s.averageCost * 100) / 100,
        isLowStock: s.quantityOnHand <= s.reorderLevel,
      });
    }

    const search = options.search?.toLowerCase();
    const filtered = search
      ? rows.filter((r) => (r.productName ?? "").toLowerCase().includes(search) || (r.sku ?? "").toLowerCase().includes(search))
      : rows;

    const total = filtered.length;
    const start = (options.page - 1) * options.limit;
    const items = filtered.slice(start, start + options.limit);
    return paginated(items, computeMeta(options.page, options.limit, total));
  });

  typed.get("/inventory/low-stock", {
    preHandler: requirePermission(PERMISSIONS["inventory:read"]),
    schema: {
      description: "List products at or below their reorder level",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()) }) },
    },
  }, async () => {
    const all = await stockItemRepository.findAll();
    const items = [];
    for (const s of all.filter((s) => s.quantityOnHand <= s.reorderLevel && s.reorderLevel > 0)) {
      const product = await productRepository.findById(s.productId);
      const warehouse = await warehouseRepository.findById(s.warehouseId);
      items.push({ ...s, productName: product?.name, sku: product?.sku, warehouseName: warehouse?.name });
    }
    return ok(items);
  });

  typed.get("/inventory/movements", {
    preHandler: requirePermission(PERMISSIONS["inventory:read"]),
    schema: {
      description: "List stock movements",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        productId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const all = await stockMovementRepository.findAll();
    const rows = [];
    for (const m of all) {
      if (query.productId && m.productId !== String(query.productId)) continue;
      const product = await productRepository.findById(m.productId);
      const warehouse = await warehouseRepository.findById(m.warehouseId);
      rows.push({ ...m, productName: product?.name, sku: product?.sku, warehouseName: warehouse?.name });
    }
    const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = sorted.length;
    const start = (options.page - 1) * options.limit;
    return paginated(sorted.slice(start, start + options.limit), computeMeta(options.page, options.limit, total));
  });

  typed.post("/inventory/adjustments", {
    preHandler: requirePermission(PERMISSIONS["inventory:adjust"]),
    schema: {
      description: "Adjust stock quantity (positive or negative)",
      security: [{ bearerAuth: [] }],
      body: adjustmentSchema,
      response: { 200: z.object({ success: z.literal(true), data: z.object({ success: z.boolean(), newQuantity: z.number() }) }) },
    },
  }, async (request) => {
    const input = request.body;
    const principalId = request.principal?.sub ?? "system";
    const result = await withTransaction(async () => {
      await applyStockChange(
        { productId: input.productId, warehouseId: input.warehouseId, quantity: input.quantity, reason: input.reason, note: input.note },
        principalId,
        { type: "adjustment", actor: request.principal },
      );
      const item = await stockItemRepository.findByProductWarehouse(input.productId, input.warehouseId);
      return { success: true, newQuantity: item?.quantityOnHand ?? 0 };
    });
    await auditService.log(getAuditContext(request), "adjust-stock", "inventory", input.productId, input);
    return ok(result);
  });

  typed.post("/inventory/transfers", {
    preHandler: requirePermission(PERMISSIONS["inventory:transfer"]),
    schema: {
      description: "Transfer stock between warehouses",
      security: [{ bearerAuth: [] }],
      body: transferSchema,
      response: { 200: z.object({ success: z.literal(true), data: z.object({ success: z.boolean() }) }) },
    },
  }, async (request) => {
    const input = request.body;
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw AppError.badRequest("Source and destination warehouses must differ");
    }
    if (!(await warehouseRepository.findById(input.fromWarehouseId))) throw AppError.badRequest("Source warehouse not found");
    if (!(await warehouseRepository.findById(input.toWarehouseId))) throw AppError.badRequest("Destination warehouse not found");

    const principalId = request.principal?.sub ?? "system";
    const result = await withTransaction(async () => {
      for (const item of input.items) {
        if (!(await productRepository.findById(item.productId))) throw AppError.badRequest(`Product "${item.productId}" not found`);
        await applyStockChange(
          { productId: item.productId, warehouseId: input.fromWarehouseId, quantity: -item.quantity, reason: "transfer" },
          principalId,
          { type: "transfer-out", actor: request.principal },
        );
        await applyStockChange(
          { productId: item.productId, warehouseId: input.toWarehouseId, quantity: item.quantity, reason: "transfer" },
          principalId,
          { type: "transfer-in", actor: request.principal },
        );
      }
      return { success: true };
    });
    await auditService.log(getAuditContext(request), "transfer-stock", "inventory", undefined, input);
    return ok(result);
  });

  typed.get("/inventory/batches", {
    preHandler: requirePermission(PERMISSIONS["inventory:read"]),
    schema: {
      description: "List tracked batches / lots with expiry",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        productId: z.string().optional(),
        warehouseId: z.string().optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()) }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const all = await batchRepository.findAll();
    const rows = [];
    for (const b of all) {
      if (query.productId && b.productId !== String(query.productId)) continue;
      if (query.warehouseId && b.warehouseId !== String(query.warehouseId)) continue;
      const product = await productRepository.findById(b.productId);
      const warehouse = await warehouseRepository.findById(b.warehouseId);
      rows.push({ ...b, productName: product?.name, sku: product?.sku, warehouseName: warehouse?.name });
    }
    const q = query.search ? String(query.search).toLowerCase() : "";
    const filtered = q
      ? rows.filter((r) =>
          (r.productName ?? "").toLowerCase().includes(q) ||
          (r.batchNumber ?? "").toLowerCase().includes(q) ||
          (r.sku ?? "").toLowerCase().includes(q),
        )
      : rows;
    const sorted = [...filtered].sort((a, b) => {
      if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
      if (a.expiryDate) return -1;
      if (b.expiryDate) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return ok(sorted);
  });

  typed.post("/inventory/batches", {
    preHandler: requirePermission(PERMISSIONS["inventory:adjust"]),
    schema: {
      description: "Manually record a batch / lot into stock",
      security: [{ bearerAuth: [] }],
      body: z.object({
        productId: z.string().min(1),
        warehouseId: z.string().min(1),
        batchNumber: z.string().min(1).max(100),
        quantity: z.number().positive(),
        expiryDate: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const input = request.body;
    const principalId = request.principal?.sub ?? "system";
    const result = await withTransaction(async () => {
      await applyStockChange(
        { productId: input.productId, warehouseId: input.warehouseId, quantity: input.quantity, reason: "batch-received", note: `Batch ${input.batchNumber}` },
        principalId,
        { type: "purchase", cost: 0, actor: request.principal },
      );
      await recordBatch({
        productId: input.productId,
        warehouseId: input.warehouseId,
        batchNumber: input.batchNumber,
        quantity: input.quantity,
        expiryDate: input.expiryDate,
        createdBy: principalId,
      });
      return { success: true };
    });
    await auditService.log(getAuditContext(request), "record-batch", "inventory", input.productId, input);
    return ok(result);
  });
}
