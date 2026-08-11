import { PrismaRepository } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
function toPermissions(row) {
    return (row.permissions ?? [])
        .map((p) => p.permission?.code)
        .filter((code) => typeof code === "string");
}
export class RoleRepository extends PrismaRepository {
    model = "role";
    searchFields = ["name", "description"];
    include = { permissions: { include: { permission: true } } };
    get delegate() {
        return getDb().role;
    }
    toEntity(row) {
        return {
            id: String(row.id),
            name: String(row.name),
            description: row.description ? String(row.description) : undefined,
            permissions: toPermissions(row),
            isSystem: row.isSystem ? Boolean(row.isSystem) : undefined,
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    async findByName(name) {
        const roles = await this.findAll();
        return roles.find((r) => r.name.toLowerCase() === name.toLowerCase());
    }
    async resolvePermissionId(code) {
        const perm = await getDb().permission.upsert({
            where: { code },
            update: {},
            create: { code, description: code, group: "rbac" },
            select: { id: true },
        });
        return perm.id;
    }
    async create(input) {
        const now = input.now ?? new Date().toISOString();
        const companyId = await getDefaultCompanyId();
        const { permissions = [], ...rest } = input.data;
        const ids = await Promise.all(permissions.map((code) => this.resolvePermissionId(code)));
        const row = await this.delegate.create({
            data: {
                ...rest,
                companyId,
                id: crypto.randomUUID(),
                createdAt: new Date(now),
                updatedAt: new Date(now),
                permissions: { create: ids.map((permissionId) => ({ permissionId })) },
            },
            include: this.include,
        });
        return this.toEntity(row);
    }
    async update(input) {
        const existing = await this.delegate.findFirst({
            where: { deletedAt: null, id: input.id },
            select: { id: true },
        });
        if (!existing)
            return undefined;
        const now = input.now ?? new Date().toISOString();
        const { permissions, ...rest } = input.data;
        const updateData = { ...rest, updatedAt: new Date(now) };
        if (permissions) {
            const ids = await Promise.all(permissions.map((code) => this.resolvePermissionId(code)));
            updateData.permissions = {
                deleteMany: {},
                create: ids.map((permissionId) => ({ permissionId })),
            };
        }
        const row = await this.delegate.update({
            where: { id: input.id },
            data: updateData,
            include: this.include,
        });
        return this.toEntity(row);
    }
}
export const roleRepository = new RoleRepository();
