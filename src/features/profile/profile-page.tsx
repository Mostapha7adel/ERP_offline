import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, BadgeCheck, ShieldCheck, Save, Pencil, Phone } from "lucide-react";
import { useT } from "@/shared/lib/i18n";
import { useAuthStore } from "@/stores/auth-store";
import { useRolesStore, useUsersStore } from "@/stores/system-store";
import { usersApi } from "@/lib/api";
import { permissionLabels, groupPermissions } from "@/lib/permissions";
import type { PermissionKey } from "@/types/navigation";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { initials } from "@/lib/utils";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/forms/form";
import { AvatarPicker } from "@/shared/components/forms/avatar-picker";

const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

const GROUP_ORDER = [
  "dashboard", "customers", "suppliers", "products", "warehouses",
  "inventory", "sales", "purchases", "quotes", "recurring", "treasury", "accounting",
  "tax-reports", "loyalty", "budgets", "landed-costs", "barcodes",
  "stock-transfers", "serial-numbers", "warranties", "payment-gateways",
  "reports", "users", "roles", "settings", "backup",
];

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
  "tax-reports": "Tax Reports",
  loyalty: "Loyalty",
  budgets: "Budgets",
  "landed-costs": "Landed Costs",
  barcodes: "Barcodes",
  "stock-transfers": "Stock Transfers",
  "serial-numbers": "Serial Numbers",
  warranties: "Warranties",
  "payment-gateways": "Payment Gateways",
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
  "tax-reports": "تقارير الضرائب",
  loyalty: "نقاط الولاء",
  budgets: "الميزانيات",
  "landed-costs": "تكاليف الشحن",
  barcodes: "الباركود",
  "stock-transfers": "نقل بين المخازن",
  "serial-numbers": "الأرقام التسلسلية",
  warranties: "الضمانات",
  "payment-gateways": "بوابات الدفع",
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
  "reports.create": "إنشاء التقارير",
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
  "purchase-orders.view": "عرض أوامر الشراء",
  "purchase-orders.create": "إنشاء أوامر الشراء",
  "purchase-orders.update": "تعديل أوامر الشراء",
  "purchase-orders.approve": "اعتماد أوامر الشراء",
  "purchase-orders.receive": "استلام أوامر الشراء",
  "purchase-orders.delete": "حذف أوامر الشراء",
  "assets.view": "عرض الأصول الثابتة",
  "assets.create": "إنشاء الأصول الثابتة",
  "assets.update": "تعديل الأصول الثابتة",
  "assets.depreciate": "تشغيل الإهلاك",
  "assets.delete": "حذف الأصول الثابتة",
  "currencies.view": "عرض العملات",
  "currencies.create": "إنشاء العملات",
  "currencies.update": "تعديل العملات",
  "currencies.delete": "حذف العملات",
  "advances.view": "عرض السلف",
  "advances.create": "إنشاء سلف",
  "advances.update": "تعديل وتخصيص السلف",
  "advances.delete": "حذف السلف",
  "alerts.view": "عرض التنبيهات",
  "import.create": "استيراد البيانات",
  "share.create": "مشاركة الفواتير وكشوف الحساب",
  "tax-reports.view": "عرض تقارير الضرائب",
  "loyalty.view": "عرض نقاط الولاء",
  "loyalty.create": "إنشاء نقاط الولاء",
  "loyalty.update": "تعديل نقاط الولاء",
  "loyalty.delete": "حذف نقاط الولاء",
  "budgets.view": "عرض الميزانيات",
  "budgets.create": "إنشاء ميزانيات",
  "budgets.update": "تعديل الميزانيات",
  "budgets.delete": "حذف الميزانيات",
  "landed-costs.view": "عرض تكاليف الشحن",
  "landed-costs.create": "إنشاء تكاليف الشحن",
  "landed-costs.update": "تعديل تكاليف الشحن",
  "landed-costs.delete": "حذف تكاليف الشحن",
  "barcodes.view": "عرض الباركود",
  "barcodes.create": "إنشاء باركود",
  "barcodes.delete": "حذف الباركود",
  "stock-transfers.view": "عرض تحويلات المخزون",
  "stock-transfers.create": "إنشاء تحويل مخزون",
  "stock-transfers.update": "تعديل تحويلات المخزون",
  "serial-numbers.view": "عرض الأرقام التسلسلية",
  "serial-numbers.create": "إنشاء أرقام تسلسلية",
  "warranties.view": "عرض الضمانات",
  "warranties.create": "إنشاء ضمانات",
  "warranties.claim": "المطالبة بالضمان",
  "payment-gateways.view": "عرض بوابات الدفع",
  "payment-gateways.create": "إدارة بوابات الدفع",
};

