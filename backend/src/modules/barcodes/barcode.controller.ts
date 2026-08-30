import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { productRepository } from "../products/product.repository.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

function generateBarcode(): string {
  const prefix = "490";
  const body = String(Math.floor(1000000000 + Math.random() * 9000000000));
  const digits = prefix + body;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits + String(checkDigit);
}

export function registerBarcodesController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/barcodes", {
    preHandler: requirePermission(PERMISSIONS["products:read"]),
    schema: {
      description: "List all barcodes (products with a barcode assigned)",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const allProducts = await productRepository.findAll();
    const barcoded = allProducts
      .filter((p) => p.barcode)
      .map((p) => ({
        id: p.id,
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        barcode: p.barcode,
        format: "ean-13" as const,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
    return paginated(barcoded, computeMeta(options.page ?? 1, options.limit ?? 100, barcoded.length));
  });

  typed.post("/barcodes/generate", {
    preHandler: requirePermission(PERMISSIONS["products:update"]),
    schema: {
      description: "Generate barcodes for products without one, or assign a custom barcode to a specific product",
      security: [{ bearerAuth: [] }],
      body: z.object({
        productId: z.string().optional(),
        barcode: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const body = request.body as { productId?: string; barcode?: string };

    if (body.productId) {
      const product = await productRepository.findById(body.productId);
      if (!product) return ok(null);
      const barcode = body.barcode || generateBarcode();
      const updated = await productRepository.update({
        id: body.productId,
        data: { barcode },
      });
      return ok({
        id: updated?.id ?? body.productId,
        productId: updated?.id ?? body.productId,
        productName: updated?.name,
        sku: updated?.sku,
        barcode,
        format: "ean-13",
        createdAt: updated?.createdAt,
        updatedAt: updated?.updatedAt,
      });
    }

    const allProducts = await productRepository.findAll();
    const withoutBarcode = allProducts.filter((p) => !p.barcode);
    const usedBarcodes = new Set(allProducts.filter((p) => p.barcode).map((p) => p.barcode));
    let updated = 0;

    for (const product of withoutBarcode) {
      let barcode = generateBarcode();
      let attempts = 0;
      while (usedBarcodes.has(barcode) && attempts < 100) {
        barcode = generateBarcode();
        attempts++;
      }
      if (attempts >= 100) continue;
      usedBarcodes.add(barcode);
      await productRepository.update({
        id: product.id,
        data: { barcode },
      });
      updated++;
    }

    return ok({ updated });
  });

  typed.delete("/barcodes/:id", {
    preHandler: requirePermission(PERMISSIONS["products:update"]),
    schema: {
      description: "Remove barcode from a product (sets barcode to null)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    await productRepository.update({ id, data: { barcode: null as unknown as undefined } });
    return ok({ id });
  });
}
