import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Loading state driven by the real data layer.
 *
 * Once the app data has been hydrated from the backend (`auth.hydrated`), the
 * component is considered loaded immediately — no artificial skeleton phase.
 * Before that (e.g. the first render after boot while `hydrateAll` is still in
 * flight) we fall back to a short delay so tables don't flash empty.
 */
export function useSimulatedLoading(delay = 550, deps: unknown[] = []): boolean {
  const hydrated = useAuthStore((s) => s.hydrated);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Already hydrated from the backend: nothing to wait for.
    if (hydrated) {
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (active) setLoading(false);
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(timer);
      setLoading(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, hydrated]);

  return loading;
}
