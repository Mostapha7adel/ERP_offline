import { PrismaRepository, type PrismaModelDelegate } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
import type { User } from "./user.entity.js";

type Row = Record<string, unknown>;

export class UserRepository extends PrismaRepository<User> {
  protected model = "user";
  protected dateFields = ["lastLoginAt"];
  protected searchFields = ["name", "email", "phone"];

  protected get delegate(): PrismaModelDelegate {
    return getDb().user as unknown as PrismaModelDelegate;
  }

  protected toEntity(row: Row): User {
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      passwordHash: String(row.passwordHash),
      roleId: String(row.roleId),
      status: row.status as User["status"],
      mustChangePassword: Boolean(row.mustChangePassword),
      phone: row.phone ? String(row.phone) : undefined,
      jobTitle: row.jobTitle ? String(row.jobTitle) : undefined,
      avatarUrl: row.avatarUrl ? String(row.avatarUrl) : undefined,
      lastLoginAt: this.toISO(row.lastLoginAt),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const users = await this.findAll();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  async findByPhone(phone: string): Promise<User | undefined> {
    const value = phone.trim().toLowerCase();
    return (await this.findAll()).find((u) => u.phone && u.phone.toLowerCase() === value);
  }
}

export const userRepository = new UserRepository();
