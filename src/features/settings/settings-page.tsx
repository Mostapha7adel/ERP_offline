import { useEffect, useState } from "react";
import { Building2, SlidersHorizontal, Save, Check } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { useLocaleStore } from "@/stores/locale-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { settingsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { APP_VERSION } from "@/config/app";

export function SettingsPage() {
  const company = useSettingsStore((s) => s.company);
  const preferences = useSettingsStore((s) => s.preferences);
  const updateCompany = useSettingsStore((s) => s.updateCompany);
  const updatePreferences = useSettingsStore((s) => s.updatePreferences);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const canSettings = usePermission("settings.update");
  const [saving, setSaving] = useState(false);
  const { t } = useT();

  const [companyDraft, setCompanyDraft] = useState({ ...company });
  const [saved, setSaved] = useState(false);

  const setField = (key: keyof typeof companyDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCompanyDraft((d) => ({ ...d, [key]: e.target.value }));

  const saveCompany = async () => {
    setSaving(true);
    try {
      await settingsApi().updateCompany({
        name: companyDraft.name,
        legalName: companyDraft.legalName,
        email: companyDraft.email,
        phone: companyDraft.phone,
        taxNumber: companyDraft.taxId,
        address: [companyDraft.address.street, companyDraft.address.city, companyDraft.address.state, companyDraft.address.country].filter(Boolean).join(", "),
        currency: companyDraft.currency,
      });
      updateCompany(companyDraft);
      setSaved(true);
      toast.success(t("Company profile saved", "تم حفظ ملف الشركة"));
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to save company", "فشل حفظ ملف الشركة"));
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async (patch: Partial<typeof preferences>) => {
    const next = { ...preferences, ...patch };
    updatePreferences(patch);
    try {
      await settingsApi().updatePreferences({
        lowStockThreshold: next.lowStockThreshold,
        defaultTaxRate: next.defaultTaxRate,
        dateFormat: next.dateFormat,
        notifyOnLowStock: next.notificationsEnabled,
        notifyOnInvoiceCreated: next.notificationsEnabled,
        taxEnabled: next.defaultTaxRate > 0,
        costingMethod: next.costingMethod,
        enforceCreditLimit: next.enforceCreditLimit,
        autoBackupEnabled: next.autoBackupEnabled,
        autoBackupFrequencyHours: next.autoBackupFrequencyHours,
        autoBackupRetention: next.autoBackupRetention,
        autoBackupFolder: next.autoBackupFolder || undefined,
      });
      toast.success(t("Preference updated", "تم تحديث التفضيلات"));
    } catch {
      // keep local value even if sync fails
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("Settings", "الإعدادات")} description={t("Configure your company profile and preferences.", "قم بتهيئة ملف شركتك وتفضيلاتك.")}>
        <Badge variant="outline">v{APP_VERSION}</Badge>
      </PageHeader>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company"><Building2 className="size-4" /> {t("Company", "الشركة")}</TabsTrigger>
          <TabsTrigger value="preferences"><SlidersHorizontal className="size-4" /> {t("Preferences", "التفضيلات")}</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-0 space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("Company profile", "ملف الشركة")}</CardTitle>
              <CardDescription>{t("Details shown on invoices, reports and documents.", "التفاصيل التي تظهر في الفواتير والتقارير والمستندات.")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t("Company name", "اسم الشركة")} value={companyDraft.name} onChange={setField("name")} />
              <Field label={t("Legal name", "الاسم القانوني")} value={companyDraft.legalName} onChange={setField("legalName")} />
              <Field label={t("Tax ID", "الرقم الضريبي")} value={companyDraft.taxId} onChange={setField("taxId")} />
              <Field label={t("Registration number", "رقم السجل التجاري")} value={companyDraft.registrationNumber} onChange={setField("registrationNumber")} />
              <Field label={t("Email", "البريد الإلكتروني")} value={companyDraft.email} onChange={setField("email")} />
              <Field label={t("Phone", "الهاتف")} value={companyDraft.phone} onChange={setField("phone")} />
              <Field label={t("Website", "الموقع الإلكتروني")} value={companyDraft.website} onChange={setField("website")} />
              <Field label={t("Currency", "العملة")} value={companyDraft.currency} onChange={setField("currency")} />
              <Field label={t("Timezone", "المنطقة الزمنية")} value={companyDraft.timezone} onChange={setField("timezone")} />
              <Field label={t("Street", "الشارع")} full value={companyDraft.address.street} onChange={(e) => setCompanyDraft({ ...companyDraft, address: { ...companyDraft.address, street: e.target.value } } as any)} />
              <Field label={t("City", "المدينة")} value={companyDraft.address.city} onChange={(e) => setCompanyDraft({ ...companyDraft, address: { ...companyDraft.address, city: e.target.value } } as any)} />
              <Field label={t("State", "الولاية")} value={companyDraft.address.state} onChange={(e) => setCompanyDraft({ ...companyDraft, address: { ...companyDraft.address, state: e.target.value } } as any)} />
              <Field label={t("Postal code", "الرمز البريدي")} value={companyDraft.address.postalCode} onChange={(e) => setCompanyDraft({ ...companyDraft, address: { ...companyDraft.address, postalCode: e.target.value } } as any)} />
              <Field label={t("Country", "الدولة")} value={companyDraft.address.country} onChange={(e) => setCompanyDraft({ ...companyDraft, address: { ...companyDraft.address, country: e.target.value } } as any)} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              disabled={!canSettings || saving}
              onClick={saveCompany}
            >
              {saved ? <Check className="size-4" /> : <Save className="size-4" />}
              {saved ? t("Saved", "تم الحفظ") : saving ? t("Saving…", "جارٍ الحفظ…") : t("Save company", "حفظ الشركة")}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="mt-0 space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("App preferences", "تفضيلات التطبيق")}</CardTitle>
              <CardDescription>{t("Default behaviours and display options.", "السلوكيات الافتراضية وخيارات العرض.")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PrefSelect
                label={t("Language", "اللغة")}
                value={preferences.language}
                options={[{ value: "en", label: t("English", "الإنجليزية") }, { value: "ar", label: t("Arabic", "العربية") }]}
                onChange={(language) => {
                  updatePreferences({ language });
                  setLocale(language as "en" | "ar");
                  savePreferences({ language: language as "en" | "ar" });
                }}
              />
              <PrefSelect
                label={t("Date format", "صيغة التاريخ")}
                value={preferences.dateFormat}
                options={[{ value: "MM/dd/yyyy", label: "MM/DD/YYYY" }, { value: "dd/MM/yyyy", label: "DD/MM/YYYY" }]}
                onChange={(dateFormat) => savePreferences({ dateFormat })}
              />
              <PrefSelect
                label={t("Number format", "صيغة الأرقام")}
                value={preferences.numberFormat}
                options={[{ value: "en-US", label: "1,234.56" }, { value: "de-DE", label: "1.234,56" }, { value: "ar-EG", label: "١٬٢٣٤٫٥٦" }]}
                onChange={(numberFormat) => savePreferences({ numberFormat })}
              />
              <PrefSelect
                label={t("Currency", "العملة")}
                value={preferences.currency}
                options={[{ value: "USD", label: t("US Dollar", "دولار أمريكي") }, { value: "EUR", label: t("Euro", "يورو") }, { value: "EGP", label: t("Egyptian Pound", "جنيه مصري") }]}
                onChange={(currency) => savePreferences({ currency })}
              />
              <PrefSelect
                label={t("Costing method", "طريقة التكلفة")}
                value={preferences.costingMethod}
                options={[{ value: "average", label: t("Weighted average", "المتوسط المرجح") }, { value: "fifo", label: t("FIFO", "الوارد أولاً صادر أولاً") }]}
                onChange={(costingMethod) => savePreferences({ costingMethod: costingMethod as "average" | "fifo" })}
              />

              <PreferenceRow
                label={t("Enforce credit limits", "تطبيق الحدود الائتمانية")}
                description={t("Block invoices that exceed a customer's credit limit.", "منع الفواتير التي تتجاوز الحد الائتماني للعميل.")}
                checked={preferences.enforceCreditLimit}
                onChange={(enforceCreditLimit) => savePreferences({ enforceCreditLimit })}
              />

              <PreferenceRow
                label={t("Show decimal values", "إظهار القيم العشرية")}
                description={t("Display fractional amounts throughout the app.", "عرض المبالغ الكسرية في جميع أنحاء التطبيق.")}
                checked={preferences.showDecimals}
                onChange={(showDecimals) => savePreferences({ showDecimals })}
              />
              <PreferenceRow
                label={t("Notifications", "الإشعارات")}
                description={t("Receive alerts for low stock and payments.", "تلقي تنبيهات لانخفاض المخزون والمدفوعات.")}
                checked={preferences.notificationsEnabled}
                onChange={(notificationsEnabled) => savePreferences({ notificationsEnabled })}
              />
              <PreferenceRow
                label={t("Auto-save", "الحفظ التلقائي")}
                description={t("Save changes automatically where possible.", "احفظ التغييرات تلقائياً حيثما أمكن.")}
                checked={preferences.autoSave}
                onChange={(autoSave) => savePreferences({ autoSave })}
              />

              <NumberField
                label={t("Low stock threshold", "حد المخزون المنخفض")}
                defaultValue={preferences.lowStockThreshold}
                onChange={(lowStockThreshold) => savePreferences({ lowStockThreshold })}
              />
              <NumberField
                label={t("Default tax rate (%)", "معدل الضريبة الافتراضي (٪)")}
                defaultValue={preferences.defaultTaxRate}
                onChange={(defaultTaxRate) => savePreferences({ defaultTaxRate })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("Automatic backup", "النسخ الاحتياطي التلقائي")}</CardTitle>
              <CardDescription>{t("Schedule regular backups of your data to a local or cloud folder.", "جدولة نسخ احتياطي منتظم لبياناتك إلى مجلد محلي أو سحابي.")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PreferenceRow
                label={t("Enable auto-backup", "تفعيل النسخ الاحتياطي التلقائي")}
                description={t("Automatically create backups on a schedule.", "إنشاء نسخ احتياطية تلقائياً وفق جدول.")}
                checked={preferences.autoBackupEnabled}
                onChange={(autoBackupEnabled) => savePreferences({ autoBackupEnabled })}
              />
              <NumberField
                label={t("Frequency (hours)", "التكرار (بالساعات)")}
                defaultValue={preferences.autoBackupFrequencyHours}
                onChange={(autoBackupFrequencyHours) => savePreferences({ autoBackupFrequencyHours })}
              />
              <NumberField
                label={t("Retention (days)", "الاحتفاظ (بالأيام)")}
                defaultValue={preferences.autoBackupRetention}
                onChange={(autoBackupRetention) => savePreferences({ autoBackupRetention })}
              />
              <Field
                label={t("Backup folder", "مجلد النسخ الاحتياطي")}
                value={preferences.autoBackupFolder}
                onChange={(e) => savePreferences({ autoBackupFolder: e.target.value })}
                placeholder={t("Leave empty for default location", "اتركه فارغاً للموقع الافتراضي")}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, full, ...input }: { label: string; full?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-sm font-medium">{label}</label>
      <Input className="mt-1.5" {...input} />
    </div>
  );
}

function PrefSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function PreferenceRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberField({ label, defaultValue, onChange }: { label: string; defaultValue: number; onChange: (v: number) => void }) {
  const [value, setValue] = useState(String(defaultValue));
  useEffect(() => setValue(String(defaultValue)), [defaultValue]);

  const commit = () => {
    const n = Number(value);
    if (!Number.isNaN(n) && n !== defaultValue) onChange(n);
  };

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="mt-1.5"
      />
    </div>
  );
}