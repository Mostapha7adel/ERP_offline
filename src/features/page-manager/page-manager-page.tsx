import { useState } from "react";
import { Eye, EyeOff, Save, Check, LayoutDashboard, Search, ChevronDown, ChevronUp } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { NAV_SECTIONS } from "@/config/navigation";
import { cn } from "@/lib/utils";

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
  const [localHidden, setLocalHidden] = useState<string[]>(hiddenPages ?? []);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const allPages = NAV_SECTIONS.flatMap((section) =>
    section.items
      .filter((item) => !item.hiddenFromPageManager)
      .map((item) => ({
        id: getPageId(item.href),
        title: item.title,
        titleAr: item.titleAr ?? item.title,
        section: section.title,
        sectionAr: section.titleAr ?? section.title,
        icon: item.icon,
      }))
  );

  const filteredPages = allPages.filter((page) => {
    const q = search.toLowerCase();
    return (
      page.title.toLowerCase().includes(q) ||
      page.titleAr.includes(q) ||
      page.section.toLowerCase().includes(q) ||
      page.sectionAr.includes(q)
    );
  });

  const togglePage = (pageId: string) => {
    setLocalHidden((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  const toggleAll = (hide: boolean) => {
    setLocalHidden(hide ? allPages.map((p) => p.id) : []);
  };

  const toggleSection = (sectionTitle: string, hide: boolean) => {
    const sectionPageIds = allPages.filter((p) => p.section === sectionTitle).map((p) => p.id);
    setLocalHidden((prev) => {
      if (hide) {
        return [...new Set([...prev, ...sectionPageIds])];
      }
      return prev.filter((id) => !sectionPageIds.includes(id));
    });
  };

  const toggleSectionCollapse = (sectionTitle: string) => {
    setCollapsed((prev) => ({ ...prev, [sectionTitle]: !prev[sectionTitle] }));
  };

  const hasChanges = JSON.stringify([...localHidden].sort()) !== JSON.stringify([...(hiddenPages ?? [])].sort());

  const save = async () => {
    setSaving(true);
    try {
      await pageVisibilityApi().update(localHidden);
      setHiddenPages([...localHidden]);
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
        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-800 dark:bg-emerald-950">
            <Eye className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {t("Visible", "ظاهرة")}: {visibleCount}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 dark:border-red-800 dark:bg-red-950">
            <EyeOff className="size-3.5 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              {t("Hidden", "مخفي")}: {hiddenCount}
            </span>
          </div>
        </div>
        {canSettings && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
              <Eye className="size-3.5" />
              {t("Show All", "إظهار الكل")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
              <EyeOff className="size-3.5" />
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

      <div className="space-y-4">
        {NAV_SECTIONS.map((section) => {
          const sectionPages = filteredPages.filter(
            (p) => p.section === section.title
          );
          if (sectionPages.length === 0) return null;

          const sectionIds = allPages.filter((p) => p.section === section.title).map((p) => p.id);
          const sectionHiddenCount = sectionIds.filter((id) => localHidden.includes(id)).length;
          const allHidden = sectionHiddenCount === sectionIds.length;
          const someHidden = sectionHiddenCount > 0 && !allHidden;
          const isCollapsed = collapsed[section.title] ?? false;

          return (
            <Card key={section.title} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer select-none py-3"
                onClick={() => toggleSectionCollapse(section.title)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">
                      {locale === "ar" ? (section.titleAr ?? section.title) : section.title}
                    </CardTitle>
                    <Badge
                      variant={allHidden ? "destructive" : someHidden ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {sectionIds.length - sectionHiddenCount}/{sectionIds.length}
                    </Badge>
                  </div>
                  {canSettings && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant={allHidden ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => toggleSection(section.title, true)}
                      >
                        <EyeOff className="size-3" />
                      </Button>
                      <Button
                        variant={!allHidden && sectionHiddenCount === 0 ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => toggleSection(section.title, false)}
                      >
                        <Eye className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              {!isCollapsed && (
                <CardContent className="space-y-1 pt-0">
                  {sectionPages.map((page) => {
                    const isHidden = localHidden.includes(page.id);
                    const Icon = page.icon ?? LayoutDashboard;
                    return (
                      <button
                        key={page.id}
                        onClick={() => canSettings && togglePage(page.id)}
                        disabled={!canSettings}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-right transition-all",
                          isHidden
                            ? "bg-muted/30 opacity-60"
                            : "bg-muted/60 hover:bg-muted",
                          canSettings && "cursor-pointer",
                          !canSettings && "cursor-default"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                            isHidden
                              ? "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 text-start">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isHidden && "line-through text-muted-foreground"
                            )}
                          >
                            {locale === "ar" ? page.titleAr : page.title}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full transition-colors",
                            isHidden
                              ? "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                          )}
                        >
                          {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
