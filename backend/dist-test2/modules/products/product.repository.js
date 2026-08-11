import { PrismaRepository } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
export class ProductRepository extends PrismaRepository {
    model = "product";
    searchFields = ["name", "sku", "barcode", "brand"];
    include = { category: true, unit: true };
    toEntity(row) {
        const category = row.category;
        const unit = row.unit;
        return {
            id: String(row.id),
            sku: String(row.sku),
            barcode: row.barcode ? String(row.barcode) : undefined,
            name: String(row.name),
            description: row.description ? String(row.description) : undefined,
            type: row.type,
            category: category?.name,
            brand: row.brand ? String(row.brand) : undefined,
            unit: unit?.code ?? "pcs",
            purchasePrice: Number(row.purchasePrice),
            salePrice: Number(row.salePrice),
            taxRate: Number(row.taxRate),
            imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
            trackStock: Boolean(row.trackStock),
            reorderLevel: row.reorderLevel != null ? Number(row.reorderLevel) : undefined,
            status: row.status,
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    async resolveUnit(code) {
        const existing = await getDb().unit.findFirst({ where: { code } });
        if (existing)
            return existing.id;
        const created = await getDb().unit.create({ data: { code, name: code } });
        return created.id;
    }
    async resolveCategory(name, companyId) {
        const existing = await getDb().category.findFirst({ where: { companyId, name, deletedAt: null } });
        if (existing)
            return existing.id;
        const created = await getDb().category.create({ data: { companyId, name } });
        return created.id;
    }
    async create(input) {
        const now = input.now ?? new Date().toISOString();
        const companyId = await getDefaultCompanyId();
        const { category, unit, ...rest } = input.data;
        const unitId = await this.resolveUnit(unit ?? "pcs");
        const categoryId = category ? await this.resolveCategory(category, companyId) : undefined;
        const row = await this.delegate.create({
            data: {
                ...rest,
                unitId,
                categoryId,
                companyId,
                id: crypto.randomUUID(),
                createdAt: new Date(now),
                updatedAt: new Date(now),
            },
            include: this.include,
        });
        return this.toEntity(row);
    }
    async update(input) {
        const existing = await this.delegate.findFirst({
            where: { ...this.baseWhere(), id: input.id },
        });
        if (!existing)
            return undefined;
        const now = input.now ?? new Date().toISOString();
        const { category, unit, ...rest } = input.data;
        const data = { ...rest, updatedAt: new Date(now) };
        if (unit !== undefined)
            data.unitId = await this.resolveUnit(unit);
        if (category !== undefined) {
            data.categoryId = category ? await this.resolveCategory(category, String(existing.companyId)) : null;
        }
        const row = await this.delegate.update({
            where: { id: input.id },
            data,
            include: this.include,
        });
        return this.toEntity(row);
    }
    async findBySku(sku) {
        const all = await this.findAll();
        return all.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
    }
    async findByBarcode(barcode) {
        const all = await this.findAll();
        return all.find((p) => p.barcode === barcode);
    }
}
export const productRepository = new ProductRepository();
