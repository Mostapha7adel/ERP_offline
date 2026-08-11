import { getDb } from "../database/prisma.js";
import { getDefaultCompanyId } from "../database/company.js";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RepositoryCreate<T> {
  /** full entity minus auto fields (id, createdAt, updatedAt) */
  data: Omit<T, keyof BaseEntity>;
  now?: string;
}

export interface RepositoryUpdate<T> {
  id: string;
  data: Partial<Omit<T, keyof BaseEntity>>;
  now?: string;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  search?: string;
  /** fields searched by the free-text `search` term */
  searchFields?: string[];
  /** equality filters keyed by field name (values may be arrays = IN) */
  filters?: Record<string, string[]>;
}

/** Default shared sorting key. */
export const DEFAULT_SORT = "createdAt";

/**
 * Data-access contract every repository must satisfy.
 * All operations are async and persist through Prisma + SQLite.
 */
export interface BaseRepository<T extends BaseEntity> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | undefined>;
  findOne(predicate: (item: T) => boolean): Promise<T | undefined>;
  create(input: RepositoryCreate<T>): Promise<T>;
  update(input: RepositoryUpdate<T>): Promise<T | undefined>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  list(options?: ListOptions): Promise<ListResult<T>>;
}

type AnyRow = Record<string, unknown>;

/** Prisma model delegate shape used by the generic repository. */
export interface PrismaModelDelegate {
  findMany(args?: Record<string, unknown>): Promise<AnyRow[]>;
  findFirst(args?: Record<string, unknown>): Promise<AnyRow | null>;
  findUnique(args?: Record<string, unknown>): Promise<AnyRow | null>;
  create(args: Record<string, unknown>): Promise<AnyRow>;
  update(args: Record<string, unknown>): Promise<AnyRow>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  delete(args: Record<string, unknown>): Promise<AnyRow>;
  deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
  count(args?: Record<string, unknown>): Promise<number>;
}

/**
 * Generic Prisma-backed repository. Subclasses provide the Prisma model
 * delegate, the entity mapping hooks and the model's specifics (soft delete,
 * company scoping, date fields, search fields).
 *
 * Listing keeps the same filter / search / sort / pagination semantics as the
 * previous in-memory adapter so service behaviour is preserved.
 */
export abstract class PrismaRepository<T extends BaseEntity> implements BaseRepository<T> {
  /** Prisma model accessor name, e.g. "user", "invoice". */
  protected abstract model: string;
  /** Whether the model has a `deletedAt` column (soft delete). */
  protected softDelete = true;
  /** Whether rows carry a `companyId` that should be set on create. */
  protected companyScoped = true;
  /** Entity fields stored as DateTime in the DB (ISO strings in the entity). */
  protected dateFields: string[] = [];
  /** Relations to include when reading rows. */
  protected include?: Record<string, unknown>;
  /** Default free-text search fields for `list`. */
  protected searchFields: string[] = [];

  protected get delegate(): PrismaModelDelegate {
    return (getDb() as unknown as Record<string, PrismaModelDelegate>)[this.model];
  }

  protected baseWhere(): Record<string, unknown> {
    if (!this.softDelete) return {};
    return { deletedAt: null };
  }

  protected toISO(value: unknown): string | undefined {
    if (!value) return undefined;
    return value instanceof Date ? value.toISOString() : String(value);
  }

  protected toDate(value: string | Date | undefined | null): Date | undefined {
    if (!value) return undefined;
    return typeof value === "string" ? new Date(value) : value;
  }

  /** Map a Prisma row to the domain entity (ISO date strings, drop db-only fields). */
  protected abstract toEntity(row: AnyRow): T;

  /** Map entity data to Prisma create payload (enum + date conversions). */
  protected toCreateData(data: Omit<T, keyof BaseEntity>): Record<string, unknown> {
    return this.convertDates(data);
  }

  /** Map entity data to Prisma update payload. */
  protected toUpdateData(data: Partial<Omit<T, keyof BaseEntity>>): Record<string, unknown> {
    return this.convertDates(data);
  }

  /** Convert ISO date fields (listed in `dateFields`) to Date instances. */
  protected convertDates(data: Record<string, unknown>): Record<string, unknown> {
    if (this.dateFields.length === 0) return { ...data };
    const out: Record<string, unknown> = { ...data };
    for (const field of this.dateFields) {
      if (out[field] !== undefined && out[field] !== null) {
        out[field] = this.toDate(out[field] as string);
      }
    }
    return out;
  }

  protected async rowToEntity(row: AnyRow): Promise<T> {
    return this.toEntity(row);
  }

  async findAll(): Promise<T[]> {
    const rows = await this.delegate.findMany({
      where: this.baseWhere(),
      ...(this.include ? { include: this.include } : {}),
    });
    return Promise.all(rows.map((row) => this.rowToEntity(row)));
  }

  async findById(id: string): Promise<T | undefined> {
    const row = await this.delegate.findFirst({
      where: { ...this.baseWhere(), id },
      ...(this.include ? { include: this.include } : {}),
    });
    return row ? this.rowToEntity(row) : undefined;
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | undefined> {
    const all = await this.findAll();
    return all.find(predicate);
  }

  async create(input: RepositoryCreate<T>): Promise<T> {
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

  async update(input: RepositoryUpdate<T>): Promise<T | undefined> {
    const existing = await this.delegate.findFirst({
      where: { ...this.baseWhere(), id: input.id },
    });
    if (!existing) return undefined;

    const now = input.now ?? new Date().toISOString();
    const data = this.toUpdateData(input.data);
    const row = await this.delegate.update({
      where: { id: input.id },
      data: { ...data, updatedAt: new Date(now) },
      ...(this.include ? { include: this.include } : {}),
    });
    return this.rowToEntity(row);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.delegate.findFirst({
      where: { ...this.baseWhere(), id },
    });
    if (!existing) return false;

    if (this.softDelete) {
      await this.delegate.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } else {
      await this.delegate.delete({ where: { id } });
    }
    return true;
  }

  async count(): Promise<number> {
    return this.delegate.count({ where: this.baseWhere() });
  }

  async list(options: ListOptions = {}): Promise<ListResult<T>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const sortBy = options.sortBy ?? DEFAULT_SORT;
    const sortDir: "asc" | "desc" = options.sortDir ?? "desc";
    const search = options.search?.trim().toLowerCase();
    const searchFields = options.searchFields ?? this.searchFields;
    const filters = options.filters ?? {};

    const all = await this.findAll();

    // Filtering (IN / equality)
    const filterKeys = Object.keys(filters);
    let items = all;
    if (filterKeys.length > 0) {
      items = items.filter((item) =>
        filterKeys.every((key) => {
          const values = filters[key];
          const value = (item as Record<string, unknown>)[key];
          return values.includes(String(value));
        }),
      );
    }

    // Free-text search
    if (search && searchFields.length > 0) {
      items = items.filter((item) =>
        searchFields.some((field) => {
          const value = (item as Record<string, unknown>)[field];
          return typeof value === "string" && value.toLowerCase().includes(search);
        }),
      );
    }

    const total = items.length;

    // Sorting
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...items].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortBy];
      const bv = (b as Record<string, unknown>)[sortBy];
      if (av == null && bv == null) return 0;
      if (av == null) return 1 * dir;
      if (bv == null) return -1 * dir;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
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
