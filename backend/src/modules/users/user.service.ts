import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { hashPassword } from "../../core/security/password.js";
import { auditService } from "../../core/audit/audit.service.js";
import { userRepository } from "./user.repository.js";
import { roleRepository } from "../roles/role.repository.js";
import {
  userCreateSchema,
  userUpdateSchema,
  profileUpdateSchema,
  publicUserSchema,
  type UserCreateInput,
  type UserUpdateInput,
  type ProfileUpdateInput,
  type PublicUser,
} from "./user.schema.js";
import type { User } from "./user.entity.js";
import type { BaseEntity } from "../../core/repository/base-repository.js";
import type { AuditContext } from "../../core/audit/audit.service.js";

export class UserService extends CrudService<User, UserCreateInput, UserUpdateInput> {
  constructor() {
    super({
      repository: userRepository,
      resourceName: "user",
      createSchema: userCreateSchema,
      updateSchema: userUpdateSchema,
      searchFields: ["name", "email", "phone"],
      toEntity: (input, existing) => {
        const entity: Omit<User, keyof BaseEntity> = {
          name: input.name ?? existing?.name ?? "",
          email: input.email ?? existing?.email ?? "",
          roleId: input.roleId ?? existing?.roleId ?? "",
          status: input.status ?? existing?.status ?? "active",
          mustChangePassword: existing?.mustChangePassword ?? false,
          phone: input.phone ?? existing?.phone,
          jobTitle: input.jobTitle ? (input.jobTitle as string) : existing?.jobTitle,
          avatarUrl: input.avatarUrl ? (input.avatarUrl as string) : existing?.avatarUrl,
          passwordHash: existing?.passwordHash ?? "",
          lastLoginAt: existing?.lastLoginAt,
        };
        return entity;
      },
    });
  }

  override async create(input: UserCreateInput, audit: AuditContext): Promise<User> {
    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail) {
      throw AppError.conflict(`User with email "${input.email}" already exists`);
    }
    if (input.phone && (await userRepository.findByPhone(input.phone))) {
      throw AppError.conflict(`User with phone "${input.phone}" already exists`);
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
        mustChangePassword: false,
        phone: input.phone,
        jobTitle: input.jobTitle || undefined,
        avatarUrl: input.avatarUrl || undefined,
      },
    });
    return user;
  }

  override async update(id: string, input: UserUpdateInput, audit: AuditContext): Promise<User> {
    const existing = await userRepository.findById(id);
    if (!existing) throw AppError.notFound("user not found");

    if (input.email) {
      const clash = await userRepository.findByEmail(input.email);
      if (clash && clash.id !== id) {
        throw AppError.conflict(`User with email "${input.email}" already exists`);
      }
    }
    if (input.phone) {
      const clash = await userRepository.findByPhone(input.phone);
      if (clash && clash.id !== id) {
        throw AppError.conflict(`User with phone "${input.phone}" already exists`);
      }
    }
    if (input.roleId && input.roleId !== existing.roleId) {
      await this.assertRoleExists(input.roleId);
    }

    return super.update(id, input, audit);
  }

  override async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await userRepository.findById(id);
    if (!existing) throw AppError.notFound("user not found");
    if (existing.email === "admin@ledgerflow.local") {
      throw AppError.forbidden("The primary admin account cannot be deleted");
    }
    return super.delete(id, audit);
  }

  async setStatus(id: string, status: "active" | "inactive", audit: AuditContext): Promise<PublicUser> {
    const updated = await userRepository.update({ id, data: { status } });
    if (!updated) throw AppError.notFound("user not found");
    return this.toPublic(updated);
  }

  async resetPassword(id: string, password: string, audit: AuditContext): Promise<void> {
    const existing = await userRepository.findById(id);
    if (!existing) throw AppError.notFound("user not found");
    const passwordHash = await hashPassword(password);
    await userRepository.update({ id, data: { passwordHash } });
  }

  /** A user updating their own profile (name, phone, job title, avatar). */
  async updateProfile(actorId: string, input: ProfileUpdateInput, audit: AuditContext): Promise<PublicUser> {
    const validated = profileUpdateSchema.parse(input);
    const existing = await userRepository.findById(actorId);
    if (!existing) throw AppError.notFound("user not found");

    if (validated.phone) {
      const clash = await userRepository.findByPhone(validated.phone);
      if (clash && clash.id !== actorId) {
        throw AppError.conflict(`User with phone "${validated.phone}" already exists`);
      }
    }

    const updated = await userRepository.update({
      id: actorId,
      data: {
        name: validated.name ?? existing.name,
        phone: validated.phone !== undefined ? validated.phone : existing.phone,
        jobTitle: validated.jobTitle !== undefined ? validated.jobTitle : existing.jobTitle,
        avatarUrl: validated.avatarUrl !== undefined ? validated.avatarUrl : existing.avatarUrl,
      },
    });
    if (!updated) throw AppError.notFound("user not found");
    await auditService.log(audit, "update:profile", "user", actorId);
    return this.toPublic(updated);
  }

  /** Project a user for client consumption (strip passwordHash, join role). */
  async toPublic(user: User): Promise<PublicUser> {
    const role = await roleRepository.findById(user.roleId);
    return publicUserSchema.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      status: user.status,
      phone: user.phone,
      jobTitle: user.jobTitle,
      avatarUrl: user.avatarUrl,
      lastLoginAt: user.lastLoginAt,
      roleName: role?.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  private async assertRoleExists(roleId: string): Promise<void> {
    if (!(await roleRepository.findById(roleId))) {
      throw AppError.badRequest(`Role "${roleId}" does not exist`);
    }
  }
}

export const userService = new UserService();
export type { PublicUser };
