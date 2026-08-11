import { Toaster } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { useTheme } from "@/shared/lib/use-theme";
import { useLocale } from "@/shared/lib/use-locale";
import { useLocaleStore } from "@/stores/locale-store";

export function Providers({ children }: { children: React.ReactNode }) {
  useTheme();
  useLocale();
  const locale = useLocaleStore((s) => s.locale);
  return (
    <TooltipProvider delayDuration={200}>
      {children}
      <Toaster richColors position={locale === "ar" ? "bottom-left" : "bottom-right"} />
    </TooltipProvider>
  );
}