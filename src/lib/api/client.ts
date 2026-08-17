import { getApiRoot, getAppSecret, getDeviceConfig, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "./config";

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

// ---- Token persistence (drives the "Remember me" login control) ----

type TokenStorage = typeof localStorage;
let tokenStorage: TokenStorage = localStorage;

/** When "remember me" is off, tokens live in sessionStorage and vanish when
 *  the app window closes instead of persisting on the device. */
export function setTokenPersistence(remember: boolean): void {
  tokenStorage = remember ? localStorage : sessionStorage;
}

function readToken(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function writeToken(key: string, value: string | null): void {
  if (value === null) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } else {
    tokenStorage.setItem(key, value);
  }
}

export function getAccessToken(): string | null {
  return readToken(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  writeToken(ACCESS_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return readToken(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  writeToken(REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

/** Human-readable failure when the API base is unreachable, mode-aware. */
function networkErrorMessage(): string {
  const cfg = getDeviceConfig();
  if (cfg.mode === "client" && cfg.host) {
    return `Cannot reach the workspace host (${cfg.host}). Make sure the host computer is on and connected to the same network.`;
  }
  return "Cannot reach the local server. Make sure the backend is running.";
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

export interface ApiClientOptions {
  signal?: AbortSignal;
  /** Called when the API returns 401 (stale/invalid token). Defaults to clearing tokens. */
  onUnauthorized?: () => void;
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/**
 * Refresh callback wired by the app. When set, a 401 triggers a token
 * refresh before failing; if the refresh fails, the session is cleared.
 */
let refreshHandler: (() => Promise<boolean>) | null = null;

export function setRefreshHandler(handler: (() => Promise<boolean>) | null): void {
  refreshHandler = handler;
}

/**
 * Waiters for requests that observed a 401 while a refresh was in flight.
 * They resolve (with the refresh outcome) once the refresh settles.
 */
let pendingRefreshes: Array<(ok: boolean) => void> = [];
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Ensures a single refresh runs at a time; concurrent callers wait for it.
 * Returns true if the caller should retry its request with a fresh token.
 * Waiters always resolve (even on failure) so no request hangs forever.
 */
async function ensureFreshToken(): Promise<boolean> {
  if (!refreshHandler) return false;

  if (refreshInFlight) {
    return new Promise<boolean>((resolve) => {
      pendingRefreshes.push(resolve);
    });
  }

  refreshInFlight = refreshHandler()
    .catch(() => false)
    .then((ok) => {
      const waiters = pendingRefreshes;
      pendingRefreshes = [];
      for (const waiter of waiters) waiter(ok);
      return ok;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${getApiRoot()}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
  retried = 0,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(getAppSecret() ? { "x-app-token": getAppSecret() as string } : {}),
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", networkErrorMessage());
  }

  if (response.status === 401) {
    // A 401 on an unauthenticated request (e.g. a failed login attempt) must
    // surface the server's real error message — not the "session expired"
    // fallthrough meant for stale-token requests. Only attempt a refresh when
    // we actually sent an access token.
    if (!token) {
      const raw: unknown = await response.json().catch(() => undefined);
      const envelope = raw as ApiEnvelope<T>;
      const error = envelope?.error;
      throw new ApiError(
        response.status,
        error?.code ?? "UNAUTHORIZED",
        error?.message ?? "Request failed (401)",
        error?.details,
      );
    }
    // A 401 with a token: refresh once and retry. A second consecutive 401
    // means the token is genuinely bad (or the endpoint is misconfigured),
    // so stop instead of looping refresh→retry forever.
    if (retried >= 1) {
      clearTokens();
      unauthorizedHandler?.();
      throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
    }
    const refreshed = await ensureFreshToken();
    if (refreshed) {
      return request<T>(method, path, body, options, retried + 1);
    }
    clearTokens();
    unauthorizedHandler?.();
    throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
  }

  const raw: unknown = await response.json().catch(() => undefined);
  const envelope = raw as ApiEnvelope<T>;

  if (!response.ok || !envelope?.success) {
    const error = envelope?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "REQUEST_ERROR",
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }

  return envelope.data as T;
}

function unwrapPaginated<T>(
  response: { data: T[]; meta?: PaginationMeta },
): Paginated<T> {
  return {
    data: response.data,
    meta: response.meta ?? {
      page: 1,
      limit: response.data.length,
      total: response.data.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

async function requestEnvelope<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
  retried = 0,
): Promise<{ data: T; meta?: PaginationMeta }> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(getAppSecret() ? { "x-app-token": getAppSecret() as string } : {}),
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", networkErrorMessage());
  }

  if (response.status === 401) {
    if (!token) {
      const raw: unknown = await response.json().catch(() => undefined);
      const envelope = raw as ApiEnvelope<T>;
      const error = envelope?.error;
      throw new ApiError(
        response.status,
        error?.code ?? "UNAUTHORIZED",
        error?.message ?? "Request failed (401)",
        error?.details,
      );
    }
    if (retried >= 1) {
      clearTokens();
      unauthorizedHandler?.();
      throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
    }
    const refreshed = await ensureFreshToken();
    if (refreshed) {
      return requestEnvelope<T>(method, path, body, options, retried + 1);
    }
    clearTokens();
    unauthorizedHandler?.();
    throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
  }

  const raw: unknown = await response.json().catch(() => undefined);
  const envelope = raw as ApiEnvelope<T>;

  if (!response.ok || !envelope?.success) {
    const error = envelope?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "REQUEST_ERROR",
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }

  return {
    data: envelope.data as T,
    meta: (envelope as { meta?: PaginationMeta }).meta,
  };
}

export const api = {
  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return request<T>("GET", path, undefined, options);
  },
  post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return request<T>("POST", path, body, options);
  },
  put<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return request<T>("PUT", path, body, options);
  },
  patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return request<T>("PATCH", path, body, options);
  },
  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return request<T>("DELETE", path, undefined, options);
  },
  async getList<T>(path: string, options: RequestOptions = {}): Promise<Paginated<T>> {
    const response = await requestEnvelope<T[]>("GET", path, undefined, options);
    return unwrapPaginated({ data: response.data, meta: response.meta });
  },
  async getRaw<T>(path: string, options: RequestOptions = {}, retried = 0): Promise<T> {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(getAppSecret() ? { "x-app-token": getAppSecret() as string } : {}),
      ...options.headers,
    };
    let response: Response;
    try {
      response = await fetch(buildUrl(path, options.query), { method: "GET", headers });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", networkErrorMessage());
    }
    if (response.status === 401) {
      if (retried >= 1 || !token) {
        clearTokens();
        unauthorizedHandler?.();
        throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
      }
      const refreshed = await ensureFreshToken();
      if (refreshed) {
        return api.getRaw<T>(path, options, retried + 1);
      }
      clearTokens();
      unauthorizedHandler?.();
      throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
    }
    if (!response.ok) {
      throw new ApiError(response.status, "REQUEST_ERROR", `Request failed (${response.status})`);
    }
    return (await response.json()) as T;
  },
};
