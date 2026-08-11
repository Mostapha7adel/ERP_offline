import { z } from "zod";

/**
 * Shared query contract for paginated list endpoints.
 * Supports pagination, sorting, free-text search and structured filtering.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  // Structured filter, e.g. `status=active` or `status=active&status=archived`.
  // Multiple values for the same key become an OR / IN filter.
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface ParsedListOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  search?: string;
  filters: Record<string, string[]>;
}

export const SORT_DIRS = ["asc", "desc"] as const;

/** Parse a raw Fastify querystring into normalized list options. */
export function parseListOptions(
  query: Record<string, unknown>,
): ParsedListOptions {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
  const sortBy = typeof query.sortBy === "string" && query.sortBy.length > 0 ? query.sortBy : "createdAt";
  const sortDir: "asc" | "desc" = query.sortDir === "asc" ? "asc" : "desc";
  const search = typeof query.search === "string" && query.search.trim().length > 0
    ? query.search.trim()
    : undefined;

  const filters: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (["page", "limit", "sortBy", "sortDir", "search"].includes(key)) continue;
    if (typeof value === "string" && value.trim().length > 0) {
      filters[key] = [value.trim()];
    } else if (Array.isArray(value)) {
      filters[key] = value.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
  }

  return { page, limit, sortBy, sortDir, search, filters };
}

export const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

export function singleResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: itemSchema,
  });
}

export function successResponseSchema(message = "OK") {
  return z.object({
    success: z.literal(true),
    message: z.string().default(message),
  });
}
