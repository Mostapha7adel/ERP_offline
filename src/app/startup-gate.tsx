import { useEffect, useState } from "react";
import { useBackendStatus, type BackendStatus } from "@/lib/api/backend-status";
import { hydrateAll } from "@/lib/api/hydration";
import { getDeviceConfig, clearDeviceConfig } from "@/lib/api/config";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/shared/components/ui/button";
import { AlertTriangle, ChevronDown, Clipboard, LoaderCircle, Network, ShieldCheck } from "lucide-react";
import { APP_NAME } from "@/config/app";
import { AppLogo } from "@/shared/components/layout/app-logo";

async function readBackendLog(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("backend_log_tail");
  } catch {
    return "(diagnostics unavailable outside the desktop app)";
  }
}

function BackendLogPanel() {
  const [log, setLog] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let disposed = false;
    void readBackendLog().then((text) => {
      if (!disposed) setLog(text);
    });
    return () => {
      disposed = true;
    };
  }, []);

  async function copyLog() {
    if (log == null) return;
    try {
      await navigator.clipboard.writeText(log);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="w-full space-y-2 text-left">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between text-xs text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Show diagnostic log</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open ? (
        <div className="space-y-2">
          <pre className="max-h-40 overflow-auto rounded-lg border bg-muted p-3 text-[10px] leading-relaxed text-muted-foreground">
            {log ?? "Loading…"}
          </pre>
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={copyLog} disabled={log == null}>
            <Clipboard className="mr-2 size-3.5" />
            {copied ? "Copied" : "Copy log"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BackendScreen({ status }: { status: BackendStatus }) {
  if (status === "ready") return null;

  if (status === "error") {
    const isClient = getDeviceConfig().mode === "client";
    if (isClient) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
          <div className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8 text-center shadow-xl">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Network className="size-6" />
            </div>
            <h1 className="text-lg font-semibold">Cannot reach the workspace host</h1>
            <p className="text-sm text-muted-foreground">
              This device is set to connect to a host on your network, but the
              host computer is offline or the IP is wrong. Check that the host is
              on, or switch back to using this device locally.
            </p>
            <div className="space-y-2">
              <Button className="w-full" onClick={() => window.location.reload()}>
                Retry
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  clearDeviceConfig();
                  window.location.reload();
                }}
              >
                Use this device locally
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
        <div className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8 text-center shadow-xl">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <h1 className="text-lg font-semibold">Backend failed to start</h1>
          <p className="text-sm text-muted-foreground">
            The local service did not become ready within the time limit. This
            is usually a one-time delay while the database is created. Check the
            diagnostic log below, or try again.
          </p>
          <Button className="w-full" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <BackendLogPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-xl">
        <AppLogo className="size-12 rounded-xl" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground">Starting local database…</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          <span>This is a one-time operation.</span>
        </div>
      </div>
    </div>
  );
}

export function StartupGate({ children }: { children: React.ReactNode }) {
  const status = useBackendStatus();
  const isSessionValidating = useAuthStore((s) => s.isSessionValidating);
  const validateSession = useAuthStore((s) => s.validateSession);

  // Once the backend is ready, validate any persisted session against /auth/me.
  // A stale access token triggers a silent refresh; a failed refresh logs out.
  // After a successful silent restore we still hydrate all stores so the UI
  // reflects the current DB state (the persisted localStorage may be stale).
  // Anonymous boots skip hydration (no point firing unauthenticated calls).
  useEffect(() => {
    if (status !== "ready") return;
    void validateSession().then((valid) => {
      if (valid && useAuthStore.getState().isAuthenticated) {
        void hydrateAll().finally(() => useAuthStore.getState().setHydrated());
      }
    });
  }, [status, validateSession]);

  return (
    <>
      <BackendScreen status={status} />
      {status === "ready" && isSessionValidating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-xl">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-6" />
            </div>
            <h1 className="text-lg font-semibold">Checking session…</h1>
            <p className="text-sm text-muted-foreground">Verifying your saved sign-in.</p>
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
