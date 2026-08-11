import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { roleRepository } from "./role.repository.js";
import { roleCreateSchema, roleUpdateSchema } from "./role.schema.js";
import { userRepository } from "../users/user.repository.js";
export class RoleService extends CrudService {
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
                    permissions: input.permissions ?? existing?.permissions ?? [],
                    isSystem: existing?.isSystem,
                };
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
    async create(input, audit) {
        if (await roleRepository.findByName(input.name)) {
            throw AppError.conflict(`Role "${input.name}" already exists`);
        }
        return super.create(input, audit);
    }
    async update(id, input, audit) {
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
async function usersUsingRole(roleId) {
    return (await userRepository.findAll()).find((u) => u.roleId === roleId)?.name;
}
export const roleService = new RoleService();
