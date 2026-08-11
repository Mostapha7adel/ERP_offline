import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "en" | "ar";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
      toggleLocale: () => set({ locale: get().locale === "en" ? "ar" : "en" }),
    }),
    { name: "ledgerflow:locale" },
  ),
);

/**
 * Apply the locale to <html>: sets dir (rtl/ltr), lang and a helper class so
 * Tailwind `rtl:`/`ltr:` variants and global CSS overrides react correctly.
 */
export function applyLocale(locale: Locale) {
  const el = document.documentElement;
  el.setAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  el.setAttribute("lang", locale);
  el.classList.toggle("rtl", locale === "ar");
  el.classList.toggle("ltr", locale !== "ar");
}
