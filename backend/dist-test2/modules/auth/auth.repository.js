import { PrismaRepository } from "../../core/repository/base-repository.js";
export class SessionRepository extends PrismaRepository {
    model = "authSession";
    softDelete = false;
    companyScoped = false;
    dateFields = ["expiresAt"];
    searchFields = ["token", "ip"];
    toEntity(row) {
        return {
            id: String(row.id),
            userId: String(row.userId),
            token: String(row.token),
            expiresAt: this.toISO(row.expiresAt),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
            ip: row.ip ? String(row.ip) : undefined,
            userAgent: row.userAgent ? String(row.userAgent) : undefined,
        };
    }
    async findByToken(token) {
        const rows = await this.delegate.findMany({ where: { token } });
        if (rows.length === 0)
            return undefined;
        return this.toEntity(rows[0]);
    }
    async findByUserId(userId) {
        const rows = await this.delegate.findMany({ where: { userId } });
        return rows.map((row) => this.toEntity(row));
    }
    async deleteByToken(token) {
        const existing = await this.delegate.findFirst({ where: { token } });
        if (!existing)
            return false;
        await this.delegate.delete({ where: { id: String(existing.id) } });
        return true;
    }
}
export const sessionRepository = new SessionRepository();
