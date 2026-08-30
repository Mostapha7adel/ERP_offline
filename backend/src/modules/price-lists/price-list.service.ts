import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { priceListRepository, priceListItemRepository } from "./price-list.repository.js";
import {
  priceListCreateSchema,
  priceListUpdateSchema,
  priceListItemCreateSchema,
  type PriceListCreateInput,
  type PriceListUpdateInput,
  type PriceListItemCreateInput,
} from "./price-list.schema.js";
import type { PriceList, PriceListItem } from "./price-list.entity.js";
import type { BaseEntity } from "../../core/repository/base-repository.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";

export class PriceListService extends CrudService<PriceList, PriceListCreateInput, PriceListUpdateInput> {
  constructor() {
    super({
      repository: priceListRepository,
      resourceName: "price-list",
      createSchema: priceListCreateSchema,
      updateSchema: priceListUpdateSchema,
      searchFields: ["name", "description"],
      toEntity: async (input, existing) => {
        return {
          name: input.name ?? existing?.name ?? "",
          description: input.description ?? existing?.description,
          isDefault: input.isDefault ?? existing?.isDefault ?? false,
          isActive: input.isActive ?? existing?.isActive ?? true,
        } as Omit<PriceList, keyof BaseEntity>;
      },
    });
  }

  override async create(input: PriceListCreateInput, audit: AuditContext): Promise<PriceList> {
    const validated = priceListCreateSchema.parse(input);
    if (await priceListRepository.findByName(validated.name)) {
      throw AppError.conflict(`Price list "${validated.name}" already exists`);
    }
    if (validated.isDefault) {
      const all = await priceListRepository.findAll();
      const existingDefault = all.find((p) => p.isDefault);
      if (existingDefault) {
        await priceListRepository.update({ id: existingDefault.id, data: { isDefault: false } });
      }
    }
    const entity = await super.create(input, audit);
    return entity;
  }

  override async update(id: string, input: PriceListUpdateInput, audit: AuditContext): Promise<PriceList> {
    if (input.name) {
      const clash = await priceListRepository.findByName(input.name);
      if (clash && clash.id !== id) {
        throw AppError.conflict(`Price list "${input.name}" already exists`);
      }
    }
    if (input.isDefault) {
      const all = await priceListRepository.findAll();
      const existingDefault = all.find((p) => p.isDefault && p.id !== id);
      if (existingDefault) {
        await priceListRepository.update({ id: existingDefault.id, data: { isDefault: false } });
      }
    }
    return super.update(id, input, audit);
  }

  async addItem(priceListId: string, input: PriceListItemCreateInput, audit: AuditContext): Promise<PriceListItem> {
    const validated = priceListItemCreateSchema.parse(input);
    const priceList = await priceListRepository.findById(priceListId);
    if (!priceList) throw AppError.notFound("price list not found");
    const existing = await priceListItemRepository.findUnique(priceListId, validated.productId);
    if (existing) throw AppError.conflict("Product already exists in this price list");
    const item = await priceListItemRepository.create({
      data: {
        priceListId,
        productId: validated.productId,
        price: validated.price,
        minQuantity: validated.minQuantity,
      },
    });
    await auditService.log(audit, "add:price-list-item", "price-list", priceListId, { productId: validated.productId });
    return item;
  }

  async removeItem(priceListId: string, itemId: string, audit: AuditContext): Promise<{ id: string }> {
    const item = await priceListItemRepository.findById(itemId);
    if (!item || item.priceListId !== priceListId) throw AppError.notFound("price list item not found");
    await priceListItemRepository.delete(itemId);
    await auditService.log(audit, "remove:price-list-item", "price-list", priceListId, { itemId });
    return { id: itemId };
  }

  async listItems(priceListId: string, options: { page?: number; limit?: number } = {}) {
    const priceList = await priceListRepository.findById(priceListId);
    if (!priceList) throw AppError.notFound("price list not found");
    const allItems = await priceListItemRepository.findByPriceListId(priceListId);
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const start = (page - 1) * limit;
    return {
      items: allItems.slice(start, start + limit),
      total: allItems.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(allItems.length / limit)),
    };
  }

  async getItemById(priceListId: string, itemId: string): Promise<PriceListItem> {
    const item = await priceListItemRepository.findById(itemId);
    if (!item || item.priceListId !== priceListId) throw AppError.notFound("price list item not found");
    return item;
  }
}

export const priceListService = new PriceListService();
