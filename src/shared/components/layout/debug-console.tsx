import { useEffect, useRef, useState } from "react";
import { Bug, Trash2, X, CheckCircle2 } from "lucide-react";
import { useDebugLogStore } from "@/stores/debug-log-store";
import { setRequestLogger } from "@/lib/api/client";
import { useT } from "@/shared/lib/i18n";
import { useLocation } from "react-router-dom";

/** Map frontend routes → API path prefixes so we can filter per-page. */
function routeToApiPrefix(pathname: string): string | null {
  const map: Record<string, string> = {
    "/app/dashboard": "/health",
    "/app/customers": "/customers",
    "/app/suppliers": "/suppliers",
    "/app/products": "/products",
    "/app/warehouses": "/warehouses",
    "/app/inventory": "/stock",
    "/app/sales": "/invoices",
    "/app/purchases": "/invoices",
    "/app/quotes": "/quotes",
    "/app/recurring": "/recurring-invoices",
    "/app/notes": "/trade-notes",
    "/app/purchase-orders": "/purchase-orders",
    "/app/treasury": "/bank-accounts",
    "/app/accounting": "/accounts",
    "/app/fiscal-year": "/fiscal-years",
    "/app/assets": "/assets",
    "/app/advances": "/advances",
    "/app/reports": "/reports",
    "/app/users": "/users",
    "/app/profile": "/auth",
    "/app/settings": "/settings",
    "/app/backup": "/backup",
    "/app/alerts": "/alerts",
    "/app/import": "/import",
    "/app/currencies": "/currencies",
    "/app/devices": "/network",
    "/app/notifications": "/notifications",
  };
  return map[pathname] ?? null;
}

export function DebugConsole() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const entries = useDebugLogStore((s) => s.entries);
  const clear = useDebugLogStore((s) => s.clear);
  const addEntry = useDebugLogStore((s) => s.addEntry);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Wire the API client logger → only errors & warnings (skip successful 2xx)
  useEffect(() => {
    setRequestLogger((info) => {
      const isError =
        info.status !== null && info.status >= 400 || info.error;
      const isWarn =
        info.status !== null && info.status >= 300 && info.status < 400;
      // Only record problems — successful requests are noise
      if (!isError && !isWarn) return;
      addEntry({
        timestamp: new Date().toISOString(),
        method: info.method,
        path: info.path,
        status: info.status,
        duration: info.duration,
        level: isError ? "error" : "warn",
        error: info.error,
      });
    });
    return () => setRequestLogger(null);
  }, [addEntry]);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries.length, open]);

  // Errors relevant to the current page
  const apiPrefix = routeToApiPrefix(location.pathname);
  const pageErrors = apiPrefix
    ? entries.filter(
        (e) =>
          e.level === "error" &&
          (e.path.toLowerCase().includes(apiPrefix.toLowerCase()) ||
            e.path === "/auth/refresh" ||
            e.path === "/auth/logout"),
      )
    : entries.filter((e) => e.level === "error");

  const totalErrors = entries.filter((e) => e.level === "error").length;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={t("Errors Console", "الأخطاء")}
        aria-label={t("Errors Console", "الأخطاء")}
      >
        <Bug className="size-[18px]" />
        {totalErrors > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {totalErrors > 99 ? "99" : totalErrors}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed left-0 right-0 top-14 z-10 flex h-[50vh] flex-col border-t bg-background shadow-2xl sm:left-auto sm:right-4 sm:top-14 sm:w-[560px] sm:rounded-b-xl sm:border"
          style={{ zIndex: 15 }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Bug className="size-4 text-red-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Errors", "الأخطاء")}
            </span>
            <span className="ms-auto text-[10px] text-muted-foreground">
              {totalErrors} {t("total", "إجمالي")}
            </span>
            <button
              onClick={clear}
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t("Clear", "مسح")}
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Current page status */}
          <div className="border-b px-3 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-medium text-muted-foreground">
                {location.pathname.replace("/app/", "/").replace(/^\//, "") || "dashboard"}:
              </span>
              {pageErrors.length === 0 ? (
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle2 className="size-3" />
                  {t("OK — no errors", "لا يوجد أخطاء ✓")}
                </span>
              ) : (
                <span className="text-red-500 font-medium">
                  {pageErrors.length} {t("error(s)", "خطأ")}
                </span>
              )}
            </div>
          </div>

          {/* Error list */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed"
          >
            {entries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t("No errors so far…", "لا يوجد أخطاء حتى الآن...")}
              </div>
            ) : (
              entries
                .filter((e) => e.level === "error" || e.level === "warn")
                .map((e) => (
                  <div
                    key={e.id}
                    className={`flex items-start gap-2 border-b border-border/50 px-3 py-1.5 hover:bg-muted/30 ${
                      e.level === "error" ? "text-red-500" : "text-yellow-500"
                    }`}
                  >
                    <span className="shrink-0 text-muted-foreground/60">
                      {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className="shrink-0 w-12 font-bold">
                      {e.method}
                    </span>
                    <span className="flex-1 truncate text-foreground/80">
                      {e.path}
                    </span>
                    <span className="shrink-0 font-bold">
                      {e.status ?? "ERR"}
                    </span>
                    {e.error && (
                      <span className="shrink-0 max-w-[180px] truncate text-[10px] opacity-80">
                        {e.error}
                      </span>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
