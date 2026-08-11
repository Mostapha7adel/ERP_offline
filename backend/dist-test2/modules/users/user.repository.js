import { PrismaRepository } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
export class UserRepository extends PrismaRepository {
    model = "user";
    dateFields = ["lastLoginAt"];
    searchFields = ["name", "email", "phone"];
    get delegate() {
        return getDb().user;
    }
    toEntity(row) {
        return {
            id: String(row.id),
            name: String(row.name),
            email: String(row.email),
            passwordHash: String(row.passwordHash),
            roleId: String(row.roleId),
            status: row.status,
            phone: row.phone ? String(row.phone) : undefined,
            avatarUrl: row.avatarUrl ? String(row.avatarUrl) : undefined,
            lastLoginAt: this.toISO(row.lastLoginAt),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    async findByEmail(email) {
        const users = await this.findAll();
        return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    }
}
export const userRepository = new UserRepository();
