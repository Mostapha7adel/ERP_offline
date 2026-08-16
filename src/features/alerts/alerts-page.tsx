import { useCallback, useEffect, useState } from "react";
import {
  BellRing, AlertTriangle, PackageX, CalendarClock, Receipt, RefreshCw, BadgeCheck, Siren,
} from "lucide-react";
import { alertsApi } from "@/lib/api";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import type { AlertItem, AlertsSummary } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { StateShell } from "@/shared/components/feedback/states";

const KIND_META: Record<
  AlertItem["kind"],
  { label: string; labelAr: string; icon: typeof BellRing; color: string }
> = {
  "low-stock": { label: "Low stock", labelAr: "مخزون منخفض", icon: PackageX, color: "text-destructive" },
  "overdue-invoice": { label: "Overdue invoices", labelAr: "فواتير متأخرة", icon: Receipt, color: "text-destructive" },
  "expiring-batch": { label: "Expiring batches", labelAr: "دفعات تنتهي", icon: CalendarClock, color: "text-warning" },
  "recurring-due": { label: "Recurring due", labelAr: "فواتير دورية", icon: CalendarClock, color: "text-primary" },
};

const KIND_ORDER: AlertItem["kind"][] = ["low-stock", "overdue-invoice", "expiring-batch", "recurring-due"];

const KIND_TO_KEY: Record<AlertItem["kind"], keyof AlertsSummary> = {
  "low-stock": "lowStock",
  "overdue-invoice": "overdueInvoices",
  "expiring-batch": "expiringBatches",
  "recurring-due": "recurringDue",
};

export function AlertsPage() {
  const { t } = useT();
  const canView = usePermission("alerts.view");
  const [summary, setSummary] = useState<AlertsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await alertsApi().summary());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to load alerts", "فشل تحميل التنبيهات"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const notify = async () => {
    setNotifying(true);
    try {
      const res = await alertsApi().notify();
      toast.success(
        res.created > 0
          ? t("${n} alerts pushed to the notification feed", "تم دفع ${n} تنبيه إلى الإشعارات").replace("${n}", String(res.created))
          : t("No new alerts to push", "لا توجد تنبيهات جديدة"),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Notify failed", "فشل الإشعار"));
    } finally {
      setNotifying(false);
    }
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("Alerts", "التنبيهات")} description={t("Smart inventory and receivable alerts.", "تنبيهات ذكية للمخزون والمستحقات.")} />
        <Card>
          <StateShell icon={Siren} title={t("No access", "لا توجد صلاحية")} description={t("You don't have permission to view alerts.", "لا تملك صلاحية عرض التنبيهات.")} />
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("Alerts", "التنبيهات")} description={t("Smart inventory and receivable alerts.", "تنبيهات ذكية للمخزون والمستحقات.")}>
          <Button variant="outline" onClick={notify} loading={notifying}>
            <BellRing className="size-4" /> {t("Push to notifications", "إرسال للإشعارات")}
          </Button>
        </PageHeader>
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const total = summary?.total ?? 0;
  const items: AlertItem[] = summary
    ? KIND_ORDER.flatMap((k) => summary[KIND_TO_KEY[k]] as AlertItem[])
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Alerts", "التنبيهات")}
        description={t("Smart inventory and receivable alerts.", "تنبيهات ذكية للمخزون والمستحقات.")}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="size-4" /> {t("Refresh", "تحديث")}
          </Button>
          <Button onClick={notify} loading={notifying}>
            <BellRing className="size-4" /> {t("Push to notifications", "إرسال للإشعارات")}
          </Button>
        </div>
      </PageHeader>

      {total === 0 ? (
        <Card>
          <StateShell
            icon={BadgeCheck}
            title={t("All clear", "كل شيء على ما يرام")}
            description={t("No alerts right now. We'll notify you when something needs attention.", "لا توجد تنبيهات الآن. سنخطرك عند الحاجة.")}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {KIND_ORDER.map((kind) => {
              const meta = KIND_META[kind];
              const count = summary?.counts[kind] ?? 0;
              const Icon = meta.icon;
              return (
                <Card key={kind}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className={`size-5 ${meta.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t(meta.label, meta.labelAr)}</p>
                        <p className="text-2xl font-semibold tabular-nums">{count}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">
                {t("Active alerts", "التنبيهات النشطة")} ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("No items in this feed.", "لا توجد عناصر في هذه القائمة.")}
                </p>
              ) : (
                items.map((item, index) => {
                  const meta = KIND_META[item.kind as AlertItem["kind"]];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={`${item.kind}-${item.resourceId}-${index}`}
                      className="flex items-start gap-3 rounded-xl border p-3"
                    >
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className={`size-4 ${meta.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{item.title}</p>
                          {item.severity === "danger" ? (
                            <Badge variant="destructive">{t("Critical", "حرج")}</Badge>
                          ) : item.severity === "warning" ? (
                            <Badge variant="warning">{t("Warning", "تحذير")}</Badge>
                          ) : (
                            <Badge variant="outline">{t("Info", "معلومة")}</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{item.message}</p>
                      </div>
                      {item.date ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {item.date.slice(0, 10)}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {t(
              "Alerts refresh automatically in the background. Use “Push to notifications” to surface them in the notification feed.",
              "تتحدث التنبيهات تلقائياً في الخلفية. استخدم «إرسال للإشعارات» لإظهارها في خلاصة الإشعارات.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}