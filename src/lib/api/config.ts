export const API_PREFIX = "/api/v1";

/** Local backend by default (standalone mode). */
export const DEFAULT_API_BASE = "http://127.0.0.1:3000";

// Device-local network config (per installation, persisted in the webview).
const NETWORK_MODE_KEY = "ledgerflow:network:mode";
const NETWORK_HOST_KEY = "ledgerflow:network:host";
const NETWORK_DEVICE_ID_KEY = "ledgerflow:network:deviceId";
const NETWORK_DEVICE_NAME_KEY = "ledgerflow:network:deviceName";
const NETWORK_TOKEN_KEY = "ledgerflow:network:token";

export type NetworkMode = "standalone" | "client";

export interface DeviceConfig {
  /** "standalone" talks to the local backend; "client" talks to a host device. */
  mode: NetworkMode;
  /** Host IP address (e.g. 192.168.1.10) when mode === "client". */
  host?: string;
  /** Stable id generated once per installation. */
  deviceId?: string;
  /** Human readable device name shown on the host's device list. */
  deviceName?: string;
  /** Device token issued after joining a workspace. */
  token?: string;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable — non-fatal
  }
}

export function getDeviceConfig(): DeviceConfig {
  return {
    mode: (read(NETWORK_MODE_KEY) as NetworkMode | null) ?? "standalone",
    host: read(NETWORK_HOST_KEY) ?? undefined,
    deviceId: read(NETWORK_DEVICE_ID_KEY) ?? undefined,
    deviceName: read(NETWORK_DEVICE_NAME_KEY) ?? undefined,
    token: read(NETWORK_TOKEN_KEY) ?? undefined,
  };
}

export function saveDeviceConfig(patch: Partial<DeviceConfig>): DeviceConfig {
  const next = { ...getDeviceConfig(), ...patch };
  write(NETWORK_MODE_KEY, next.mode);
  write(NETWORK_HOST_KEY, next.host ?? null);
  write(NETWORK_DEVICE_ID_KEY, next.deviceId ?? null);
  write(NETWORK_DEVICE_NAME_KEY, next.deviceName ?? null);
  write(NETWORK_TOKEN_KEY, next.token ?? null);
  return next;
}

/** Forget the workspace connection and fall back to the local backend. */
export function clearDeviceConfig(): DeviceConfig {
  write(NETWORK_MODE_KEY, "standalone");
  write(NETWORK_HOST_KEY, null);
  write(NETWORK_TOKEN_KEY, null);
  return {
    mode: "standalone",
    deviceId: getDeviceConfig().deviceId,
    deviceName: getDeviceConfig().deviceName,
  };
}

/** Stable per-installation device id (created on first use). */
export function getDeviceId(): string {
  const existing = getDeviceConfig().deviceId;
  if (existing) return existing;
  const id = crypto.randomUUID();
  saveDeviceConfig({ deviceId: id });
  return id;
}

/** Default device name shown on the host's device list. */
export function getDefaultDeviceName(): string {
  const short = getDeviceId().slice(0, 4).toUpperCase();
  return `Device-${short}`;
}

/** Resolve the API base URL for the current device mode. */
export function getApiBaseUrl(): string {
  const cfg = getDeviceConfig();
  if (cfg.mode === "client" && cfg.host) return `http://${cfg.host}:3000`;
  return DEFAULT_API_BASE;
}

/** Resolve the API root (base + version prefix). */
export function getApiRoot(): string {
  return `${getApiBaseUrl()}${API_PREFIX}`;
}

export const ACCESS_TOKEN_KEY = "ledgerflow:access-token";
export const REFRESH_TOKEN_KEY = "ledgerflow:refresh-token";
