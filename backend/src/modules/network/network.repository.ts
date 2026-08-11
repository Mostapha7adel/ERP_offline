import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { NetworkWorkspace, NetworkDevice } from "./network.entity.js";

type Row = Record<string, unknown>;

export class NetworkWorkspaceRepository extends PrismaRepository<NetworkWorkspace> {
  protected model = "networkWorkspace";
  protected dateFields: string[] = [];
  // The workspace row must be hard-deleted: the `@@unique([companyId])`
  // constraint would otherwise block creating a replacement host with a new
  // name (a soft-deleted row still occupies the unique slot).
  protected softDelete = false;

  protected toEntity(row: Row): NetworkWorkspace {
    return {
      id: String(row.id),
      name: String(row.name),
      joinCode: String(row.joinCode),
      hostDeviceId: row.hostDeviceId ? String(row.hostDeviceId) : null,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  /** The single active workspace for the current company, if any. */
  async findActive(): Promise<NetworkWorkspace | undefined> {
    const all = await this.findAll();
    return all[0];
  }

  async findByJoinCode(joinCode: string): Promise<NetworkWorkspace | undefined> {
    const all = await this.findAll();
    return all.find((w) => w.joinCode === joinCode);
  }
}

export class NetworkDeviceRepository extends PrismaRepository<NetworkDevice> {
  protected model = "networkDevice";
  protected dateFields = ["lastSeenAt"];
  protected searchFields = ["name", "ip"];
  // A kicked device must be able to re-join with the same identity. The
  // deviceId/token columns are unique, so a soft-deleted row would block a
  // fresh registration; removing the row entirely keeps re-join working.
  protected softDelete = false;

  protected toEntity(row: Row): NetworkDevice {
    return {
      id: String(row.id),
      deviceId: String(row.deviceId),
      name: String(row.name),
      ip: row.ip ? String(row.ip) : undefined,
      userAgent: row.userAgent ? String(row.userAgent) : undefined,
      token: row.token ? String(row.token) : undefined,
      currentUserId: row.currentUserId ? String(row.currentUserId) : undefined,
      currentUserName: row.currentUserName ? String(row.currentUserName) : undefined,
      isHost: Boolean(row.isHost),
      lastSeenAt: this.toISO(row.lastSeenAt),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByToken(token: string): Promise<NetworkDevice | undefined> {
    const rows = await this.delegate.findMany({ where: { token, deletedAt: null } });
    return rows.length ? this.toEntity(rows[0] as Row) : undefined;
  }

  async findByDeviceId(deviceId: string): Promise<NetworkDevice | undefined> {
    const rows = await this.delegate.findMany({ where: { deviceId, deletedAt: null } });
    return rows.length ? this.toEntity(rows[0] as Row) : undefined;
  }

  /** Remove every registered device (used when the workspace is deleted). */
  async deleteAll(): Promise<number> {
    const result = await this.delegate.deleteMany({ where: {} });
    return result.count;
  }
}

export const networkWorkspaceRepository = new NetworkWorkspaceRepository();
export const networkDeviceRepository = new NetworkDeviceRepository();
