import { useEffect } from "react";
import { useLocaleStore, applyLocale } from "@/stores/locale-store";

/** Applies the persisted locale (dir/lang) to <html> at boot and on change. */
export function useLocale() {
  const locale = useLocaleStore((s) => s.locale);
  useEffect(() => {
    applyLocale(locale);
  }, [locale]);
}
