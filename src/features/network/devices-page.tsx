import { useCallback, useEffect, useState } from "react";
import { Network, Copy, RefreshCw, Plus, Monitor, MonitorOff, Trash2, Unplug } from "lucide-react";
import { networkApi, getDeviceId, getDefaultDeviceName, saveDeviceConfig, clearDeviceConfig, type NetworkDevice, type NetworkWorkspace } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";

const ONLINE_WINDOW_MS = 30_000;

function isOnline(device: NetworkDevice, now: number): boolean {
  if (!device.lastSeenAt) return false;
  return now - new Date(device.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

export function DevicesPage() {
  const { t } = useT();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const canView = usePermission("network.view");

  const [workspace, setWorkspace] = useState<NetworkWorkspace | null>(null);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [hostIps, setHostIps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!isSuperAdmin || !canView) return;
    const [ws, list, status] = await Promise.all([
      networkApi().getWorkspace().catch(() => null),
      networkApi().listDevices().catch(() => null),
      networkApi().status().catch(() => null),
    ]);
    setWorkspace(ws);
    setDevices(list ?? []);
    setHostIps(status?.hostIps ?? []);
    setLoading(false);
  }, [isSuperAdmin, canView]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      setNow(Date.now());
      void load();
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const createWorkspace = async () => {
    if (!workspaceName.trim()) {
      toast.error(t("Workspace name is required", "اسم المساحة مطلوب"));
      return;
    }
    setCreating(true);
    try {
      const result = await networkApi().createWorkspace({
        name: workspaceName.trim(),
        deviceId: getDeviceId(),
        deviceName: getDefaultDeviceName(),
      });
      saveDeviceConfig({ deviceName: getDefaultDeviceName(), token: result.token });
      setWorkspace(result);
      toast.success(t("Workspace created. Share the join code with your devices.", "تم إنشاء المساحة. شارك كود الانضمام مع أجهزتك."));
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setCreating(false);
    }
  };

  const kick = async (device: NetworkDevice) => {
    try {
      await networkApi().kick(device.id);
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      toast.success(t("Device removed", "تمت إزالة الجهاز"));
    } catch (error) {
      toast.error(translateApiError(error, t));
    }
  };

  const copyCode = async () => {
    if (!workspace) return;
    try {
      await navigator.clipboard.writeText(workspace.joinCode);
      toast.success(t("Join code copied", "تم نسخ كود الانضمام"));
    } catch {
      toast.error(t("Could not copy the join code", "تعذّر نسخ كود الانضمام"));
    }
  };

  const deleteHost = async () => {
    setDeleting(true);
    try {
      await networkApi().deleteWorkspace();
      clearDeviceConfig();
      setWorkspace(null);
      setDevices([]);
      setWorkspaceName("");
      toast.success(t("Workspace deleted. You can create a new one now.", "تم حذف المساحة. يمكنك الآن إنشاء واحدة جديدة."));
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (!isSuperAdmin || !canView) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t("Only the super admin can access the network page.", "فقط السوبر أدمن يمكنه الوصول إلى صفحة الشبكة.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Network & Devices", "الشبكة والأجهزة")}
        description={t("Connect your devices on the same WiFi network and see who is online.", "اربط أجهزتك على نفس شبكة الواي فاي وشاهد من هو متصل.")}
      >
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="size-4" /> {t("Refresh", "تحديث")}
        </Button>
      </PageHeader>

      {loading ? (
        <SkeletonTable rows={4} />
      ) : !workspace ? (
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="size-5" /> {t("Create your network workspace", "أنشئ مساحة شبكتك")}
            </CardTitle>
            <CardDescription>
              {t(
                "This device becomes the host (server). Other devices on the same WiFi will connect to it with a join code.",
                "يصبح هذا الجهاز هو الخادم. الأجهزة الأخرى على نفس الواي فاي ستتصل به باستخدام كود انضمام.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-sm font-medium">{t("Workspace name", "اسم المساحة")}</label>
            <Input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder={t("e.g. Main Shop", "مثال: المتجر الرئيسي")}
            />
            <Button className="w-full" onClick={() => void createWorkspace()} loading={creating}>
              <Plus className="size-4" /> {creating ? t("Creating…", "جارٍ الإنشاء…") : t("Create workspace", "إنشاء المساحة")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="size-5" /> {workspace.name}
              </CardTitle>
              <CardDescription>
                {t("This device is the host (server).", "هذا الجهاز هو الخادم الرئيسي.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t("Join code", "كود الانضمام")}</p>
                <p className="font-mono text-2xl font-bold tracking-widest">{workspace.joinCode}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t("Host device", "جهاز الخادم")}</p>
                <p className="text-sm font-medium">{t("This computer", "هذا الجهاز")}</p>
              </div>
              {hostIps.length > 0 ? (
                <div className="rounded-lg border bg-muted/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{t("Host IP (share this)", "عنوان الخادم (شاركه)")}</p>
                  <p className="font-mono text-sm font-medium">{hostIps.join(" · ")}</p>
                </div>
              ) : null}
              <Button variant="outline" onClick={() => void copyCode()}>
                <Copy className="size-4" /> {t("Copy code", "نسخ الكود")}
              </Button>
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Unplug className="size-4" /> {t("Delete host", "حذف الخادم")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("Connected devices", "الأجهزة المتصلة")}</CardTitle>
              <CardDescription>
                {t("Devices that joined your workspace on the same WiFi network.", "الأجهزة التي انضمت إلى مساحتك على نفس شبكة الواي فاي.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("No devices have joined yet. Share the join code above.", "لا توجد أجهزة انضمت بعد. شارك كود الانضمام أعلاه.")}
                </p>
              ) : (
                <ul className="divide-y">
                  {devices.map((device) => {
                    const online = isOnline(device, now);
                    return (
                      <li key={device.id} className="flex items-center gap-3 py-3">
                        {online ? (
                          <Monitor className="size-5 text-success" />
                        ) : (
                          <MonitorOff className="size-5 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{device.name}</p>
                            {device.isHost ? (
                              <Badge variant="secondary">{t("Host", "الخادم")}</Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {device.ip ?? "—"}
                            {device.currentUserName ? ` · ${device.currentUserName}` : ""}
                          </p>
                        </div>
                        <Badge variant={online ? "success" : "muted"}>
                          {online ? t("Online", "متصل") : t("Offline", "غير متصل")}
                        </Badge>
                        {!device.isHost ? (
                          <Button variant="ghost" size="icon" onClick={() => void kick(device)} aria-label={t("Remove device", "إزالة الجهاز")}>
                            <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("Delete the host workspace?", "حذف مساحة الخادم؟")}
        description={t(
          "This disconnects all devices and removes the host. You can then create a new workspace with a different name.",
          "سيتم فصل جميع الأجهزة وحذف الخادم. يمكنك بعد ذلك إنشاء مساحة جديدة باسم مختلف.",
        )}
        confirmLabel={t("Delete host", "حذف الخادم")}
        loading={deleting}
        onConfirm={() => void deleteHost()}
      />
    </div>
  );
}
