/** Standard response envelope for every successful response. */
export function ok(data) {
    return { success: true, data };
}
export function paginated(data, meta) {
    return { success: true, data, meta };
}
export function computeMeta(page, limit, total) {
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
