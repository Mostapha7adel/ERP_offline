import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Info, TriangleAlert, X, CircleX, ExternalLink, BellOff } from "lucide-react";
import { useNotificationsStore } from "@/stores/notifications-store";
import { notificationsApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Separator } from "@/shared/components/ui/separator";
import { useT } from "@/shared/lib/i18n";
import type { NotificationKind } from "@/types/domain";

const kindStyles: Record<NotificationKind, { icon: typeof Info; classes: string }> = {
  info: { icon: Info, classes: "bg-info/10 text-info" },
  success: { icon: Check, classes: "bg-success/10 text-success" },
  warning: { icon: TriangleAlert, classes: "bg-warning/15 text-warning" },
  error: { icon: CircleX, classes: "bg-destructive/10 text-destructive" },
};

export function NotificationBell() {
  const unread = useNotificationsStore((s) => s.unreadCount());
  const { t } = useT();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t("Notifications", "الإشعارات")}
        >
          <Bell className="size-[18px]" />
          {unread > 0 ? (
            <span className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0" sideOffset={8}>
        <NotificationPanel variant="popover" />
      </PopoverContent>
    </Popover>
  );
}

export function NotificationPanel({ variant = "popover" }: { variant?: "popover" | "page" }) {
  const items = useNotificationsStore((s) => s.items);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const markRead = useNotificationsStore((s) => s.markRead);
  const remove = useNotificationsStore((s) => s.remove);
  const navigate = useNavigate();
  const { t } = useT();
  const unread = items.filter((n) => !n.read).length;

  const handleMarkRead = (id: string) => {
    markRead(id);
    notificationsApi()
      .markRead(id)
      .catch(() => undefined);
  };

  const handleMarkAllRead = () => {
    markAllRead();
    notificationsApi()
      .markAllRead()
      .catch(() => undefined);
  };

  return (
    <div className={cn(variant === "page" && "rounded-xl border bg-card")}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t("Notifications", "الإشعارات")}</h3>
          {unread > 0 ? (
            <Badge className="px-1.5 text-[10px]">{unread}</Badge>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleMarkAllRead}
          disabled={unread === 0}
          aria-label={t("Mark all as read", "تحديد الكل كمقروء")}
          title={t("Mark all as read", "تحديد الكل كمقروء")}
        >
          <CheckCheck className="size-4" />
        </Button>
      </div>

      <ScrollArea className={variant === "popover" ? "h-[360px]" : "h-[60vh]"}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <BellOff className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t("You're all caught up", "كل شيء تحت السيطرة")}</p>
            <p className="text-xs text-muted-foreground">{t("No notifications right now.", "لا توجد إشعارات حالياً.")}</p>
          </div>
        ) : (
          <div>
            {items.map((notification, index) => {
              const style = kindStyles[notification.kind];
              const Icon = style.icon;
              return (
                <div key={notification.id}>
                  {index > 0 ? <Separator /> : null}
                  <div
                    className={cn(
                      "group flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                      !notification.read && "bg-accent/30",
                    )}
                  >
                    <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", style.classes)}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{notification.title}</p>
                        <div className="flex items-center gap-1">
                          {!notification.read ? (
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                          ) : null}
                          <button
                            onClick={() => remove(notification.id)}
                            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                            aria-label={t("Dismiss", "إخفاء")}
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
                      <div className="mt-1 flex items-center gap-3">
                        {notification.actorName ? (
                          <span className="text-xs text-muted-foreground">
                            {t("By", "بواسطة")} <span className="font-medium text-foreground/80">{notification.actorName}</span>
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(notification.createdAt)}
                        </span>
                        {notification.action ? (
                          <button
                            onClick={() => {
                              handleMarkRead(notification.id);
                              navigate(notification.action!.to);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            {notification.action.label}
                            <ExternalLink className="size-3 rtl:rotate-180" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}