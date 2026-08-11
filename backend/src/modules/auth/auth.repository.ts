import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { AuthSession } from "./auth.entity.js";

type Row = Record<string, unknown>;

export class SessionRepository extends PrismaRepository<AuthSession> {
  protected model = "authSession";
  protected softDelete = false;
  protected companyScoped = false;
  protected dateFields = ["expiresAt"];
  protected searchFields = ["token", "ip"];

  protected toEntity(row: Row): AuthSession {
    return {
      id: String(row.id),
      userId: String(row.userId),
      token: String(row.token),
      expiresAt: this.toISO(row.expiresAt)!,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      ip: row.ip ? String(row.ip) : undefined,
      userAgent: row.userAgent ? String(row.userAgent) : undefined,
    };
  }

  async findByToken(token: string): Promise<AuthSession | undefined> {
    const rows = await this.delegate.findMany({ where: { token } });
    if (rows.length === 0) return undefined;
    return this.toEntity(rows[0] as Row);
  }

  async findByUserId(userId: string): Promise<AuthSession[]> {
    const rows = await this.delegate.findMany({ where: { userId } });
    return rows.map((row) => this.toEntity(row as Row));
  }

  async deleteByToken(token: string): Promise<boolean> {
    const existing = await this.delegate.findFirst({ where: { token } });
    if (!existing) return false;
    await this.delegate.delete({ where: { id: String(existing.id) } });
    return true;
  }
}

export const sessionRepository = new SessionRepository();
