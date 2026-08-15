import { AppError } from "../../core/errors/app-error.js";
import { env } from "../../config/env.js";
import { networkInterfaces } from "node:os";
import { getBoundPort } from "../../core/runtime/bound-port.js";
import { auditService, type AuditContext } from "../../core/audit/audit.service.js";
import {
  networkWorkspaceRepository,
  networkDeviceRepository,
} from "./network.repository.js";
import type {
  CreateWorkspaceInput,
  JoinWorkspaceInput,
  HeartbeatInput,
  NetworkDevice,
} from "./network.entity.js";
import { withTransaction } from "../../core/database/transaction.js";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * JOIN_CODE_ALPHABET.length);
    code += JOIN_CODE_ALPHABET[idx];
  }
  return code;
}

function generateDeviceToken(): string {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

/** Redact secrets before a device leaves the service. */
function publicDevice(device: NetworkDevice) {
  const { token: _token, userAgent: _ua, currentUserId: _uid, ...rest } = device;
  return rest;
}

/** Non-loopback IPv4 addresses of this machine (host hint for clients). */
function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) addresses.push(iface.address);
    }
  }
  return addresses;
}

export class NetworkService {
  get mode(): "standalone" | "host" | "client" {
    return env.LAN_MODE;
  }

  /** Public reachability check used by a client before joining. */
  async status(): Promise<{ app: string; mode: string; workspaceReady: boolean; serverTime: string; hostIps: string[]; port: number }> {
    const workspace = await networkWorkspaceRepository.findActive();
    return {
      app: "ledgerflow",
      mode: env.LAN_MODE,
      workspaceReady: Boolean(workspace),
      serverTime: new Date().toISOString(),
      hostIps: lanAddresses(),
      port: getBoundPort(),
    };
  }

  /**
   * Create (activate) the LAN workspace. Super admin only. Registers the
   * calling device as the host device so it appears in the device list.
   */
  async createWorkspace(input: CreateWorkspaceInput, audit: AuditContext) {
    const existing = await networkWorkspaceRepository.findActive();
    if (existing) {
      throw AppError.conflict("A network workspace already exists for this company");
    }

    return withTransaction(async () => {
      let code = generateJoinCode();
      while (await networkWorkspaceRepository.findByJoinCode(code)) {
        code = generateJoinCode();
      }

      const workspace = await networkWorkspaceRepository.create({
        data: { name: input.name, joinCode: code, hostDeviceId: null },
      });

      // Register the host device (upsert by stable deviceId).
      const token = generateDeviceToken();
      const hostDevice = await networkDeviceRepository.findByDeviceId(input.deviceId);
      const savedHost = hostDevice
        ? (await networkDeviceRepository.update({
            id: hostDevice.id,
            data: {
              name: input.deviceName,
              token,
              isHost: true,
              lastSeenAt: new Date().toISOString(),
            },
          }))!
        : await networkDeviceRepository.create({
            data: {
              deviceId: input.deviceId,
              name: input.deviceName,
              token,
              isHost: true,
              lastSeenAt: new Date().toISOString(),
            },
          });

      await networkWorkspaceRepository.update({
        id: workspace.id,
        data: { hostDeviceId: savedHost.id },
      });
      await auditService.log(audit, "network:create-workspace", "network", workspace.id, {
        name: input.name,
      });

      return { ...workspace, hostDeviceId: savedHost.id, token };
    });
  }

  /** The active workspace (with its join code) — host admin only. */
  async getWorkspace() {
    const workspace = await networkWorkspaceRepository.findActive();
    if (!workspace) throw AppError.notFound("No network workspace is configured");
    return workspace;
  }

  /**
   * Rotate the workspace join code. Called on every host boot so a code from a
   * previous session (or from before a disconnect/restart) no longer works.
   * Existing device tokens are unaffected, so connected devices stay online.
   * Returns the new code, or null when no workspace exists yet.
   */
  async rotateJoinCode(): Promise<string | null> {
    const workspace = await networkWorkspaceRepository.findActive();
    if (!workspace) return null;
    let code = generateJoinCode();
    while (code === workspace.joinCode || (await networkWorkspaceRepository.findByJoinCode(code))) {
      code = generateJoinCode();
    }
    await networkWorkspaceRepository.update({ id: workspace.id, data: { joinCode: code } });
    return code;
  }

  /**
   * Join an existing workspace using its join code. Issues a fresh device
   * token (rotating any previous one) so re-joining keeps the same identity.
   */
  async join(input: JoinWorkspaceInput, ip: string | undefined) {
    const workspace = await networkWorkspaceRepository.findByJoinCode(input.code.trim().toUpperCase());
    if (!workspace) {
      throw AppError.badRequest("Invalid join code. Check the code shown on the host device.");
    }

    const token = generateDeviceToken();
    const existing = await networkDeviceRepository.findByDeviceId(input.deviceId);
    if (existing) {
      await networkDeviceRepository.update({
        id: existing.id,
        data: {
          name: input.deviceName,
          ip,
          token,
          lastSeenAt: new Date().toISOString(),
        },
      });
    } else {
      await networkDeviceRepository.create({
        data: {
          deviceId: input.deviceId,
          name: input.deviceName,
          ip,
          token,
          isHost: false,
          lastSeenAt: new Date().toISOString(),
        },
      });
    }

    return { workspaceName: workspace.name, deviceId: input.deviceId, token };
  }

  /** Keep the device online and record the currently signed-in user. */
  async heartbeat(input: HeartbeatInput) {
    const device = await networkDeviceRepository.findByToken(input.token);
    if (!device) throw AppError.unauthorized("Unknown device token");
    // The device identity and host flag are set by the server at join /
    // workspace creation time. A device can never promote itself to host or
    // impersonate another device, so client-supplied values are ignored.
    await networkDeviceRepository.update({
      id: device.id,
      data: {
        name: input.deviceName,
        currentUserName: input.currentUserName,
        lastSeenAt: new Date().toISOString(),
      },
    });
    return { ok: true, serverTime: new Date().toISOString() };
  }

  /** All registered devices (secrets removed) — super admin only. */
  async listDevices() {
    const all = await networkDeviceRepository.findAll();
    return all.map(publicDevice);
  }

  /** Remove a device from the workspace. The host cannot be removed. */
  async kick(deviceId: string) {
    const device =
      (await networkDeviceRepository.findById(deviceId)) ??
      (await networkDeviceRepository.findByDeviceId(deviceId));
    if (!device) throw AppError.notFound("Device not found");
    if (device.isHost) throw AppError.badRequest("The host device cannot be removed");
    await networkDeviceRepository.delete(device.id);
    return { success: true };
  }

  /**
   * Delete the LAN workspace and every registered device (host + clients) so
   * the super admin can recreate the host under a different name. Super admin
   * only.
   */
  async deleteWorkspace(audit: AuditContext) {
    const workspace = await networkWorkspaceRepository.findActive();
    if (!workspace) throw AppError.notFound("No network workspace is configured");

    return withTransaction(async () => {
      await networkDeviceRepository.deleteAll();
      await networkWorkspaceRepository.delete(workspace.id);
      await auditService.log(audit, "network:delete-workspace", "network", workspace.id, {
        name: workspace.name,
      });
      return { success: true };
    });
  }
}

export const networkService = new NetworkService();
