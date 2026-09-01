import { getDb } from "../../core/database/prisma.js";

interface RolePageAssignmentEntity {
  id: string;
  roleId: string;
  pages: string[];
  createdAt: string;
  updatedAt: string;
}

interface UserPageAssignmentEntity {
  id: string;
  userId: string;
  pages: string[];
  createdAt: string;
  updatedAt: string;
}

function parsePages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  }
  return [];
}

export class RolePageAssignmentRepository {
  async getByRoleId(roleId: string): Promise<RolePageAssignmentEntity | undefined> {
    const row = await getDb().$queryRawUnsafe(
      'SELECT * FROM "RolePageAssignment" WHERE "roleId" = ? LIMIT 1',
      roleId
    ) as any[];
    if (!row || row.length === 0) return undefined;
    return this.toEntity(row[0]);
  }

  async findAll(): Promise<RolePageAssignmentEntity[]> {
    const rows = await getDb().$queryRawUnsafe(
      'SELECT * FROM "RolePageAssignment"'
    ) as any[];
    return rows.map((r) => this.toEntity(r));
  }

  async upsert(roleId: string, pages: string[]): Promise<RolePageAssignmentEntity> {
    const existing = await this.getByRoleId(roleId);
    const pagesStr = JSON.stringify(pages);
    const now = new Date();
    if (existing) {
      await getDb().$executeRawUnsafe(
        'UPDATE "RolePageAssignment" SET "pages" = ?, "updatedAt" = ? WHERE "id" = ?',
        pagesStr, now, existing.id
      );
      return { ...existing, pages, updatedAt: now.toISOString() };
    }
    const id = crypto.randomUUID();
    await getDb().$executeRawUnsafe(
      'INSERT INTO "RolePageAssignment" ("id", "roleId", "pages", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)',
      id, roleId, pagesStr, now, now
    );
    return { id, roleId, pages, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  }

  async deleteByRoleId(roleId: string): Promise<void> {
    await getDb().$executeRawUnsafe(
      'DELETE FROM "RolePageAssignment" WHERE "roleId" = ?',
      roleId
    );
  }

  private toEntity(row: any): RolePageAssignmentEntity {
    return {
      id: String(row.id),
      roleId: String(row.roleId),
      pages: parsePages(row.pages),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    };
  }
}

export class UserPageAssignmentRepository {
  async getByUserId(userId: string): Promise<UserPageAssignmentEntity | undefined> {
    const row = await getDb().$queryRawUnsafe(
      'SELECT * FROM "UserPageAssignment" WHERE "userId" = ? LIMIT 1',
      userId
    ) as any[];
    if (!row || row.length === 0) return undefined;
    return this.toEntity(row[0]);
  }

  async findAll(): Promise<UserPageAssignmentEntity[]> {
    const rows = await getDb().$queryRawUnsafe(
      'SELECT * FROM "UserPageAssignment"'
    ) as any[];
    return rows.map((r) => this.toEntity(r));
  }

  async upsert(userId: string, pages: string[]): Promise<UserPageAssignmentEntity> {
    const existing = await this.getByUserId(userId);
    const pagesStr = JSON.stringify(pages);
    const now = new Date();
    if (existing) {
      await getDb().$executeRawUnsafe(
        'UPDATE "UserPageAssignment" SET "pages" = ?, "updatedAt" = ? WHERE "id" = ?',
        pagesStr, now, existing.id
      );
      return { ...existing, pages, updatedAt: now.toISOString() };
    }
    const id = crypto.randomUUID();
    await getDb().$executeRawUnsafe(
      'INSERT INTO "UserPageAssignment" ("id", "userId", "pages", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)',
      id, userId, pagesStr, now, now
    );
    return { id, userId, pages, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  }

  async deleteByUserId(userId: string): Promise<void> {
    await getDb().$executeRawUnsafe(
      'DELETE FROM "UserPageAssignment" WHERE "userId" = ?',
      userId
    );
  }

  private toEntity(row: any): UserPageAssignmentEntity {
    return {
      id: String(row.id),
      userId: String(row.userId),
      pages: parsePages(row.pages),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    };
  }
}

export const rolePageAssignmentRepository = new RolePageAssignmentRepository();
export const userPageAssignmentRepository = new UserPageAssignmentRepository();
