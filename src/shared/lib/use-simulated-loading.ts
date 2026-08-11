import { useEffect, useState } from "react";

/**
 * Simulates an async data-fetch delay so loading/skeleton states are
 * demonstrable in this offline, API-free frontend. In production this
 * would map to a real data layer request.
 */
export function useSimulatedLoading(delay = 550, deps: unknown[] = []): boolean {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) setLoading(false);
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(timer);
      setLoading(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return loading;
}