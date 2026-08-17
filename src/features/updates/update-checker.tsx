import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { toast } from "@/shared/lib/toast";
import { useT } from "@/shared/lib/i18n";

export interface UpdateInfo {
  available: boolean;
  version?: string;
  body?: string | null;
  date?: string | null;
  downloadUrl?: string;
}

/**
 * Checks for a newer release shortly after startup (only inside the desktop
 * app — in a plain browser it resolves to "no update"). When one is available
 * a small banner invites the user to download and install it. Checking is
 * silent and non-blocking; network failure is ignored so an offline machine
 * stays fully usable.
 */
export function UpdateChecker() {
  const { t } = useT();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let disposed = false;
    const check = async () => {
      try {
        if (!("__TAURI_INTERNALS__" in window)) return;
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<UpdateInfo>("check_for_updates");
        if (!disposed) setInfo(result);
      } catch {
        // offline / no network — leave the app untouched
      }
    };
    const timer = window.setTimeout(() => void check(), 6000);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    setInstalling(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("install_update");
      toast.success(t("Update installed. The app will restart.", "تم تثبيت التحديث. سيُعاد تشغيل التطبيق."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Update failed", "فشل التحديث"));
    } finally {
      setInstalling(false);
    }
  };

  if (!info?.available || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm">
      <Card className="border-primary/30 shadow-lg">
        <div className="flex items-start gap-3 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Download className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {t("Version ${v} is available", "تحديث ${v} متاح").replace("${v}", info.version ?? "")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("A new version of LedgerFlow is ready. Download and install it to get the latest fixes and features.", "نسخة جديدة من LedgerFlow جاهزة. نزّلها وثبّتها للحصول على أحدث الإصلاحات والمميزات.")}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={() => void install()} loading={installing} disabled={installing}>
                <Download className="size-3.5" /> {installing ? t("Installing…", "جارٍ التثبيت…") : t("Update now", "حدّث الآن")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} disabled={installing}>
                {t("Later", "لاحقاً")}
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={installing}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("Dismiss", "إغلاق")}
          >
            <X className="size-4" />
          </button>
        </div>
      </Card>
    </div>
  );
}