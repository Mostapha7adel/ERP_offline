import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/shared/lib/i18n";

export function Spinner({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <Loader2
      className={cn("size-4 animate-spin text-muted-foreground", className)}
      aria-label={t("Loading", "جارٍ التحميل")}
    />
  );
}

export function PageLoader({ label }: { label?: string }) {
  const { t } = useT();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{label ?? t("Loading workspace", "جارٍ تحميل مساحة العمل")}</p>
    </div>
  );
}