export function ProfilePage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const users = useUsersStore((s) => s.items);
  const roles = useRolesStore((s) => s.items);
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const updateCurrentUser = useAuthStore((s) => s.updateCurrentUser);
  const { t } = useT();

  // Prefer the hydrated record from the backend (it carries jobTitle/avatar),
  // falling back to the session principal for fields it may lack.
  const user = currentUser
    ? { ...currentUser, ...users.find((u) => u.id === currentUser.id) }
    : null;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");

  if (!user) return null;

  const role = roles.find((r) => r.id === user.roleId);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      phone: user.phone ?? "",
      jobTitle: user.jobTitle ?? "",
    },
  });

  const onSubmit = async (values: ProfileValues) => {
    setSaving(true);
    try {
      const updated = await usersApi().updateProfile({
        name: values.name,
        phone: values.phone || undefined,
        jobTitle: values.jobTitle || undefined,
        avatarUrl: avatarUrl || undefined,
      });
      updateCurrentUser(updated);
      setPhone(updated.phone ?? "");
      setEditing(false);
      toast.success(t("Profile updated", "تم تحديث الملف الشخصي"));
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  const displayPermissions = isSuperAdmin ? ["*"] : permissions;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Profile", "الملف الشخصي")}
        description={t("Your personal information and access permissions.", "معلوماتك الشخصية وصلاحيات الوصول لديك.")}
      >
        {editing ? (
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              loading={saving}
              form="profile-form"
              type="submit"
              onClick={() => form.handleSubmit(onSubmit)()}
            >
              <Save className="size-4" /> {t("Save changes", "حفظ التغييرات")}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> {t("Edit profile", "تعديل الملف")}
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("Account", "الحساب")}</CardTitle>
            <CardDescription>{t("Your identity in the workspace.", "هويتك داخل مساحة العمل.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {editing ? (
              <Form {...form}>
                <form id="profile-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                  <div>
                    <Label className="mb-2 block">{t("Profile photo", "الصورة الشخصية")}</Label>
                    <AvatarPicker
                      value={avatarUrl}
                      fallback={initials(form.watch("name") || user.name)}
                      fallbackColor={user.color}
                      disabled={saving}
                      onChange={setAvatarUrl}
                    />
                  </div>
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Full name *", "الاسم الكامل *")}</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="jobTitle" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Job title", "المسمى الوظيفي")}</FormLabel>
                      <FormControl><Input placeholder={t("e.g. Accountant", "مثال: محاسب")} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Phone", "الهاتف")}</FormLabel>
                      <FormControl><Input placeholder="+20 …" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </form>
              </Form>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3 text-center">
                  <Avatar className="size-20">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                    <AvatarFallback style={{ backgroundColor: user.color }} className="text-xl">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold">{user.name}</p>
                    {user.jobTitle ? (
                      <p className="text-sm text-muted-foreground">{user.jobTitle}</p>
                    ) : null}
                  </div>
                  <Badge variant={user.status === "active" ? "success" : "secondary"}>
                    {user.status === "active" ? t("Active", "نشط") : t("Inactive", "غير نشط")}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("Email", "البريد الإلكتروني")}:</span>
                    <span className="font-medium">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("Phone", "الهاتف")}:</span>
                    <span className="font-medium">{phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <BadgeCheck className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("Role", "الدور")}:</span>
                    <span className="font-medium">{role?.name ?? t("Unknown", "غير معروف")}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              {t("Permissions", "الصلاحيات")}
            </CardTitle>
            <CardDescription>
              {isSuperAdmin
                ? t("You have full access to every module and setting.", "لديك وصول كامل إلى جميع الوحدات والإعدادات.")
                : t("What you are allowed to do in this workspace.", "ما يُسمح لك بفعله في مساحة العمل هذه.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isSuperAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Badge className="font-mono text-xs">*</Badge>
                <span className="text-sm text-muted-foreground">{t("Super admin — full access", "سوبر أدمن — وصول كامل")}</span>
              </div>
            ) : (
              (() => {
                const groups = groupPermissions(displayPermissions as string[]);
                const order = GROUP_ORDER.filter((g) => groups[g]);
                return order.map((group) => (
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
                ));
              })()
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
