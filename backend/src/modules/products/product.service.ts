import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { productRepository } from "./product.repository.js";
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateInput,
  type ProductUpdateInput,
} from "./product.schema.js";
import type { Product } from "./product.entity.js";
import type { BaseEntity } from "../../core/repository/base-repository.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { notificationService } from "../notifications/notification.service.js";

async function nextSku(): Promise<string> {
  const base = "PRD";
  const count = (await productRepository.count()) + 1;
  return `${base}-${String(count).padStart(4, "0")}`;
}

export class ProductService extends CrudService<Product, ProductCreateInput, ProductUpdateInput> {
  constructor() {
    super({
      repository: productRepository,
      resourceName: "product",
      createSchema: productCreateSchema,
      updateSchema: productUpdateSchema,
      searchFields: ["name", "sku", "barcode", "category", "brand"],
      toEntity: async (input, existing) => {
        return {
          sku: (input.sku as string | undefined)?.toUpperCase() ?? existing?.sku ?? (await nextSku()),
          barcode: input.barcode ?? existing?.barcode,
          name: input.name ?? existing?.name ?? "",
          description: input.description ?? existing?.description,
          type: input.type ?? existing?.type ?? "product",
          category: input.category ?? existing?.category,
          brand: input.brand ?? existing?.brand,
          unit: input.unit ?? existing?.unit ?? "pcs",
          purchasePrice: input.purchasePrice ?? existing?.purchasePrice ?? 0,
          salePrice: input.salePrice ?? existing?.salePrice ?? 0,
          taxRate: input.taxRate ?? existing?.taxRate ?? 0,
          imageUrl: input.imageUrl ? (input.imageUrl as string) : existing?.imageUrl,
          trackStock: input.trackStock ?? existing?.trackStock ?? true,
          reorderLevel: input.reorderLevel ?? existing?.reorderLevel,
          status: input.status ?? existing?.status ?? "active",
        } as Omit<Product, keyof BaseEntity>;
      },
      afterCreate: async (entity, audit) => {
        await notificationService.create({
          kind: "success",
          title: "New product",
          message: entity.name,
          resource: "product",
          resourceId: entity.id,
          actor: audit.principal,
        });
      },
    });
  }

  override async create(input: ProductCreateInput, audit: AuditContext): Promise<Product> {
    const sku = (input.sku ?? (await nextSku())).toUpperCase();
    if (await productRepository.findBySku(sku)) {
      throw AppError.conflict(`Product SKU "${sku}" already exists`);
    }
    if (input.barcode && (await productRepository.findByBarcode(input.barcode))) {
      throw AppError.conflict(`Product barcode "${input.barcode}" already exists`);
    }
    return super.create({ ...input, sku }, audit);
  }

  override async update(id: string, input: ProductUpdateInput, audit: AuditContext): Promise<Product> {
    const existing = await productRepository.findById(id);
    if (!existing) throw AppError.notFound("product not found");
    if (input.sku) {
      const sku = input.sku.toUpperCase();
      const clash = await productRepository.findBySku(sku);
      if (clash && clash.id !== id) {
        throw AppError.conflict(`Product SKU "${sku}" already exists`);
      }
      input = { ...input, sku };
    }
    if (input.barcode) {
      const clash = await productRepository.findByBarcode(input.barcode);
      if (clash && clash.id !== id) {
        throw AppError.conflict(`Product barcode "${input.barcode}" already exists`);
      }
    }
    return super.update(id, input, audit);
  }
}

export const productService = new ProductService();
