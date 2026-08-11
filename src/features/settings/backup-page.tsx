import { useEffect, useRef, useState } from "react";
import { Download, Trash2, ShieldCheck, History, HardDriveDownload, Upload } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { useBackupStore } from "@/stores/system-store";
import { APP_VERSION } from "@/config/app";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { formatDate, formatFileSize, timeAgo } from "@/lib/format";
import { toast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/feedback/states";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import { backupApi } from "@/lib/api";
import type { BackupMeta } from "@/types/domain";

export function BackupPage() {
  const history = useSettingsStore((s) => s.backupHistory);
  const removeBackup = useSettingsStore((s) => s.removeBackup);
  const lastBackupAt = useBackupStore((s) => s.lastBackupAt);
  const setLastBackupAt = useBackupStore((s) => s.setLastBackupAt);
  const [busy, setBusy] = useState(false);
  const { t } = useT();

  const canManage = usePermission("backup.manage");
  const [confirmDelete, setConfirmDelete] = useState<BackupMeta | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingFile, setPendingFile] = useState<unknown>(null);
  const [confirmFileRestore, setConfirmFileRestore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncHistory = (rows: { id: string; label: string; createdAt: string; sizeBytes: number }[]) => {
    useSettingsStore.setState({
      backupHistory: rows.map((r) => ({
        id: r.id,
        name: r.label,
        createdAt: r.createdAt,
        size: r.sizeBytes,
        type: "manual",
        version: APP_VERSION,
      })),
    });
  };

  const refresh = async () => {
    try {
      const rows = await backupApi().list();
      syncHistory(rows);
      const latest = rows[0];
      if (latest) setLastBackupAt(latest.createdAt);
    } catch {
      // ignore refresh errors
    }
  };

  const createBackup = async () => {
    setBusy(true);
    try {
      const backup = await backupApi().create("Manual backup");
      syncHistory([{ id: backup.id, label: backup.label, createdAt: backup.createdAt, sizeBytes: backup.sizeBytes }]);
      setLastBackupAt(backup.createdAt);
      toast.success(t("Backup created", "تم إنشاء النسخة الاحتياطية"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Backup failed", "فشل إنشاء النسخة الاحتياطية"));
    } finally {
      setBusy(false);
    }
  };

  const downloadBackup = async (id: string) => {
    try {
      const payload = await backupApi().download(id);
      const content = JSON.stringify(payload, null, 2);
      const { downloadTextFile } = await import("@/lib/export");
      const saved = await downloadTextFile(
        `ledgerflow-backup-${id}.json`,
        content,
        "application/json;charset=utf-8",
      );
      if (saved) toast.success(t("Backup downloaded", "تم تنزيل النسخة الاحتياطية"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Download failed", "فشل التنزيل"));
    }
  };

  const deleteBackup = async (id: string) => {
    try {
      await backupApi().remove(id);
      removeBackup(id);
      toast.success(t("Backup deleted", "تم حذف النسخة الاحتياطية"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
    }
    setConfirmDelete(null);
  };

  const restoreBackup = async () => {
    setBusy(true);
    try {
      const latest = useSettingsStore.getState().backupHistory[0];
      if (!latest) throw new Error(t("No backups available", "لا توجد نسخ احتياطية متاحة"));
      const result = await backupApi().restoreFromBackup(latest.id);
      toast.success(t("Workspace restored (${count} records)", "تمت استعادة مساحة العمل (${count} سجلاً)").replace("${count}", String(result.restored)));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Restore failed", "فشلت الاستعادة"));
    } finally {
      setBusy(false);
    }
  };

  /** Validate a parsed JSON payload before it reaches the server. */
  const validatePayload = (payload: unknown): Record<string, unknown> => {
    if (payload === null || typeof payload !== "object") {
      throw new Error(t("Invalid backup file: expected a JSON object", "ملف نسخة احتياطية غير صالح: يُتوقع كائن JSON"));
    }
    const obj = payload as Record<string, unknown>;
    // Wrapped download format: { app, version, data }.
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

  const restoreFromFile = async () => {
    setBusy(true);
    try {
      const result = await backupApi().restoreFromPayload(pendingFile);
      toast.success(t("Workspace restored from file (${count} records)", "تمت استعادة مساحة العمل من الملف (${count} سجلاً)").replace("${count}", String(result.restored)));
      setPendingFile(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Restore from file failed", "فشلت الاستعادة من الملف"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("Backup & Restore", "النسخ الاحتياطي والاستعادة")} description={t("Protect your data with scheduled and manual backups.", "احمِ بياناتك عبر النسخ الاحتياطية المجدولة واليدوية.")}>
        <Button onClick={() => void createBackup()} disabled={!canManage || busy}>
          <HardDriveDownload className="size-4" /> {t("Back up now", "نسخ احتياطي الآن")}
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-info/10 p-2.5 text-info">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="font-medium">{t("Last backup", "آخر نسخة احتياطية")}</p>
              <p className="text-sm text-muted-foreground">
                {lastBackupAt ? formatDate(lastBackupAt) : t("No backups yet", "لا توجد نسخ احتياطية بعد")}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <History className="size-5" />
            </div>
            <div>
              <p className="font-medium">{t("Total backups", "إجمالي النسخ الاحتياطية")}</p>
              <p className="text-sm text-muted-foreground">{history.length} {t("stored", "مخزنة")}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Backup history", "سجل النسخ الاحتياطية")}</CardTitle>
          <CardDescription>{t("Automatically retains the 25 most recent backups.", "يحتفظ تلقائياً بأحدث 25 نسخة احتياطية.")}</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState title={t("No backups yet", "لا توجد نسخ احتياطية بعد")} description={t("Run a backup to start protecting your data.", "قم بإنشاء نسخة احتياطية للبدء في حماية بياناتك.")} />
          ) : (
            <div className="divide-y">
              {history.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <Download className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{backup.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {timeAgo(backup.createdAt)} · {formatFileSize(backup.size)} · v{backup.version}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={backup.type === "auto" ? "secondary" : "outline"}>
                      {backup.type === "auto" ? t("Automatic", "تلقائي") : t("Manual", "يدوي")}
                    </Badge>
                    <Button variant="ghost" size="icon-sm" onClick={() => void downloadBackup(backup.id)} disabled={!canManage || busy} aria-label={t("Download", "تنزيل")}>
                      <Download />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setConfirmDelete(backup)} disabled={!canManage} aria-label={t("Delete", "حذف")}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Restore", "استعادة")}</CardTitle>
          <CardDescription>{t("Restore your workspace from the latest backup.", "استعد مساحة عملك من أحدث نسخة احتياطية.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setConfirmRestore(true)} disabled={!canManage || history.length === 0 || busy}>
              {t("Restore from latest backup", "استعادة من أحدث نسخة احتياطية")}
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canManage || busy}
            >
              <Upload className="size-4" /> {t("Restore from file…", "استعادة من ملف…")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("Restore from a downloaded backup file ({app, version, data} or raw snapshot JSON). This replaces all current data.", "استعادة من ملف نسخة احتياطية تم تنزيله ({app, version, data} أو JSON خام للقطة البيانات). يؤدي هذا إلى استبدال جميع البيانات الحالية.")}
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={t("Delete backup", "حذف النسخة الاحتياطية")}
        description={t("Remove \"${name}\" from your backup history?", "هل تريد إزالة \"${name}\" من سجل النسخ الاحتياطية؟").replace("${name}", confirmDelete?.name ?? "")}
        confirmLabel={t("Delete backup", "حذف النسخة الاحتياطية")}
        onConfirm={() => {
          if (confirmDelete) void deleteBackup(confirmDelete.id);
        }}
      />

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title={t("Restore workspace?", "استعادة مساحة العمل؟")}
        description={t("This will replace your current data with the latest backup. Continue?", "سيؤدي هذا إلى استبدال بياناتك الحالية بأحدث نسخة احتياطية. هل تريد المتابعة؟")}
        confirmLabel={t("Restore", "استعادة")}
        onConfirm={() => {
          setConfirmRestore(false);
          void restoreBackup();
        }}
      />

      <ConfirmDialog
        open={confirmFileRestore}
        onOpenChange={(open) => { if (!open) setConfirmFileRestore(false); }}
        title={t("Restore from file?", "استعادة من ملف؟")}
        description={t("This will replace ALL current data (companies, users, transactions) with the uploaded snapshot. This cannot be undone. Continue?", "سيؤدي هذا إلى استبدال جميع البيانات الحالية (الشركات والمستخدمون والمعاملات) بلقطة البيانات المرفوعة. لا يمكن التراجع عن هذا الإجراء. هل تريد المتابعة؟")}
        confirmLabel={t("Restore data", "استعادة البيانات")}
        onConfirm={() => {
          setConfirmFileRestore(false);
          void restoreFromFile();
        }}
      />
    </div>
  );
}