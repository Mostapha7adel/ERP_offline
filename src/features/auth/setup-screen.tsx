import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Sparkles, Database, Rocket } from "lucide-react";
import { backupApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/shared/lib/toast";
import { useT } from "@/shared/lib/i18n";
import { Button } from "@/shared/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";

/**
 * First-run setup screen shown after the user updates their credentials.
 * The client chooses to restore their data from an uploaded file or start
 * from scratch with an empty workspace.
 */
export function SetupScreen() {
  const navigate = useNavigate();
  const completeSetup = useAuthStore((s) => s.completeSetup);
  const logout = useAuthStore((s) => s.logout);
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<unknown>(null);
  const [confirmFileRestore, setConfirmFileRestore] = useState(false);
  const [confirmScratch, setConfirmScratch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validatePayload = (payload: unknown): Record<string, unknown> => {
    if (payload === null || typeof payload !== "object") {
      throw new Error(t("Invalid backup file: expected a JSON object", "ملف نسخة احتياطية غير صالح: يُتوقع كائن JSON"));
    }
    const obj = payload as Record<string, unknown>;
    if (typeof obj.app === "string" || typeof obj.version === "number" || typeof obj.data === "object") {
      if (obj.app !== "ledgerflow") throw new Error(t("Invalid backup file: unrecognized signature", "ملف نسخة احتياطية غير صالح: توقيع غير معروف"));
      if (typeof obj.version !== "number" || obj.version > 1) throw new Error(t("Unsupported backup version", "إصدار نسخة احتياطية غير مدعوم"));
      const nested = obj.data;
      if (nested === null || typeof nested !== "object" || Array.isArray(nested)) {
        throw new Error(t("Invalid backup file: missing data snapshot", "ملف نسخة احتياطية غير صالح: لقطة البيانات مفقودة"));
      }
      return nested as Record<string, unknown>;
    }
    return obj;
  };

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const snapshot = validatePayload(parsed);
      for (const table of ["company", "user", "role", "party"]) {
        if (!Array.isArray(snapshot[table])) {
          throw new Error(t("Invalid backup file: missing required table \"${table}\"", "ملف نسخة احتياطية غير صالح: الجدول المطلوب \"${table}\" مفقود").replace("${table}", table));
        }
      }
      setPendingFile(parsed);
      setConfirmFileRestore(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Invalid backup file", "ملف نسخة احتياطية غير صالح"));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const restoreThenContinue = async () => {
    setConfirmFileRestore(false);
    setBusy(true);
    try {
      const result = await backupApi().restoreFromPayload(pendingFile);
      completeSetup();
      toast.success(t("Data imported (${count} records). Let's get started.", "تم استيراد البيانات (${count} سجلاً). لنبدأ.").replace("${count}", String(result.restored)));
      navigate("/app/dashboard", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Restore failed", "فشلت الاستعادة"));
    } finally {
      setBusy(false);
    }
  };

  const startFromScratch = async () => {
    setConfirmScratch(false);
    setBusy(true);
    try {
      await backupApi().resetWorkspace();
      await logout();
      toast.success(t("Workspace reset. Please sign in again.", "تمت إعادة تعيين مساحة العمل. يرجى تسجيل الدخول مرة أخرى."));
      navigate("/login", { replace: true });
    } catch {
      toast.error(t("Reset failed", "فشلت إعادة التعيين"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl border bg-card p-8 shadow-2xl">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Rocket className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("Welcome! Let's set up your workspace", "مرحباً! لنُجهّز مساحة العمل الخاصة بك")}
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {t("You are signed in. Choose how you want to begin: restore your data from a backup file, or start with an empty workspace.", "تم تسجيل دخولك. اختر كيف تريد البدء: استعادة بياناتك من ملف نسخة احتياطية، أو البدء بمساحة عمل فارغة.")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <Upload className="size-5" />
              </div>
              <CardTitle className="text-base">{t("Upload my data file", "رفع ملف بياناتي")}</CardTitle>
            </div>
            <CardDescription className="mt-2">
              {t("Restore customers, products, vendors, transactions and settings from a previously downloaded backup file.", "استعادة العملاء والمنتجات والموردين والمعاملات والإعدادات من ملف نسخة احتياطية تم تنزيله سابقاً.")}
            </CardDescription>
            <Button
              className="mt-4 w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <Database className="size-4" /> {t("Choose file…", "اختر ملفاً…")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
            />
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2.5 text-info">
                <Sparkles className="size-5" />
              </div>
              <CardTitle className="text-base">{t("Start from scratch", "البدء من الصفر")}</CardTitle>
            </div>
            <CardDescription className="mt-2">
              {t("Begin with an empty workspace and add your own data manually. You can import a backup later from Settings → Backup.", "ابدأ بمساحة عمل فارغة وأضف بياناتك يدوياً. يمكنك استيراد نسخة احتياطية لاحقاً من الإعدادات ← النسخ الاحتياطي.")}
            </CardDescription>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => setConfirmScratch(true)}
              disabled={busy}
            >
              {t("Start empty", "ابدأ فارغاً")}
            </Button>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmFileRestore}
        onOpenChange={(open) => { if (!open) setConfirmFileRestore(false); }}
        title={t("Restore data from file?", "استعادة البيانات من الملف؟")}
        description={t("This will replace ALL current data (companies, users, transactions) with the uploaded snapshot. This cannot be undone.", "سيؤدي هذا إلى استبدال جميع البيانات الحالية (الشركات والمستخدمون والمعاملات) بلقطة البيانات المرفوعة. لا يمكن التراجع عن هذا الإجراء.")}
        confirmLabel={t("Restore data", "استعادة البيانات")}
        loading={busy}
        onConfirm={() => void restoreThenContinue()}
      />

      <ConfirmDialog
        open={confirmScratch}
        onOpenChange={(open) => { if (!open) setConfirmScratch(false); }}
        title={t("Start from scratch?", "البدء من الصفر؟")}
        description={t("This will delete ALL current data (customers, products, invoices, accounts and transactions) and reset the workspace to empty. This cannot be undone.", "سيؤدي هذا إلى حذف جميع البيانات الحالية (العملاء والمنتجات والفواتير والحسابات والمعاملات) وإعادة تعيين مساحة العمل لتكون فارغة. لا يمكن التراجع عن هذا الإجراء.")}
        confirmLabel={t("Start empty", "ابدأ فارغاً")}
        loading={busy}
        onConfirm={() => void startFromScratch()}
      />
    </div>
  );
}