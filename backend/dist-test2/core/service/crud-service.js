import { AppError } from "../errors/app-error.js";
import { auditService } from "../audit/audit.service.js";
/**
 * Generic CRUD service — removes duplicated list/create/update/delete logic
 * across feature modules while staying fully typed per entity.
 */
export class CrudService {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    get searchFields() {
        return this.cfg.searchFields;
    }
    async list(options) {
        return this.cfg.repository.list({ ...options, searchFields: this.cfg.searchFields });
    }
    async getById(id) {
        const entity = await this.cfg.repository.findById(id);
        if (!entity)
            throw AppError.notFound(`${this.cfg.resourceName} not found`);
        return entity;
    }
    async create(input, audit) {
        const validated = this.cfg.createSchema.parse(input);
        const data = await this.cfg.toEntity(validated);
        const entity = await this.cfg.repository.create({ data });
        await auditService.log(audit, `create:${this.cfg.resourceName}`, this.cfg.resourceName, entity.id);
        await this.cfg.afterCreate?.(entity, audit);
        return entity;
    }
    async update(id, input, audit) {
        const existing = await this.cfg.repository.findById(id);
        if (!existing)
            throw AppError.notFound(`${this.cfg.resourceName} not found`);
        const validated = this.cfg.updateSchema.parse(input);
        const data = await this.cfg.toEntity(validated, existing);
        const updated = await this.cfg.repository.update({ id, data });
        if (!updated)
            throw AppError.notFound(`${this.cfg.resourceName} not found`);
        await auditService.log(audit, `update:${this.cfg.resourceName}`, this.cfg.resourceName, id);
        return updated;
    }
    async delete(id, audit) {
        const existing = await this.cfg.repository.findById(id);
        if (!existing)
            throw AppError.notFound(`${this.cfg.resourceName} not found`);
        await this.cfg.beforeDelete?.(id);
        await this.cfg.repository.delete(id);
        await auditService.log(audit, `delete:${this.cfg.resourceName}`, this.cfg.resourceName, id);
        return { id };
    }
}
