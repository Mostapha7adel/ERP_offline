import * as React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { NAV_SECTIONS, NOTIFICATIONS_ROUTE } from "@/config/navigation";
import { useUIStore } from "@/stores/ui-store";
import { useCan, useAuthStore } from "@/stores/auth-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { useLocaleStore } from "@/stores/locale-store";
import { useSettingsStore } from "@/stores/settings-store";
import { cn } from "@/lib/utils";
import { Brand } from "@/shared/components/layout/brand";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/shared/components/ui/tooltip";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

interface SectionItemProps {
  href: string;
  title: string;
  titleAr?: string;
  icon?: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  badge?: number;
}

function SectionItem({ href, title, titleAr, icon: Icon, collapsed, badge }: SectionItemProps) {
  const location = useLocation();
  const locale = useLocaleStore((s) => s.locale);
  const isActive = location.pathname === href;
  const label = locale === "ar" ? (titleAr ?? title) : title;
  const button = (
    <NavLinkShell href={href} isActive={isActive}>
      {Icon ? (
        <span
          className={cn(
            "absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-primary transition-all",
            isActive ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
      {Icon ? <Icon className="size-[18px] shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" /> : null}
      {!collapsed ? (
        <span
          className={cn(
            "flex-1 truncate",
            isActive ? "font-semibold text-foreground" : "text-foreground/80 group-hover:text-foreground",
          )}
        >
          {label}
        </span>
      ) : null}
      {!collapsed && badge && badge > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </NavLinkShell>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side={locale === "ar" ? "left" : "right"} sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

function NavLinkInner({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
      )}
    >
      {children}
    </NavLink>
  );
}

const NavLinkShell = NavLinkInner;

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const can = useCan();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const unread = useNotificationsStore((s) => s.unreadCount());
  const locale = useLocaleStore((s) => s.locale);
  const hiddenPages = useSettingsStore((s) => s.hiddenPages);

  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        can(item.permission) &&
        (!item.superAdminOnly || isSuperAdmin) &&
        (item.hiddenFromPageManager || !hiddenPages.includes(item.href.replace("/app/", ""))),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative z-30 hidden h-full shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground lg:flex"
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border",
          collapsed ? "justify-center" : "justify-start px-4",
        )}
      >
        <Brand showText={!collapsed} />
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <TooltipProvider delayDuration={400}>
          <nav className="flex flex-col gap-5">
            {filteredSections.map((section) => (
              <div key={section.title} className="space-y-0.5">
                <AnimatePresence initial={false} mode="wait">
                  {!collapsed ? (
                    <motion.p
                      key="label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mb-1 truncate px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {locale === "ar" ? (section.titleAr ?? section.title) : section.title}
                    </motion.p>
                  ) : (
                    <motion.div
                      key="rule"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mx-3 mb-1 h-px bg-border"
                    />
                  )}
                </AnimatePresence>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <SectionItem key={item.href} href={item.href} title={item.title} titleAr={item.titleAr} icon={item.icon} collapsed={collapsed} />
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t border-sidebar-border pt-2">
              <SectionItem
                href={NOTIFICATIONS_ROUTE.href}
                title={NOTIFICATIONS_ROUTE.title}
                titleAr={NOTIFICATIONS_ROUTE.titleAr}
                icon={NOTIFICATIONS_ROUTE.icon}
                collapsed={collapsed}
                badge={unread}
              />
            </div>
          </nav>
        </TooltipProvider>
      </ScrollArea>
    </motion.aside>
  );
}