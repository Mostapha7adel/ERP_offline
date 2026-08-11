import { z } from "zod";
import {
  type BaseRepository,
  type BaseEntity,
  type ListOptions,
} from "../repository/base-repository.js";
import { AppError } from "../errors/app-error.js";
import { auditService, type AuditContext } from "../audit/audit.service.js";

export interface CrudServiceConfig<T extends BaseEntity, C, U> {
  repository: BaseRepository<T>;
  /** Name used in audit logs and error messages, e.g. "customer". */
  resourceName: string;
  /** Validation schema for create operations. */
  createSchema: z.ZodTypeAny;
  /** Validation schema for update operations. */
  updateSchema: z.ZodTypeAny;
  /** Map validated input into the entity shape before persistence. */
  toEntity: (input: C | Partial<U>, existing?: T) => Omit<T, keyof BaseEntity> | Promise<Omit<T, keyof BaseEntity>>;
  /** Fields available for free-text search. */
  searchFields?: string[];
  /** Hook invoked before deleting (used to enforce referential integrity). */
  beforeDelete?: (id: string) => Promise<void>;
  /** Hook invoked after an entity is created. */
  afterCreate?: (entity: T, audit: AuditContext) => Promise<void>;
}

/**
 * Generic CRUD service — removes duplicated list/create/update/delete logic
 * across feature modules while staying fully typed per entity.
 */
export class CrudService<T extends BaseEntity, C, U> {
  constructor(protected readonly cfg: CrudServiceConfig<T, C, U>) {}

  protected get searchFields(): string[] | undefined {
    return this.cfg.searchFields;
  }

  async list(options: ListOptions): Promise<{ items: T[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.cfg.repository.list({ ...options, searchFields: this.cfg.searchFields });
  }

  async getById(id: string): Promise<T> {
    const entity = await this.cfg.repository.findById(id);
    if (!entity) throw AppError.notFound(`${this.cfg.resourceName} not found`);
    return entity;
  }

  async create(input: C, audit: AuditContext): Promise<T> {
    const validated = this.cfg.createSchema.parse(input);
    const data = await this.cfg.toEntity(validated);
    const entity = await this.cfg.repository.create({ data });
    await auditService.log(audit, `create:${this.cfg.resourceName}`, this.cfg.resourceName, entity.id);
    await this.cfg.afterCreate?.(entity, audit);
    return entity;
  }

  async update(id: string, input: Partial<U>, audit: AuditContext): Promise<T> {
    const existing = await this.cfg.repository.findById(id);
    if (!existing) throw AppError.notFound(`${this.cfg.resourceName} not found`);

    const validated = this.cfg.updateSchema.parse(input);
    const data = await this.cfg.toEntity(validated, existing);
    const updated = await this.cfg.repository.update({ id, data });
    if (!updated) throw AppError.notFound(`${this.cfg.resourceName} not found`);

    await auditService.log(audit, `update:${this.cfg.resourceName}`, this.cfg.resourceName, id);
    return updated;
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await this.cfg.repository.findById(id);
    if (!existing) throw AppError.notFound(`${this.cfg.resourceName} not found`);

    await this.cfg.beforeDelete?.(id);
    await this.cfg.repository.delete(id);
    await auditService.log(audit, `delete:${this.cfg.resourceName}`, this.cfg.resourceName, id);
    return { id };
  }
}

export type { BaseEntity };
