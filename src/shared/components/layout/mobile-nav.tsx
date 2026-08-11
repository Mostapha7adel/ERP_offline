import { NavLink } from "react-router-dom";
import { NAV_SECTIONS, NOTIFICATIONS_ROUTE } from "@/config/navigation";
import { useUIStore } from "@/stores/ui-store";
import { useCan, useAuthStore } from "@/stores/auth-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { useLocaleStore } from "@/stores/locale-store";
import { useT } from "@/shared/lib/i18n";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { Brand } from "@/shared/components/layout/brand";
import { Separator } from "@/shared/components/ui/separator";

export function MobileNav() {
  const open = useUIStore((s) => s.mobileNavOpen);
  const setOpen = useUIStore((s) => s.setMobileNavOpen);
  const can = useCan();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const unread = useNotificationsStore((s) => s.unreadCount());
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useT();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => can(item.permission) && (!item.superAdminOnly || isSuperAdmin),
    ),
  })).filter((s) => s.items.length > 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side={locale === "ar" ? "right" : "left"} className="w-72 p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle asChild>
            <Brand />
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-4 overflow-y-auto p-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.titleAr ?? section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground/80 hover:bg-accent/60",
                      )
                    }
                  >
                    {item.icon ? <item.icon className="size-[18px] shrink-0" /> : null}
                    <span className="flex-1">{item.titleAr ?? item.title}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          <Separator />
          <NavLink
            to={NOTIFICATIONS_ROUTE.href}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/80 hover:bg-accent/60",
              )
            }
          >
            <NOTIFICATIONS_ROUTE.icon className="size-[18px] shrink-0" />
            <span className="flex-1">{t("Notifications", "الإشعارات")}</span>
            {unread > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {unread}
              </span>
            ) : null}
          </NavLink>
        </nav>
      </SheetContent>
    </Sheet>
  );
}