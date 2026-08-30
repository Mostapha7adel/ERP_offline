import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { PriceList, PriceListItem } from "./price-list.entity.js";

type Row = Record<string, unknown>;

export class PriceListRepository extends PrismaRepository<PriceList> {
  protected model = "priceList";
  protected searchFields = ["name", "description"];

  protected toEntity(row: Row): PriceList {
    return {
      id: String(row.id),
      companyId: String(row.companyId),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      isDefault: Boolean(row.isDefault),
      isActive: Boolean(row.isActive),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      deletedAt: row.deletedAt ? this.toISO(row.deletedAt) : undefined,
    };
  }

  async findByName(name: string): Promise<PriceList | undefined> {
    const all = await this.findAll();
    return all.find((p) => p.name.toLowerCase() === name.toLowerCase());
  }
}

export class PriceListItemRepository extends PrismaRepository<PriceListItem> {
  protected model = "priceListItem";
  protected searchFields = [];

  protected toEntity(row: Row): PriceListItem {
    return {
      id: String(row.id),
      priceListId: String(row.priceListId),
      productId: String(row.productId),
      price: Number(row.price),
      minQuantity: Number(row.minQuantity),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      deletedAt: row.deletedAt ? this.toISO(row.deletedAt) : undefined,
    };
  }

  async findByPriceListId(priceListId: string): Promise<PriceListItem[]> {
    const all = await this.findAll();
    return all.filter((i) => i.priceListId === priceListId);
  }

  async findByProductId(productId: string): Promise<PriceListItem[]> {
    const all = await this.findAll();
    return all.filter((i) => i.productId === productId);
  }

  async findUnique(priceListId: string, productId: string): Promise<PriceListItem | undefined> {
    const all = await this.findAll();
    return all.find((i) => i.priceListId === priceListId && i.productId === productId);
  }
}

export const priceListRepository = new PriceListRepository();
export const priceListItemRepository = new PriceListItemRepository();
