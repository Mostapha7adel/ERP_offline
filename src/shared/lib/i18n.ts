import { useCallback } from "react";
import { useLocaleStore, type Locale } from "@/stores/locale-store";

export type TranslateFn = (en: string, ar: string) => string;

/**
 * Translation helper. Strings are passed inline in both languages, and the
 * active locale decides which one is returned. Components subscribing via
 * this hook re-render automatically when the locale changes.
 *
 * `t` is memoized so callers can safely use it as a dependency of
 * `useCallback`/`useEffect` without causing re-runs on every render.
 */
export function useT(): { t: TranslateFn; locale: Locale; isRTL: boolean } {
  const locale = useLocaleStore((s) => s.locale);
  const t = useCallback<TranslateFn>(
    (en, ar) => (locale === "ar" ? ar : en),
    [locale],
  );
  return { t, locale, isRTL: locale === "ar" };
}
