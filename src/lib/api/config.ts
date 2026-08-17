export const API_PREFIX = "/api/v1";

/** Default local backend port (standalone mode). The real port is discovered
 * from the Tauri shell at startup; this is the fallback in browser/dev mode. */
export const DEFAULT_API_PORT = 3000;
export const DEFAULT_API_BASE = `http://127.0.0.1:${DEFAULT_API_PORT}`;

// Device-local network config (per installation, persisted in the webview).
const NETWORK_MODE_KEY = "ledgerflow:network:mode";
const NETWORK_HOST_KEY = "ledgerflow:network:host";
const NETWORK_DEVICE_ID_KEY = "ledgerflow:network:deviceId";
const NETWORK_DEVICE_NAME_KEY = "ledgerflow:network:deviceName";
const NETWORK_TOKEN_KEY = "ledgerflow:network:token";
const NETWORK_APP_SECRET_KEY = "ledgerflow:network:appSecret";

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
  /** Host's per-install app secret (received at join). Sent as `x-app-token`. */
  appSecret?: string;
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
    appSecret: read(NETWORK_APP_SECRET_KEY) ?? undefined,
  };
}

export function saveDeviceConfig(patch: Partial<DeviceConfig>): DeviceConfig {
  const next = { ...getDeviceConfig(), ...patch };
  write(NETWORK_MODE_KEY, next.mode);
  write(NETWORK_HOST_KEY, next.host ?? null);
  write(NETWORK_DEVICE_ID_KEY, next.deviceId ?? null);
  write(NETWORK_DEVICE_NAME_KEY, next.deviceName ?? null);
  write(NETWORK_TOKEN_KEY, next.token ?? null);
  write(NETWORK_APP_SECRET_KEY, next.appSecret ?? null);
  return next;
}

/** Forget the workspace connection and fall back to the local backend. */
export function clearDeviceConfig(): DeviceConfig {
  write(NETWORK_MODE_KEY, "standalone");
  write(NETWORK_HOST_KEY, null);
  write(NETWORK_TOKEN_KEY, null);
  write(NETWORK_APP_SECRET_KEY, null);
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

/** True when `host` already carries a port (e.g. "192.168.1.10:3005"). */
function hostHasPort(host: string): boolean {
  return /^[^:]+:\d+$/.test(host);
}

/** Resolve the API base URL for the current device mode. */
export function getApiBaseUrl(): string {
  const cfg = getDeviceConfig();
  if (cfg.mode === "client" && cfg.host) {
    return hostHasPort(cfg.host) ? `http://${cfg.host}` : `http://${cfg.host}:${DEFAULT_API_PORT}`;
  }
  return `http://127.0.0.1:${getBackendPort()}`;
}

/** Resolve the API root (base + version prefix). */
export function getApiRoot(): string {
  return `${getApiBaseUrl()}${API_PREFIX}`;
}

// ---- Dynamic backend port discovery ----
// The local backend picks a free port at startup (3000, or 3001+ if busy) and
// writes it to a file in the data dir. The Tauri shell reads that file and
// exposes it via the `backend_port` command. We cache the resolved port here so
// every API call points at the real port, not just the default.

let backendPort: number | null = null;

/** The port the local backend is actually listening on (default 3000). */
export function getBackendPort(): number {
  return backendPort ?? DEFAULT_API_PORT;
}

/** Cache the discovered backend port (called once at startup). */
export function setBackendPort(port: number): void {
  if (Number.isInteger(port) && port > 0 && port < 65536) backendPort = port;
}

/**
 * Ask the Tauri shell which port the local backend bound. Falls back to the
 * default port in a plain browser (dev mode). Safe to call repeatedly: in a
 * plain browser it resolves instantly and does nothing.
 */
export async function resolveBackendPort(): Promise<number> {
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { invoke } = await import("@tauri-apps/api/core");
      const port = await invoke<number>("backend_port");
      setBackendPort(port);
      return getBackendPort();
    }
  } catch {
    // not running inside Tauri — keep the default
  }
  setBackendPort(DEFAULT_API_PORT);
  return DEFAULT_API_PORT;
}

// ---- Per-install app secret ----
// The Tauri shell generates one secret per installation and guards the backend
// with it. The webview resolves it at startup and sends it as `x-app-token` on
// every /api/v1 call; a LAN client instead uses the host's secret it received
// at join time (stored in device config).

let appSecret: string | null = null;

/** The app secret used for the current device (host secret in client mode). */
export function getAppSecret(): string | null {
  const cfg = getDeviceConfig();
  if (cfg.mode === "client" && cfg.appSecret) return cfg.appSecret;
  return appSecret;
}

/**
 * Resolve the local app secret from the Tauri shell. In a plain browser (dev
 * mode) there is none, which is fine: the dev backend runs without a secret.
 * Safe to call repeatedly.
 */
export async function resolveAppSecret(): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { invoke } = await import("@tauri-apps/api/core");
      appSecret = await invoke<string>("backend_app_secret");
      return appSecret;
    }
  } catch {
    // not running inside Tauri — no secret in dev mode
  }
  return appSecret;
}

export const ACCESS_TOKEN_KEY = "ledgerflow:access-token";
export const REFRESH_TOKEN_KEY = "ledgerflow:refresh-token";
