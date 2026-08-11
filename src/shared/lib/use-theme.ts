import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme-store";

export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle(
        "dark",
        (mode === "system" && media.matches) || mode === "dark",
      );
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode]);
}