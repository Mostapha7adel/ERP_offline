import { PrismaRepository } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import type { Product } from "./product.entity.js";

type Row = Record<string, unknown>;

export class ProductRepository extends PrismaRepository<Product> {
  protected model = "product";
  protected searchFields = ["name", "sku", "barcode", "brand"];
  protected include = { category: true, unit: true };

  protected toEntity(row: Row): Product {
    const category = row.category as { name?: string } | null;
    const unit = row.unit as { code?: string } | null;
    return {
      id: String(row.id),
      sku: String(row.sku),
      barcode: row.barcode ? String(row.barcode) : undefined,
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      type: row.type as Product["type"],
      category: category?.name,
      brand: row.brand ? String(row.brand) : undefined,
      unit: unit?.code ?? "pcs",
      purchasePrice: Number(row.purchasePrice),
      salePrice: Number(row.salePrice),
      taxRate: Number(row.taxRate),
      imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
      trackStock: Boolean(row.trackStock),
      reorderLevel: row.reorderLevel != null ? Number(row.reorderLevel) : undefined,
      status: row.status as Product["status"],
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  private async resolveUnit(code: string): Promise<string> {
    const existing = await getDb().unit.findFirst({ where: { code } });
    if (existing) return existing.id;
    const created = await getDb().unit.create({ data: { code, name: code } });
    return created.id;
  }

  private async resolveCategory(name: string, companyId: string): Promise<string> {
    const existing = await getDb().category.findFirst({ where: { companyId, name, deletedAt: null } });
    if (existing) return existing.id;
    const created = await getDb().category.create({ data: { companyId, name } });
    return created.id;
  }

  override async create(input: { data: Omit<Product, keyof { id: string; createdAt: string; updatedAt: string }>; now?: string }): Promise<Product> {
    const now = input.now ?? new Date().toISOString();
    const companyId = await getDefaultCompanyId();
    const { category, unit, ...rest } = input.data;
    const unitId = await this.resolveUnit(unit ?? "pcs");
    const categoryId = category ? await this.resolveCategory(category, companyId) : undefined;
    const row = await this.delegate.create({
      data: {
        ...(rest as Record<string, unknown>),
        unitId,
        categoryId,
        companyId,
        id: crypto.randomUUID(),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      include: this.include,
    });
    return this.toEntity(row as Row);
  }

  override async update(input: { id: string; data: Partial<Omit<Product, keyof { id: string; createdAt: string; updatedAt: string }>>; now?: string }): Promise<Product | undefined> {
    const existing = await this.delegate.findFirst({
      where: { ...this.baseWhere(), id: input.id },
    });
    if (!existing) return undefined;

    const now = input.now ?? new Date().toISOString();
    const { category, unit, ...rest } = input.data;
    const data: Record<string, unknown> = { ...rest, updatedAt: new Date(now) };
    if (unit !== undefined) data.unitId = await this.resolveUnit(unit);
    if (category !== undefined) {
      data.categoryId = category ? await this.resolveCategory(category, String(existing.companyId)) : null;
    }
    const row = await this.delegate.update({
      where: { id: input.id },
      data,
      include: this.include,
    });
    return this.toEntity(row as Row);
  }

  async findBySku(sku: string): Promise<Product | undefined> {
    const all = await this.findAll();
    return all.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
  }

  async findByBarcode(barcode: string): Promise<Product | undefined> {
    const all = await this.findAll();
    return all.find((p) => p.barcode === barcode);
  }
}

export const productRepository = new ProductRepository();
