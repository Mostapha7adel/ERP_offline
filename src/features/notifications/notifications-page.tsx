import { CheckCircle2, Check, Info, Trash2, TriangleAlert } from "lucide-react";
import { useNotificationsStore } from "@/stores/notifications-store";
import { timeAgo } from "@/lib/format";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { EmptyState } from "@/shared/components/feedback/states";
import { useNavigate } from "react-router-dom";
import type { NotificationKind } from "@/types/domain";

const KIND_STYLES: Record<NotificationKind, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
};

const KIND_ICONS: Record<NotificationKind, typeof Info> = {
  success: CheckCircle2,
  warning: TriangleAlert,
  error: Trash2,
  info: Info,
};

export function NotificationsPage() {
  const items = useNotificationsStore((s) => s.items);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);
  const navigate = useNavigate();
  const { t } = useT();

  const unread = items.filter((i) => !i.read).length;

  const handleAction = (item: (typeof items)[number]) => {
    if (!item.read) markRead(item.id);
    if (item.action) navigate(item.action.to);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("Notifications", "الإشعارات")} description={t("Stay up to date with activity in your workspace.", "ابقَ على اطلاع على النشاط في مساحة عملك.")}>
        {unread > 0 && (
          <Button variant="outline" onClick={() => { markAllRead(); toast.success(t("All notifications marked as read", "تم تحديد جميع الإشعارات كمقروءة")); }}>
            <Check className="size-4" /> {t("Mark all read", "تحديد الكل كمقروء")}
          </Button>
        )}
      </PageHeader>

      <Card>
        <div className="divide-y">
          {items.length === 0 ? (
            <div className="flex justify-center pt-8">
              <EmptyState title={t("All caught up", "لا جديد لديك")} description={t("You have no notifications.", "لا توجد لديك إشعارات.")} />
            </div>
          ) : (
            items.map((item) => {
              const Icon = KIND_ICONS[item.kind] ?? Info;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAction(item)}
                  className={`flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/50 ${!item.read ? "bg-muted/30" : ""}`}
                >
                  <div className={`mt-0.5 rounded-lg p-2 ${KIND_STYLES[item.kind]}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      {!item.read && <Badge variant="secondary" className="!bg-primary/10 !text-primary">{t("New", "جديد")}</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">{timeAgo(item.createdAt)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                    aria-label={t("Dismiss", "إغلاق")}
                  >
                    <Trash2 />
                  </Button>
                </button>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}