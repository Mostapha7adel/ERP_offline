import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api/config";

const HEALTH_TIMEOUT_MS = 30000;
const RETRY_INTERVAL_MS = 400;

export type BackendStatus = "checking" | "ready" | "error";

/**
 * Polls the local backend `/health` endpoint until it becomes available.
 * Used at app boot so the UI does not fire API calls before the packaged
 * sidecar has finished migrating + seeding.
 */
export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    const started = Date.now();

    const check = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/health`, {
          method: "GET",
          cache: "no-store",
        });
        if (res.ok) {
          const body = (await res.json()) as { status?: string };
          if (body.status === "ok" && !disposed) {
            setStatus("ready");
            return;
          }
        }
      } catch {
        // backend not up yet — keep polling
      }

      if (disposed) return;

      if (Date.now() - started > HEALTH_TIMEOUT_MS) {
        setStatus("error");
        return;
      }
      timer = window.setTimeout(() => void check(), RETRY_INTERVAL_MS);
    };

    void check();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return status;
}
