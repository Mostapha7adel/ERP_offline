/** Standard response envelope for every successful response. */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function ok<T>(data: T) {
  return { success: true as const, data };
}

export function paginated<T>(data: T[], meta: PaginationMeta) {
  return { success: true as const, data, meta };
}

export function computeMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
