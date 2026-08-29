import { useEffect, useRef, useState } from "react";
import { Bug, Trash2, X, Filter } from "lucide-react";
import { useDebugLogStore } from "@/stores/debug-log-store";
import { setRequestLogger } from "@/lib/api/client";
import type { LogLevel } from "@/stores/debug-log-store";
import { useT } from "@/shared/lib/i18n";

function levelColor(level: LogLevel): string {
  switch (level) {
    case "error":
      return "text-red-500";
    case "warn":
      return "text-yellow-500";
    default:
      return "text-muted-foreground";
  }
}

function statusColor(status: number | null): string {
  if (status === null) return "text-red-500";
  if (status >= 500) return "text-red-500";
  if (status >= 400) return "text-yellow-500";
  if (status >= 300) return "text-blue-500";
  return "text-green-500";
}

function methodColor(method: string): string {
  switch (method) {
    case "POST":
      return "text-blue-400";
    case "PUT":
    case "PATCH":
      return "text-yellow-400";
    case "DELETE":
      return "text-red-400";
    default:
      return "text-green-400";
  }
}

export function DebugConsole() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const entries = useDebugLogStore((s) => s.entries);
  const filter = useDebugLogStore((s) => s.filter);
  const levelFilter = useDebugLogStore((s) => s.levelFilter);
  const setFilter = useDebugLogStore((s) => s.setFilter);
  const setLevelFilter = useDebugLogStore((s) => s.setLevelFilter);
  const clear = useDebugLogStore((s) => s.clear);
  const addEntry = useDebugLogStore((s) => s.addEntry);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll] = useState(true);

  // Wire the API client logger → the debug log store
  useEffect(() => {
    setRequestLogger((info) => {
      const level: LogLevel =
        info.status !== null && info.status >= 400
          ? "error"
          : info.status !== null && info.status >= 300
            ? "warn"
            : info.error
              ? "error"
              : "info";
      addEntry({
        timestamp: new Date().toISOString(),
        method: info.method,
        path: info.path,
        status: info.status,
        duration: info.duration,
        level,
        error: info.error,
      });
    });
    return () => setRequestLogger(null);
  }, [addEntry]);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries.length, autoScroll]);

  const filtered = entries.filter((e) => {
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (
        e.path.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        (e.error ?? "").toLowerCase().includes(q) ||
        String(e.status).includes(q)
      );
    }
    return true;
  });

  const errorCount = entries.filter((e) => e.level === "error").length;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={t("Debug Console", "لوحة التتبع")}
        aria-label={t("Debug Console", "لوحة التتبع")}
      >
        <Bug className="size-[18px]" />
        {errorCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {errorCount > 99 ? "99" : errorCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[45vh] flex-col border-t bg-background shadow-2xl sm:bottom-4 sm:left-auto sm:right-4 sm:w-[560px] sm:rounded-xl sm:border sm:h-[50vh]">
          {/* Header */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Bug className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("API Console", "متابعة الطلبات")}
            </span>
            <span className="ms-auto text-[10px] text-muted-foreground">
              {entries.length} {t("entries", "سجل")}
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

          {/* Filters */}
          <div className="flex items-center gap-2 border-b px-3 py-1.5">
            <Filter className="size-3 text-muted-foreground" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("Filter…", "بحث...")}
              className="flex-1 bg-transparent px-1 py-0.5 text-xs outline-none placeholder:text-muted-foreground"
            />
            <div className="flex gap-0.5">
              {(["all", "info", "warn", "error"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    levelFilter === lvl
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lvl === "all" ? "All" : lvl.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Log entries */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed"
          >
            {filtered.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t("No requests yet…", "لا يوجد طلبات بعد...")}
              </div>
            ) : (
              filtered.map((e) => (
                <div
                  key={e.id}
                  className={`flex items-start gap-2 border-b border-border/50 px-3 py-1 hover:bg-muted/30 ${levelColor(e.level)}`}
                >
                  <span className="shrink-0 text-muted-foreground/60">
                    {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span
                    className={`shrink-0 w-12 font-bold ${methodColor(e.method)}`}
                  >
                    {e.method}
                  </span>
                  <span className="flex-1 truncate text-foreground/80">
                    {e.path}
                  </span>
                  <span className={`shrink-0 font-bold ${statusColor(e.status)}`}>
                    {e.status ?? "ERR"}
                  </span>
                  <span className="shrink-0 text-muted-foreground/60">
                    {e.duration != null ? `${e.duration}ms` : "—"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
