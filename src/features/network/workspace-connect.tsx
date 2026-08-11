import { useEffect, useState } from "react";
import { Network, Unplug, Plus, CheckCircle2, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  networkApi,
  getDeviceConfig,
  saveDeviceConfig,
  clearDeviceConfig,
  getDeviceId,
  getDefaultDeviceName,
} from "@/lib/api";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";

const joinSchema = z.object({
  host: z.string().min(1, "Host IP is required").regex(/^[\d.:a-zA-Z-]+$/, "Enter a valid host address"),
  code: z.string().min(1, "Join code is required").max(16),
  deviceName: z.string().min(1, "Device name is required").max(120),
});

type JoinValues = z.infer<typeof joinSchema>;

function normalizeHost(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^https?:\/\//, "").replace(/:\d+$/, "");
}

/**
 * Connect this device to a host's LAN workspace (enter host IP + join code) or
 * show the current connection. Rendered on the login page so a device can join
 * before signing in against the host's database.
 */
export function WorkspaceConnect() {
  const { t } = useT();
  const [connected, setConnected] = useState(() => getDeviceConfig().mode === "client");
  const [host, setHost] = useState(() => getDeviceConfig().host ?? "");
  const [expanded, setExpanded] = useState(false);
  const [joining, setJoining] = useState(false);

  const form = useForm<JoinValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { host: getDeviceConfig().host ?? "", code: "", deviceName: getDefaultDeviceName() },
  });

  // Keep the header state in sync if config changes elsewhere.
  useEffect(() => {
    setConnected(getDeviceConfig().mode === "client");
  }, []);

  const join = async (values: JoinValues) => {
    setJoining(true);
    const prevConfig = getDeviceConfig();
    const prevAccess = getAccessToken();
    const prevRefresh = getRefreshToken();
    try {
      const host = normalizeHost(values.host);
      const deviceId = getDeviceId();
      const deviceName = values.deviceName.trim();
      // Point the API at the host first so the join request reaches it, and
      // drop any local session so no stale token is attached to host calls.
      saveDeviceConfig({ mode: "client", host, deviceName });
      clearTokens();
      const result = await networkApi().join({
        code: values.code.trim().toUpperCase(),
        deviceId,
        deviceName,
      });
      saveDeviceConfig({ mode: "client", host, deviceName, token: result.token });
      setConnected(true);
      setHost(host);
      setExpanded(false);
      toast.success(t("Connected to the workspace. Sign in with your account.", "تم الاتصال بالمساحة. سجّل الدخول بحسابك."));
    } catch (error) {
      // Restore the previous device mode and any local session so a failed
      // join leaves the device exactly as it was before the attempt.
      if (prevConfig.mode === "client" && prevConfig.host) {
        saveDeviceConfig(prevConfig);
      } else {
        clearDeviceConfig();
      }
      if (prevAccess) setAccessToken(prevAccess);
      if (prevRefresh) setRefreshToken(prevRefresh);
      toast.error(error instanceof Error ? error.message : t("Connection failed", "فشل الاتصال"));
    } finally {
      setJoining(false);
    }
  };

  const disconnect = () => {
    // Revoke the server-side refresh session and clear the auth state FIRST
    // (logout reads the refresh token), then drop the device config.
    void useAuthStore.getState().logout();
    clearDeviceConfig();
    setConnected(false);
    setHost("");
    form.reset({ host: "", code: "", deviceName: getDefaultDeviceName() });
    toast.success(t("Disconnected. The app now uses this device locally.", "تم قطع الاتصال. يستخدم التطبيق الآن هذا الجهاز محلياً."));
  };

  return (
    <div className="rounded-xl border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Network className="size-4 text-muted-foreground" />
          <span className="font-medium">{t("Workspace connection", "اتصال المساحة")}</span>
        </div>
        {connected ? (
          <Badge variant="success">
            <CheckCircle2 className="size-3" /> {host}
          </Badge>
        ) : (
          <Badge variant="secondary">{t("Local only", "محلي فقط")}</Badge>
        )}
      </div>

      {!connected ? (
        <>
          <Button type="button" variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={() => setExpanded((v) => !v)}>
            <Plus className="size-4" />
            {t("Connect to a workspace", "الاتصال بمساحة عمل")}
          </Button>
          {expanded ? (
            <form onSubmit={form.handleSubmit(join)} className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ws-host">{t("Host IP", "عنوان الخادم")}</Label>
                <Input id="ws-host" placeholder="192.168.1.10" {...form.register("host")} />
                {form.formState.errors.host ? (
                  <p className="text-xs text-destructive">{form.formState.errors.host.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ws-code">{t("Join code", "كود الانضمام")}</Label>
                <Input id="ws-code" placeholder="4DUBW2" {...form.register("code")} />
                {form.formState.errors.code ? (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ws-name">{t("Device name", "اسم الجهاز")}</Label>
                <Input id="ws-name" {...form.register("deviceName")} />
              </div>
              <Button type="submit" className="w-full" size="sm" loading={joining}>
                {joining ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" /> {t("Connecting…", "جارٍ الاتصال…")}
                  </>
                ) : (
                  t("Join workspace", "الانضمام إلى المساحة")
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Enter the host IP and the join code shown on the host device (the super admin's computer).",
                  "أدخل عنوان الخادم وكود الانضمام الظاهر على جهاز الخادم (كمبيوتر السوبر أدمن).",
                )}
              </p>
            </form>
          ) : null}
        </>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {t("Connected to the workspace. Sign in with your account below.", "متصل بالمساحة. سجّل الدخول بحسابك أدناه.")}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={disconnect}>
            <Unplug className="size-4" /> {t("Disconnect", "قطع الاتصال")}
          </Button>
        </div>
      )}
    </div>
  );
}
