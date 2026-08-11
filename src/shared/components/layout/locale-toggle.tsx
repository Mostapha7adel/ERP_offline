import { Languages } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { useT } from "@/shared/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const LANGS = [
  { value: "en", label: "English", sub: "English" },
  { value: "ar", label: "العربية", sub: "Arabic" },
] as const;

export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { t } = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className ?? ""}`}
          aria-label={t("Change language", "تغيير اللغة")}
        >
          <Languages className="size-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((lang) => (
          <DropdownMenuItem
            key={lang.value}
            onClick={() => setLocale(lang.value)}
            className={locale === lang.value ? "text-primary" : undefined}
          >
            <span className="flex items-center gap-2">
              <span className="font-semibold">{lang.label}</span>
              <span className="text-xs text-muted-foreground">{lang.sub}</span>
            </span>
            {locale === lang.value ? <span className="ms-auto">•</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
