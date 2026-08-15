import { useEffect, useRef } from "react";
import { getApiRoot, getDeviceConfig } from "@/lib/api/config";
import { getAccessToken } from "@/lib/api/client";
import { hydrateAll } from "@/lib/api/hydration";
import { useAuthStore } from "@/stores/auth-store";

const DEBOUNCE_MS = 350;
const RECONNECT_MS = 2500;
const POLL_MS = 5000;

/**
 * Opens a Server-Sent Events stream to the backend (host or local) and, on
 * every `sync` event, re-hydrates all stores after a short debounce. This is
 * what makes an edit on any device appear on every other device immediately.
 * Reconnects with backoff; when the token changes (refresh/relogin) the stream
 * is recreated automatically. A lightweight 5-second poll acts as a fallback
 * so data stays fresh even if the stream silently drops.
 */
export function useRealtimeSync(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated) return;
    let disposed = false;
    let es: EventSource | null = null;
    let reconnectTimer: number | undefined;
    let pollTimer: number | undefined;
    let pollInFlight = false;

    const canSync = () =>
      getDeviceConfig().mode === "standalone" || Boolean(getDeviceConfig().token);

    const scheduleReconnect = () => {
      if (disposed) return;
      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
    };

    const poll = () => {
      if (disposed || pollInFlight) return;
      pollInFlight = true;
      void hydrateAll().finally(() => {
        pollInFlight = false;
        useAuthStore.getState().setHydrated();
      });
    };

    const connect = () => {
      if (disposed) return;
      const token = getAccessToken();
      if (!token) return scheduleReconnect();
      // Only sync when the device is talking to a backend (standalone host or
      // a joined client). A standalone device with no local backend is skipped.
      if (!canSync()) return;

      es?.close();
      try {
        es = new EventSource(`${getApiRoot()}/network/stream?token=${encodeURIComponent(token)}`);
      } catch {
        return scheduleReconnect();
      }

      es.onmessage = () => {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
          if (!disposed) {
            void hydrateAll().finally(() => useAuthStore.getState().setHydrated());
          }
        }, DEBOUNCE_MS);
      };

      es.onerror = () => {
        // The browser auto-reconnects, but once it gives up (or the token was
        // rotated) we force a fresh connection so the latest token is used.
        es?.close();
        scheduleReconnect();
      };
    };

    connect();
    if (canSync()) {
      pollTimer = window.setInterval(poll, POLL_MS);
    }
    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(debounceRef.current);
      window.clearInterval(pollTimer);
      es?.close();
    };
  }, [isAuthenticated]);
}

/** No-op component wrapper so the hook can be rendered declaratively. */
export function RealtimeSync() {
  useRealtimeSync();
  return null;
}
