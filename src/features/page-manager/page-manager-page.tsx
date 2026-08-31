import { useState } from "react";
import { Eye, EyeOff, Save, Check, LayoutDashboard, Search } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { useLocaleStore } from "@/stores/locale-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { pageVisibilityApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Switch } from "@/shared/components/ui/switch";
import { NAV_SECTIONS } from "@/config/navigation";

function getPageId(href: string): string {
  return href.replace("/app/", "");
}

export function PageManagerPage() {
  const hiddenPages = useSettingsStore((s) => s.hiddenPages);
  const setHiddenPages = useSettingsStore((s) => s.setHiddenPages);
  const canSettings = usePermission("settings.update");
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useT();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [localHidden, setLocalHidden] = useState<string[]>(hiddenPages);

  const allPages = NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      id: getPageId(item.href),
      title: item.title,
      titleAr: item.titleAr ?? item.title,
      section: section.titleAr ?? section.title,
      icon: item.icon,
    }))
  );

  const filteredPages = allPages.filter((page) => {
    const q = search.toLowerCase();
    return (
      page.title.toLowerCase().includes(q) ||
      page.titleAr.includes(q) ||
      page.section.includes(q)
    );
  });

  const togglePage = (pageId: string) => {
    setLocalHidden((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  const toggleAll = (hide: boolean) => {
    if (hide) {
      setLocalHidden(allPages.map((p) => p.id));
    } else {
      setLocalHidden([]);
    }
  };

  const hasChanges = JSON.stringify(localHidden.sort()) !== JSON.stringify(hiddenPages.sort());

  const save = async () => {
    setSaving(true);
    try {
      const updated = await pageVisibilityApi().update(localHidden);
      setHiddenPages(updated);
      setSaved(true);
      toast.success(t("Page visibility saved", "تم حفظ إعدادات ظهور الصفحات"));
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to save", "فشل الحفظ"));
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = allPages.length - localHidden.length;
  const hiddenCount = localHidden.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Page Manager", "مدير الصفحات")}
        description={t(
          "Control which pages are visible in the sidebar for all users.",
          "تحكم في الصفحات الظاهرة في شريط التنقل لجميع المستخدمين."
        )}
      >
        {canSettings && (
          <Button disabled={saving || !hasChanges} onClick={save}>
            {saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved
              ? t("Saved", "تم الحفظ")
              : saving
                ? t("Saving…", "جارٍ الحفظ…")
                : t("Save changes", "حفظ التغييرات")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Badge variant="outline">
            <Eye className="mr-1 size-3" />
            {t("Visible", "ظاهرة")}: {visibleCount}
          </Badge>
          <Badge variant="outline">
            <EyeOff className="mr-1 size-3" />
            {t("Hidden", "مخفي")}: {hiddenCount}
          </Badge>
        </div>
        {canSettings && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
              {t("Show All", "إظهار الكل")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
              {t("Hide All", "إخفاء الكل")}
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("Search pages…", "بحث في الصفحات…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-6">
        {NAV_SECTIONS.map((section) => {
          const sectionPages = filteredPages.filter(
            (p) => p.section === (section.titleAr ?? section.title)
          );
          if (sectionPages.length === 0) return null;

          return (
            <Card key={section.title}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {locale === "ar" ? (section.titleAr ?? section.title) : section.title}
                </CardTitle>
                <CardDescription>
                  {sectionPages.filter((p) => !localHidden.includes(p.id)).length} / {sectionPages.length}{" "}
                  {t("pages visible", "صفحة ظاهرة")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {sectionPages.map((page) => {
                  const isHidden = localHidden.includes(page.id);
                  const Icon = page.icon ?? LayoutDashboard;
                  return (
                    <div
                      key={page.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className={isHidden ? "text-muted-foreground line-through" : "font-medium"}>
                          {locale === "ar" ? page.titleAr : page.title}
                        </span>
                        {isHidden && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t("Hidden", "مخفي")}
                          </Badge>
                        )}
                      </div>
                      <Switch
                        checked={!isHidden}
                        disabled={!canSettings}
                        onCheckedChange={() => togglePage(page.id)}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
