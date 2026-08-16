import { useEffect } from "react";
import { getDeviceConfig, getDeviceId, getDefaultDeviceName } from "@/lib/api";
import { clearDeviceConfig, getApiRoot } from "@/lib/api/config";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Send the heartbeat directly instead of through the authed `api` client.
 * The heartbeat is validated by the *device token* in the body, so a 401 here
 * only means "this device is no longer known to the backend" — it must not
 * trigger the access-token refresh / session-clearing flow of the authed
 * client (which would log the user out for a stale leftover device token).
 */
async function sendHeartbeat(input: {
  token: string;
  deviceId: string;
  deviceName: string;
  currentUserName?: string;
}): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${getApiRoot()}/network/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the backend");
  }
  if (!response.ok) {
    const raw: unknown = await response.json().catch(() => undefined);
    const error = (raw as { error?: { code?: string; message?: string } })?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "REQUEST_ERROR",
      error?.message ?? `Request failed (${response.status})`,
    );
  }
}

const HEARTBEAT_INTERVAL_MS = 3_000;
const MAX_CONSECUTIVE_FAILURES = 2;

/**
 * Keeps the current device "online" on the host's device list while the app is
 * open (any page, including login). Re-reads the device config on every ping so
 * it reacts to joining/leaving a workspace without a restart.
 *
 * Client devices also use the heartbeat as a liveness probe:
 *  - A 401 means the device was kicked (token revoked) → disconnect + log out.
 *  - Repeated network failures mean the host/server is gone → log out (keeps
 *    the device config so the user can reconnect when the host returns).
 * The host device itself runs in standalone mode and is never logged out.
 */
export function useDeviceHeartbeat(): void {
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    let disposed = false;
    let consecutiveFailures = 0;

    const ping = async () => {
      if (disposed) return;
      const cfg = getDeviceConfig();
      if (!cfg.token) return;
      try {
        await sendHeartbeat({
          token: cfg.token,
          deviceId: getDeviceId(),
          deviceName: cfg.deviceName ?? getDefaultDeviceName(),
          currentUserName: currentUser?.name,
        });
        consecutiveFailures = 0;
      } catch (err) {
        const status = (err as ApiError)?.status;

        // A standalone host never needs a device token: a 401 here just means
        // a stale leftover token from an old workspace. Drop the stale token
        // (fall back to "Local only") but never log the host user out.
        if (getDeviceConfig().mode !== "client") {
          if (status === 401) clearDeviceConfig();
          return;
        }

        if (status === 401) {
          // Device was removed by the host (kick) or its token was revoked.
          consecutiveFailures = 0;
          clearDeviceConfig();
          void useAuthStore.getState().logout();
          return;
        }

        // Host unreachable. Log out once the failure is persistent (the host
        // stopped / the cable is pulled). Skip if already signed out to avoid
        // repeatedly firing logout while the host is offline.
        if (!useAuthStore.getState().isAuthenticated) {
          consecutiveFailures = 0;
          return;
        }
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          consecutiveFailures = 0;
          void useAuthStore.getState().logout();
        }
      }
    };

    // Ping immediately and then every few seconds. The token is read on every
    // tick so joining a workspace (even while sitting on the login page) or
    // disconnecting is picked up without a restart.
    void ping();
    const interval = window.setInterval(() => void ping(), HEARTBEAT_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [currentUser?.name]);
}

/** No-op component wrapper so the hook can be rendered declaratively. */
export function DeviceHeartbeat() {
  useDeviceHeartbeat();
  return null;
}
