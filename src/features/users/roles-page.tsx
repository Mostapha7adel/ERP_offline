import { useState } from "react";
import { ListChecks, Pencil, Save, Shield } from "lucide-react";
import { useRolesStore } from "@/stores/system-store";
import { usePermission } from "@/shared/components/permission-gate";
import { rolesApi } from "@/lib/api";
import { mapFrontendPermissionsToBackend } from "@/lib/api/permissions";
import { permissionLabels, groupPermissions } from "@/lib/permissions";
import type { PermissionKey } from "@/types/navigation";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { StateShell } from "@/shared/components/feedback/states";
import { AvatarPicker } from "@/shared/components/forms/avatar-picker";
import { initials } from "@/lib/utils";
import { useT } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import type { AppRole } from "@/types/domain";

const GROUP_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  suppliers: "Suppliers",
  products: "Products",
  warehouses: "Warehouses",
  inventory: "Inventory",
  sales: "Sales",
  purchases: "Purchases",
  quotes: "Quotes",
  recurring: "Recurring",
  treasury: "Treasury",
  accounting: "Accounting",
  reports: "Reports",
  users: "Users",
  roles: "Roles",
  settings: "Settings",
  backup: "Backup",
};

const GROUP_LABELS_AR: Record<string, string> = {
  dashboard: "لوحة التحكم",
  customers: "العملاء",
  suppliers: "الموردون",
  products: "المنتجات",
  warehouses: "المستودعات",
  inventory: "المخزون",
  sales: "المبيعات",
  purchases: "المشتريات",
  quotes: "عروض الأسعار",
  recurring: "الفواتير الدورية",
  treasury: "الخزينة",
  accounting: "المحاسبة",
  reports: "التقارير",
  users: "المستخدمون",
  roles: "الأدوار",
  settings: "الإعدادات",
  backup: "النسخ الاحتياطي",
};

const PERMISSION_LABELS_AR: Record<PermissionKey, string> = {
  "dashboard.view": "عرض لوحة التحكم",
  "customers.view": "عرض العملاء",
  "customers.create": "إنشاء عملاء",
  "customers.update": "تعديل العملاء",
  "customers.delete": "حذف العملاء",
  "suppliers.view": "عرض الموردين",
  "suppliers.create": "إنشاء موردين",
  "suppliers.update": "تعديل الموردين",
  "suppliers.delete": "حذف الموردين",
  "products.view": "عرض المنتجات",
  "products.create": "إنشاء منتجات",
  "products.update": "تعديل المنتجات",
  "products.delete": "حذف المنتجات",
  "warehouses.view": "عرض المستودعات",
  "warehouses.create": "إنشاء مستودعات",
  "warehouses.update": "تعديل المستودعات",
  "warehouses.delete": "حذف المستودعات",
  "inventory.view": "عرض المخزون",
  "inventory.adjust": "تعديل مستويات المخزون",
  "sales.view": "عرض المبيعات",
  "sales.create": "إنشاء مبيعات",
  "sales.update": "تعديل المبيعات",
  "sales.delete": "حذف المبيعات",
  "purchases.view": "عرض المشتريات",
  "purchases.create": "إنشاء مشتريات",
  "purchases.update": "تعديل المشتريات",
  "purchases.delete": "حذف المشتريات",
  "quotes.view": "عرض عروض الأسعار",
  "quotes.create": "إنشاء عروض الأسعار",
  "quotes.update": "تعديل عروض الأسعار",
  "quotes.delete": "حذف عروض الأسعار",
  "recurring.view": "عرض الفواتير الدورية",
  "recurring.create": "إنشاء فواتير دورية",
  "recurring.update": "تعديل الفواتير الدورية",
  "recurring.delete": "حذف الفواتير الدورية",
  "treasury.view": "عرض الخزينة",
  "treasury.create": "تسجيل المعاملات",
  "accounting.view": "عرض المحاسبة",
  "accounting.post": "ترحيل القيود",
  "notes.view": "عرض الإشعارات",
  "notes.create": "إنشاء إشعارات",
  "notes.update": "تعديل الإشعارات",
  "notes.void": "إلغاء الإشعارات",
  "reports.view": "عرض التقارير",
  "users.view": "عرض المستخدمين",
  "users.create": "إنشاء مستخدمين",
  "users.update": "تعديل المستخدمين",
  "users.delete": "حذف المستخدمين",
  "roles.view": "عرض الأدوار",
  "roles.manage": "إدارة الأدوار والصلاحيات",
  "settings.view": "عرض الإعدادات",
  "settings.update": "تعديل الإعدادات",
  "backup.manage": "إدارة النسخ الاحتياطي والاستعادة",
  "network.view": "عرض الشبكة والأجهزة",
};

const GROUP_ORDER = [
  "dashboard", "customers", "suppliers", "products", "warehouses",
  "inventory", "sales", "purchases", "quotes", "recurring", "treasury", "accounting",
  "reports", "users", "roles", "settings", "backup",
];

export function RolesPage() {
  return (
    <div className="space-y-6">
      <RolesPanel />
    </div>
  );
}

