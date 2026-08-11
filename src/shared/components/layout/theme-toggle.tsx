import { Moon, Sun, Monitor } from "lucide-react";
import { useThemeStore, resolveTheme } from "@/stores/theme-store";
import { useT } from "@/shared/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { ThemeMode } from "@/types/navigation";

export function ThemeToggle({ className }: { className?: string }) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const { t } = useT();
  const icon = resolveTheme(mode) === "dark" ? Moon : Sun;

  const Icon = icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className ?? ""}`}
          aria-label={t("Toggle theme", "تبديل المظهر")}
        >
          <Icon className="size-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(
          [
            { value: "light", label: t("Light", "فاتح"), icon: Sun },
            { value: "dark", label: t("Dark", "داكن"), icon: Moon },
            { value: "system", label: t("System", "النظام"), icon: Monitor },
          ] as Array<{ value: ThemeMode; label: string; icon: typeof Sun }>
        ).map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setMode(option.value)}
            className={mode === option.value ? "text-primary" : undefined}
          >
            <option.icon className="size-4" />
            {option.label}
            {mode === option.value ? <span className="ms-auto">•</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}