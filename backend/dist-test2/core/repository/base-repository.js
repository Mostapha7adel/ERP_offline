import { getDb } from "../database/prisma.js";
import { getDefaultCompanyId } from "../database/company.js";
/** Default shared sorting key. */
export const DEFAULT_SORT = "createdAt";
/**
 * Generic Prisma-backed repository. Subclasses provide the Prisma model
 * delegate, the entity mapping hooks and the model's specifics (soft delete,
 * company scoping, date fields, search fields).
 *
 * Listing keeps the same filter / search / sort / pagination semantics as the
 * previous in-memory adapter so service behaviour is preserved.
 */
export class PrismaRepository {
    /** Whether the model has a `deletedAt` column (soft delete). */
    softDelete = true;
    /** Whether rows carry a `companyId` that should be set on create. */
    companyScoped = true;
    /** Entity fields stored as DateTime in the DB (ISO strings in the entity). */
    dateFields = [];
    /** Relations to include when reading rows. */
    include;
    /** Default free-text search fields for `list`. */
    searchFields = [];
    get delegate() {
        return getDb()[this.model];
    }
    baseWhere() {
        if (!this.softDelete)
            return {};
        return { deletedAt: null };
    }
    toISO(value) {
        if (!value)
            return undefined;
        return value instanceof Date ? value.toISOString() : String(value);
    }
    toDate(value) {
        if (!value)
            return undefined;
        return typeof value === "string" ? new Date(value) : value;
    }
    /** Map entity data to Prisma create payload (enum + date conversions). */
    toCreateData(data) {
        return this.convertDates(data);
    }
    /** Map entity data to Prisma update payload. */
    toUpdateData(data) {
        return this.convertDates(data);
    }
    /** Convert ISO date fields (listed in `dateFields`) to Date instances. */
    convertDates(data) {
        if (this.dateFields.length === 0)
            return { ...data };
        const out = { ...data };
        for (const field of this.dateFields) {
            if (out[field] !== undefined && out[field] !== null) {
                out[field] = this.toDate(out[field]);
            }
        }
        return out;
    }
    async rowToEntity(row) {
        return this.toEntity(row);
    }
    async findAll() {
        const rows = await this.delegate.findMany({
            where: this.baseWhere(),
            ...(this.include ? { include: this.include } : {}),
        });
        return Promise.all(rows.map((row) => this.rowToEntity(row)));
    }
    async findById(id) {
        const row = await this.delegate.findFirst({
            where: { ...this.baseWhere(), id },
            ...(this.include ? { include: this.include } : {}),
        });
        return row ? this.rowToEntity(row) : undefined;
    }
    async findOne(predicate) {
        const all = await this.findAll();
        return all.find(predicate);
    }
    async create(input) {
        const now = input.now ?? new Date().toISOString();
        const companyId = this.companyScoped ? await getDefaultCompanyId() : undefined;
        const data = this.toCreateData(input.data);
        const row = await this.delegate.create({
            data: {
                ...data,
                ...(companyId ? { companyId } : {}),
                id: crypto.randomUUID(),
                createdAt: new Date(now),
                updatedAt: new Date(now),
            },
            ...(this.include ? { include: this.include } : {}),
        });
        return this.rowToEntity(row);
    }
    async update(input) {
        const existing = await this.delegate.findFirst({
            where: { ...this.baseWhere(), id: input.id },
        });
        if (!existing)
            return undefined;
        const now = input.now ?? new Date().toISOString();
        const data = this.toUpdateData(input.data);
        const row = await this.delegate.update({
            where: { id: input.id },
            data: { ...data, updatedAt: new Date(now) },
            ...(this.include ? { include: this.include } : {}),
        });
        return this.rowToEntity(row);
    }
    async delete(id) {
        const existing = await this.delegate.findFirst({
            where: { ...this.baseWhere(), id },
        });
        if (!existing)
            return false;
        if (this.softDelete) {
            await this.delegate.update({
                where: { id },
                data: { deletedAt: new Date() },
            });
        }
        else {
            await this.delegate.delete({ where: { id } });
        }
        return true;
    }
    async count() {
        return this.delegate.count({ where: this.baseWhere() });
    }
    async list(options = {}) {
        const page = Math.max(1, options.page ?? 1);
        const limit = Math.min(100, Math.max(1, options.limit ?? 20));
        const sortBy = options.sortBy ?? DEFAULT_SORT;
        const sortDir = options.sortDir ?? "desc";
        const search = options.search?.trim().toLowerCase();
        const searchFields = options.searchFields ?? this.searchFields;
        const filters = options.filters ?? {};
        const all = await this.findAll();
        // Filtering (IN / equality)
        const filterKeys = Object.keys(filters);
        let items = all;
        if (filterKeys.length > 0) {
            items = items.filter((item) => filterKeys.every((key) => {
                const values = filters[key];
                const value = item[key];
                return values.includes(String(value));
            }));
        }
        // Free-text search
        if (search && searchFields.length > 0) {
            items = items.filter((item) => searchFields.some((field) => {
                const value = item[field];
                return typeof value === "string" && value.toLowerCase().includes(search);
            }));
        }
        const total = items.length;
        // Sorting
        const dir = sortDir === "asc" ? 1 : -1;
        const sorted = [...items].sort((a, b) => {
            const av = a[sortBy];
            const bv = b[sortBy];
            if (av == null && bv == null)
                return 0;
            if (av == null)
                return 1 * dir;
            if (bv == null)
                return -1 * dir;
            if (typeof av === "number" && typeof bv === "number")
                return (av - bv) * dir;
            return String(av).localeCompare(String(bv)) * dir;
        });
        // Pagination
        const start = (page - 1) * limit;
        const itemsPage = sorted.slice(start, start + limit);
        return {
            items: itemsPage,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
}
