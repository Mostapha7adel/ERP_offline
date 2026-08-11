import { PrismaRepository, type ListOptions, type ListResult } from "../../core/repository/base-repository.js";
import type { NotificationEntry } from "./notification.entity.js";

type Row = Record<string, unknown>;

export class NotificationRepository extends PrismaRepository<NotificationEntry> {
  protected model = "notification";
  protected softDelete = false;
  protected searchFields = ["title", "message", "actorName", "resource"];

  protected toEntity(row: Row): NotificationEntry {
    return {
      id: String(row.id),
      kind: (row.kind as NotificationEntry["kind"]) ?? "info",
      title: String(row.title),
      message: String(row.message),
      resource: row.resource ? String(row.resource) : undefined,
      resourceId: row.resourceId ? String(row.resourceId) : undefined,
      actorId: row.actorId ? String(row.actorId) : undefined,
      actorName: row.actorName ? String(row.actorName) : undefined,
      read: Boolean(row.read),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async markRead(id: string): Promise<void> {
    await this.delegate.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(): Promise<void> {
    await this.delegate.updateMany({ where: { read: false }, data: { read: true } });
  }

  async list(options: ListOptions = {}): Promise<ListResult<NotificationEntry>> {
    return super.list({
      ...options,
      sortBy: options.sortBy ?? "createdAt",
      sortDir: options.sortDir ?? "desc",
    });
  }
}

export const notificationRepository = new NotificationRepository();
