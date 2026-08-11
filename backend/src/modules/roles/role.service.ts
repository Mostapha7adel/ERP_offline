import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { roleRepository } from "./role.repository.js";
import { roleCreateSchema, roleUpdateSchema, type RoleCreateInput, type RoleUpdateInput } from "./role.schema.js";
import type { Role } from "./role.entity.js";
import type { BaseEntity } from "../../core/repository/base-repository.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { userRepository } from "../users/user.repository.js";

export class RoleService extends CrudService<Role, RoleCreateInput, RoleUpdateInput> {
  constructor() {
    super({
      repository: roleRepository,
      resourceName: "role",
      createSchema: roleCreateSchema,
      updateSchema: roleUpdateSchema,
      searchFields: ["name", "description"],
      toEntity: (input, existing) => {
        return {
          name: input.name ?? existing?.name ?? "",
          description: input.description ?? existing?.description,
          avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existing?.avatarUrl,
          permissions: input.permissions ?? existing?.permissions ?? [],
          isSystem: existing?.isSystem,
        } as Omit<Role, keyof BaseEntity>;
      },
      beforeDelete: async (id) => {
        const role = await roleRepository.findById(id);
        if (role?.isSystem) {
          throw AppError.forbidden("System roles cannot be deleted");
        }
        const inUse = await usersUsingRole(id);
        if (inUse) {
          throw AppError.conflict(`Role is assigned to user "${inUse}"`);
        }
      },
    });
  }

  async create(input: RoleCreateInput, audit: AuditContext): Promise<Role> {
    if (await roleRepository.findByName(input.name)) {
      throw AppError.conflict(`Role "${input.name}" already exists`);
    }
    return super.create(input, audit);
  }

  async update(id: string, input: RoleUpdateInput, audit: AuditContext): Promise<Role> {
    if (input.name) {
      const clash = await roleRepository.findByName(input.name);
      if (clash && clash.id !== id) {
        throw AppError.conflict(`Role "${input.name}" already exists`);
      }
    }
    return super.update(id, input, audit);
  }
}

/** Prevents deleting a role that is still assigned to users. */
async function usersUsingRole(roleId: string): Promise<string | undefined> {
  return (await userRepository.findAll()).find((u) => u.roleId === roleId)?.name;
}

export const roleService = new RoleService();
