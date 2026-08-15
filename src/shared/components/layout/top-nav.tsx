import { Search, Menu, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { hydrateAll } from "@/lib/api/hydration";
import { Kbd } from "@/shared/components/ui/kbd";
import { Breadcrumbs } from "@/shared/components/layout/breadcrumbs";
import { NotificationBell } from "@/shared/components/layout/notification-center";
import { ThemeToggle } from "@/shared/components/layout/theme-toggle";
import { LocaleToggle } from "@/shared/components/layout/locale-toggle";
import { UserMenu } from "@/shared/components/layout/user-menu";
import { useT } from "@/shared/lib/i18n";

function GlobalSearchButton() {
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const { t } = useT();
  return (
    <button
      onClick={() => setCommandOpen(true)}
      className="group hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
    >
      <Search className="size-4" />
      <span className="flex-1 text-start">{t("Search anything…", "ابحث عن أي شيء…")}</span>
      <Kbd>⌘K</Kbd>
    </button>
  );
}

/** Manual "pull to refresh" — re-fetches every dataset from the backend. */
function RefreshButton() {
  const { t } = useT();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await hydrateAll();
      useAuthStore.getState().setHydrated();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <button
      onClick={() => void onRefresh()}
      disabled={refreshing}
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
      aria-label={t("Refresh data", "تحديث البيانات")}
      title={t("Refresh data", "تحديث البيانات")}
    >
      <RefreshCw className={`size-[18px] ${refreshing ? "animate-spin" : ""}`} />
    </button>
  );
}

export function TopNav() {
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const { t } = useT();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      <button
        onClick={() => setMobileNavOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
        aria-label={t("Open navigation", "فتح قائمة التنقل")}
      >
        <Menu className="size-5" />
      </button>

      <Breadcrumbs />

      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          onClick={() => setCommandOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
          aria-label={t("Search", "بحث")}
        >
          <Search className="size-[18px]" />
        </button>
        <div className="hidden sm:block">
          <GlobalSearchButton />
        </div>
        <div className="ms-2 flex items-center gap-1">
          <RefreshButton />
          <LocaleToggle />
          <ThemeToggle />
          <NotificationBell />
          <div className="mx-1 h-6 w-px bg-border" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}