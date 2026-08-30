import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { productRepository } from "./product.repository.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

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

export function registerBarcodeController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/products/barcode/:code", {
    preHandler: requirePermission(PERMISSIONS["products:barcode"]),
    schema: {
      description: "Look up a product by barcode",
      security: [{ bearerAuth: [] }],
      params: z.object({ code: z.string().min(1) }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { code } = request.params as { code: string };
    const product = await productRepository.findByBarcode(code);
    if (!product) {
      return { success: true as const, data: null };
    }
    return ok(product);
  });

  typed.post("/products/generate-barcodes", {
    preHandler: requirePermission(PERMISSIONS["products:update"]),
    schema: {
      description: "Generate barcodes for products that do not have one",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.object({ updated: z.number() }) }) },
    },
  }, async () => {
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
}