export function RolesPanel() {
  const roles = useRolesStore((s) => s.items);
  const update = useRolesStore((s) => s.update);
  const canManage = usePermission("roles.manage");
  const loading = useSimulatedLoading(650);
  const { t } = useT();

  const [selectedId, setSelectedId] = useState<string>(roles[0]?.id ?? "");
  const [draft, setDraft] = useState<AppRole | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0];
  const dirty = draft
    ? draft.permissions.join() !== selected?.permissions.join() ||
      (draft.avatarUrl ?? "") !== (selected?.avatarUrl ?? "")
    : false;

  const toggle = (permission: PermissionKey) => {
    if (!draft) return;
    setDraft({
      ...draft,
      permissions: draft.permissions.includes(permission)
        ? draft.permissions.filter((p) => p !== permission)
        : [...draft.permissions, permission],
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <div className="lg:col-span-3">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <Card>
        <StateShell
          icon={Shield}
          title={t("No roles configured", "لا توجد أدوار مكونة")}
          description={t("Roles are created automatically with your workspace. Contact an administrator.", "يتم إنشاء الأدوار تلقائياً مع مساحة عملك. تواصل مع مدير النظام.")}
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="h-fit lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("ROLES", "الأدوار")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setSelectedId(role.id);
                  setDraft(null);
                }}
                className={`flex w-full flex-col rounded-lg px-3 py-2.5 text-start transition-colors ${selectedId === role.id ? "bg-muted" : "hover:bg-muted/60"}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {role.avatarUrl ? (
                    <img src={role.avatarUrl} alt="" className="size-5 rounded-full object-cover" />
                  ) : null}
                  {role.name}
                  {role.isSystem && <Badge variant="outline">{t("System", "النظام")}</Badge>}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">{role.permissions.length} {t("permissions", "صلاحية")}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <AvatarPicker
                  value={selected?.avatarUrl ?? draft?.avatarUrl}
                  fallback={initials(selected?.name ?? "R")}
                  disabled={!canManage}
                  onChange={(avatarUrl) => {
                    const base = draft ?? selected;
                    if (!base) return;
                    setDraft({ ...base, avatarUrl: avatarUrl || undefined });
                  }}
                />
                <div>
                  <CardTitle>{selected?.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{selected?.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={!canManage || !draft} onClick={() => setDraft(null)}>
                  <ListChecks className="size-4" /> {t("Reset", "إعادة تعيين")}
                </Button>
                <Button
                  size="sm"
                  disabled={!canManage || !dirty}
                  loading={saving}
                  onClick={async () => {
                    if (draft && selected) {
                      setSaving(true);
                      try {
                        const updated = await rolesApi().update(selected.id, {
                          name: draft.name,
                          description: draft.description,
                          avatarUrl: draft.avatarUrl || undefined,
                          permissions: mapFrontendPermissionsToBackend(draft.permissions),
                        });
                        update(updated.id, updated);
                        setDraft(null);
                        toast.success(t("${name} permissions updated", "تم تحديث صلاحيات ${name}").replace("${name}", draft.name));
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : t("Update failed", "فشل التحديث"));
                      } finally {
                        setSaving(false);
                      }
                    }
                  }}
                >
                  <Save className="size-4" /> {t("Save changes", "حفظ التغييرات")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RoleEditor
                selected={selected}
                draft={draft}
                onToggle={toggle}
                onEdit={() => setDraft(selected ? { ...selected } : null)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RoleEditor({
  selected, draft, onToggle, onEdit,
}: {
  selected: AppRole | undefined;
  draft: AppRole | null;
  onToggle: (p: PermissionKey) => void;
  onEdit: () => void;
}) {
  const { t } = useT();
  if (!selected) return null;
  const permissions = draft?.permissions ?? selected.permissions;
  const groups = groupPermissions(permissions);
  const order = GROUP_ORDER.filter((g) => groups[g]);

  if (!draft) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-4" /> {t("Edit permissions", "تعديل الصلاحيات")}
        </Button>
        {order.map((group) => (
          <div key={group}>
            <p className="mb-2 text-sm font-medium">{t(GROUP_LABELS[group] ?? group, GROUP_LABELS_AR[group] ?? group)}</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {groups[group]?.map((p) => (
                <div key={p} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{t(permissionLabels[p as PermissionKey] ?? p, PERMISSION_LABELS_AR[p as PermissionKey] ?? p)}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">{p}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {order.map((group) => (
        <div key={group} className="rounded-xl border p-4">
          <p className="mb-3 text-sm font-medium">{t(GROUP_LABELS[group] ?? group, GROUP_LABELS_AR[group] ?? group)}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {groups[group]?.map((perm) => {
              const key = perm as PermissionKey;
              const checked = (permissions as string[]).includes(key);
              return (
                <label key={perm} className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm">
                  <span>{t(permissionLabels[key] ?? perm, PERMISSION_LABELS_AR[key] ?? perm)}</span>
                  <Switch
                    checked={checked}
                    onCheckedChange={() => onToggle(key)}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}