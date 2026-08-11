import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { hashPassword } from "../../core/security/password.js";
import { userRepository } from "./user.repository.js";
import { roleRepository } from "../roles/role.repository.js";
import { userCreateSchema, userUpdateSchema, publicUserSchema, } from "./user.schema.js";
export class UserService extends CrudService {
    constructor() {
        super({
            repository: userRepository,
            resourceName: "user",
            createSchema: userCreateSchema,
            updateSchema: userUpdateSchema,
            searchFields: ["name", "email", "phone"],
            toEntity: (input, existing) => {
                const entity = {
                    name: input.name ?? existing?.name ?? "",
                    email: input.email ?? existing?.email ?? "",
                    roleId: input.roleId ?? existing?.roleId ?? "",
                    status: input.status ?? existing?.status ?? "active",
                    phone: input.phone ?? existing?.phone,
                    avatarUrl: input.avatarUrl ? input.avatarUrl : existing?.avatarUrl,
                    passwordHash: existing?.passwordHash ?? "",
                    lastLoginAt: existing?.lastLoginAt,
                };
                return entity;
            },
        });
    }
    async create(input, audit) {
        const existingEmail = await userRepository.findByEmail(input.email);
        if (existingEmail) {
            throw AppError.conflict(`User with email "${input.email}" already exists`);
        }
        await this.assertRoleExists(input.roleId);
        const passwordHash = await hashPassword(input.password);
        const user = await userRepository.create({
            data: {
                name: input.name,
                email: input.email,
                passwordHash,
                roleId: input.roleId,
                status: input.status ?? "active",
                phone: input.phone,
                avatarUrl: input.avatarUrl || undefined,
            },
        });
        return user;
    }
    async update(id, input, audit) {
        const existing = await userRepository.findById(id);
        if (!existing)
            throw AppError.notFound("user not found");
        if (input.email) {
            const clash = await userRepository.findByEmail(input.email);
            if (clash && clash.id !== id) {
                throw AppError.conflict(`User with email "${input.email}" already exists`);
            }
        }
        if (input.roleId && input.roleId !== existing.roleId) {
            await this.assertRoleExists(input.roleId);
        }
        return super.update(id, input, audit);
    }
    async delete(id, audit) {
        const existing = await userRepository.findById(id);
        if (!existing)
            throw AppError.notFound("user not found");
        if (existing.email === "admin@ledgerflow.local") {
            throw AppError.forbidden("The primary admin account cannot be deleted");
        }
        return super.delete(id, audit);
    }
    async setStatus(id, status, audit) {
        const updated = await userRepository.update({ id, data: { status } });
        if (!updated)
            throw AppError.notFound("user not found");
        return this.toPublic(updated);
    }
    async resetPassword(id, password, audit) {
        const existing = await userRepository.findById(id);
        if (!existing)
            throw AppError.notFound("user not found");
        const passwordHash = await hashPassword(password);
        await userRepository.update({ id, data: { passwordHash } });
    }
    /** Project a user for client consumption (strip passwordHash, join role). */
    async toPublic(user) {
        const role = await roleRepository.findById(user.roleId);
        return publicUserSchema.parse({
            id: user.id,
            name: user.name,
            email: user.email,
            roleId: user.roleId,
            status: user.status,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            lastLoginAt: user.lastLoginAt,
            roleName: role?.name,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    }
    async assertRoleExists(roleId) {
        if (!(await roleRepository.findById(roleId))) {
            throw AppError.badRequest(`Role "${roleId}" does not exist`);
        }
    }
}
export const userService = new UserService();
