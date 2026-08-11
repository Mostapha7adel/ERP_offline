import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeMode } from "@/types/navigation";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const getSystemTheme = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getSystemTheme();
  return mode;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "system",
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set({
          mode: get().mode === "dark" ? "light" : "dark",
        }),
    }),
    { name: "ledgerflow:theme" },
  ),
);

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", resolved === "dark" ? "#11131c" : "#ffffff");
}
