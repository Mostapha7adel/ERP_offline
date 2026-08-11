import { prisma } from "./prisma.js";
import { AppError } from "../errors/app-error.js";
let cachedCompanyId;
/**
 * Resolve the default (first, active) company. Multi-company is supported by
 * the schema, but the app currently runs single-tenant, so repositories scope
 * writes to the default company and reads are scoped per company where needed.
 */
export async function getDefaultCompanyId() {
    if (cachedCompanyId)
        return cachedCompanyId;
    const company = await prisma.company.findFirst({
        where: { isActive: true, deletedAt: null },
        select: { id: true },
    });
    if (!company) {
        throw AppError.internal("No active company configured. Run seed first.");
    }
    cachedCompanyId = company.id;
    return company.id;
}
/** Clear the cached company id (used after restore). */
export function resetCompanyCache() {
    cachedCompanyId = undefined;
}
