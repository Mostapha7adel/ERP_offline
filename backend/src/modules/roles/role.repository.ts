import { PrismaRepository, type PrismaModelDelegate } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import type { Role } from "./role.entity.js";

type Row = Record<string, unknown>;
type RoleRow = Row & { permissions?: Array<{ permission?: { code?: string } }> };

function toPermissions(row: RoleRow): string[] {
  return (row.permissions ?? [])
    .map((p) => p.permission?.code)
    .filter((code): code is string => typeof code === "string");
}

export class RoleRepository extends PrismaRepository<Role> {
  protected model = "role";
  protected searchFields = ["name", "description"];
  protected include = { permissions: { include: { permission: true } } };

  protected get delegate(): PrismaModelDelegate {
    return getDb().role as unknown as PrismaModelDelegate;
  }

  protected toEntity(row: RoleRow): Role {
    return {
      id: String(row.id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      avatarUrl: row.avatarUrl ? String(row.avatarUrl) : undefined,
      permissions: toPermissions(row),
      isSystem: row.isSystem ? Boolean(row.isSystem) : undefined,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByName(name: string): Promise<Role | undefined> {
    const roles = await this.findAll();
    return roles.find((r) => r.name.toLowerCase() === name.toLowerCase());
  }

  private async resolvePermissionId(code: string): Promise<string> {
    const perm = await getDb().permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code, group: "rbac" },
      select: { id: true },
    });
    return perm.id;
  }

  override async create(input: { data: Omit<Role, keyof { id: string; createdAt: string; updatedAt: string }>; now?: string }): Promise<Role> {
    const now = input.now ?? new Date().toISOString();
    const companyId = await getDefaultCompanyId();
    const { permissions = [], ...rest } = input.data;
    const ids = await Promise.all(permissions.map((code) => this.resolvePermissionId(code)));
    const row = await this.delegate.create({
      data: {
        ...(rest as Record<string, unknown>),
        companyId,
        id: crypto.randomUUID(),
        createdAt: new Date(now),
        updatedAt: new Date(now),
        permissions: { create: ids.map((permissionId) => ({ permissionId })) },
      },
      include: this.include,
    });
    return this.toEntity(row as RoleRow);
  }

  override async update(input: { id: string; data: Partial<Omit<Role, keyof { id: string; createdAt: string; updatedAt: string }>>; now?: string }): Promise<Role | undefined> {
    const existing = await this.delegate.findFirst({
      where: { deletedAt: null, id: input.id },
      select: { id: true },
    });
    if (!existing) return undefined;

    const now = input.now ?? new Date().toISOString();
    const { permissions, ...rest } = input.data;
    const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date(now) };
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
    return this.toEntity(row as RoleRow);
  }
}

export const roleRepository = new RoleRepository();
