import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Save, Check, LayoutDashboard, Search, ChevronDown, ChevronUp, Shield, Users, Globe } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { useLocaleStore } from "@/stores/locale-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { pageVisibilityApi, pageAssignmentApi, rolesApi, usersApi } from "@/lib/api";
import type { RolePageAssignment, UserPageAssignment } from "@/lib/api/services";
import { toast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { NAV_SECTIONS } from "@/config/navigation";
import { cn } from "@/lib/utils";

function getPageId(href: string): string {
  return href.replace("/app/", "");
}

const ALL_PAGE_IDS = NAV_SECTIONS.flatMap((section) =>
  section.items.filter((item) => !item.hiddenFromPageManager).map((item) => getPageId(item.href))
);

function PageToggle({
  page,
  isHidden,
  onToggle,
  disabled,
  locale,
}: {
  page: { id: string; title: string; titleAr: string; icon?: React.ComponentType<{ className?: string }> };
  isHidden: boolean;
  onToggle: () => void;
  disabled: boolean;
  locale: string;
}) {
  const Icon = page.icon ?? LayoutDashboard;
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-right transition-all",
        isHidden ? "bg-muted/30 opacity-60" : "bg-muted/60 hover:bg-muted",
        disabled ? "cursor-default" : "cursor-pointer"
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
        <span className={cn("text-sm font-medium", isHidden && "line-through text-muted-foreground")}>
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
}

function PageSection({
  section,
  filteredPages,
  selectedPages,
  onToggle,
  onToggleSection,
  collapsed,
  onToggleCollapse,
  canSettings,
  locale,
}: {
  section: (typeof NAV_SECTIONS)[number];
  filteredPages: Array<{ id: string; title: string; titleAr: string; section: string; sectionAr: string; icon?: React.ComponentType<{ className?: string }> }>;
  selectedPages: string[];
  onToggle: (pageId: string) => void;
  onToggleSection: (sectionTitle: string, hide: boolean) => void;
  collapsed: Record<string, boolean>;
  onToggleCollapse: (sectionTitle: string) => void;
  canSettings: boolean;
  locale: string;
}) {
  const sectionPages = filteredPages.filter((p) => p.section === section.title);
  if (sectionPages.length === 0) return null;

  const sectionIds = sectionPages.map((p) => p.id);
  const selectedCount = sectionIds.filter((id) => selectedPages.includes(id)).length;
  const allSelected = selectedCount === sectionIds.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const isCollapsed = collapsed[section.title] ?? false;

  return (
    <Card key={section.title} className="overflow-hidden">
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => onToggleCollapse(section.title)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isCollapsed ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronUp className="size-4 text-muted-foreground" />}
            <CardTitle className="text-base">{locale === "ar" ? (section.titleAr ?? section.title) : section.title}</CardTitle>
            <Badge variant={allSelected ? "default" : someSelected ? "secondary" : "outline"} className="text-[10px]">
              {selectedCount}/{sectionIds.length}
            </Badge>
          </div>
          {canSettings && (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant={allSelected ? "default" : "ghost"} size="sm" className="h-7 px-2 text-xs" onClick={() => onToggleSection(section.title, true)}>
                <EyeOff className="size-3" />
              </Button>
              <Button variant={!allSelected && selectedCount === 0 ? "default" : "ghost"} size="sm" className="h-7 px-2 text-xs" onClick={() => onToggleSection(section.title, false)}>
                <Eye className="size-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="space-y-1 pt-0">
          {sectionPages.map((page) => (
            <PageToggle
              key={page.id}
              page={page}
              isHidden={!selectedPages.includes(page.id)}
              onToggle={() => onToggle(page.id)}
              disabled={!canSettings}
              locale={locale}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export function PageManagerPage() {
  const hiddenPages = useSettingsStore((s) => s.hiddenPages);
  const setHiddenPages = useSettingsStore((s) => s.setHiddenPages);
  const canSettings = usePermission("settings.update");
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useT();

  const [tab, setTab] = useState<"global" | "roles" | "users">("global");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [localHidden, setLocalHidden] = useState<string[]>(hiddenPages ?? []);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [roleAssignments, setRoleAssignments] = useState<RolePageAssignment[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [localRolePages, setLocalRolePages] = useState<string[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; email: string; fullName?: string }>>([]);
  const [userAssignments, setUserAssignments] = useState<UserPageAssignment[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [localUserPages, setLocalUserPages] = useState<string[]>([]);

  useEffect(() => {
    if (tab === "roles") {
      Promise.all([
        rolesApi().list().catch(() => []),
        pageAssignmentApi().getRoleAssignments(),
      ]).then(([rolesList, assignments]) => {
        setRoles(rolesList.map((r) => ({ id: r.id, name: r.name })));
        setRoleAssignments(assignments);
      }).catch(() => {});
    } else if (tab === "users") {
      Promise.all([
        usersApi().list().catch(() => []),
        pageAssignmentApi().getUserAssignments(),
      ]).then(([usersList, assignments]) => {
        setUsers(usersList.map((u) => ({ id: u.id, email: u.email, fullName: u.name })));
        setUserAssignments(assignments);
      }).catch(() => {});
    }
  }, [tab]);

  useEffect(() => {
    if (tab === "roles" && selectedRoleId) {
      const assignment = roleAssignments.find((a) => a.roleId === selectedRoleId);
      setLocalRolePages(assignment?.pages ?? []);
    }
  }, [selectedRoleId, tab, roleAssignments]);

  useEffect(() => {
    if (tab === "users" && selectedUserId) {
      const assignment = userAssignments.find((a) => a.userId === selectedUserId);
      setLocalUserPages(assignment?.pages ?? []);
    }
  }, [selectedUserId, tab, userAssignments]);

  const allPages = NAV_SECTIONS.flatMap((section) =>
    section.items.filter((item) => !item.hiddenFromPageManager).map((item) => ({
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
    return page.title.toLowerCase().includes(q) || page.titleAr.includes(q) || page.section.toLowerCase().includes(q) || page.sectionAr.includes(q);
  });

  const toggleGlobalPage = useCallback((pageId: string) => {
    setLocalHidden((prev) => prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]);
  }, []);

  const toggleGlobalAll = useCallback((show: boolean) => {
    setLocalHidden(show ? [] : allPages.map((p) => p.id));
  }, [allPages]);

  const toggleGlobalSection = useCallback((sectionTitle: string, show: boolean) => {
    const sectionPageIds = allPages.filter((p) => p.section === sectionTitle).map((p) => p.id);
    setLocalHidden((prev) => {
      if (show) return prev.filter((id) => !sectionPageIds.includes(id));
      return [...new Set([...prev, ...sectionPageIds])];
    });
  }, [allPages]);

  const toggleRolePage = useCallback((pageId: string) => {
    setLocalRolePages((prev) => prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]);
  }, []);

  const toggleRoleAll = useCallback((show: boolean) => {
    setLocalRolePages(show ? [...ALL_PAGE_IDS] : []);
  }, []);

  const toggleRoleSection = useCallback((sectionTitle: string, show: boolean) => {
    const sectionPageIds = allPages.filter((p) => p.section === sectionTitle).map((p) => p.id);
    setLocalRolePages((prev) => {
      if (show) return [...new Set([...prev, ...sectionPageIds])];
      return prev.filter((id) => !sectionPageIds.includes(id));
    });
  }, [allPages]);

  const toggleUserPage = useCallback((pageId: string) => {
    setLocalUserPages((prev) => prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]);
  }, []);

  const toggleUserAll = useCallback((show: boolean) => {
    setLocalUserPages(show ? [...ALL_PAGE_IDS] : []);
  }, []);

  const toggleUserSection = useCallback((sectionTitle: string, show: boolean) => {
    const sectionPageIds = allPages.filter((p) => p.section === sectionTitle).map((p) => p.id);
    setLocalUserPages((prev) => {
      if (show) return [...new Set([...prev, ...sectionPageIds])];
      return prev.filter((id) => !sectionPageIds.includes(id));
    });
  }, [allPages]);

  const hasGlobalChanges = JSON.stringify([...localHidden].sort()) !== JSON.stringify([...(hiddenPages ?? [])].sort());

  const save = async () => {
    setSaving(true);
    try {
      if (tab === "global") {
        await pageVisibilityApi().update(localHidden);
        setHiddenPages([...localHidden]);
      } else if (tab === "roles") {
        if (!selectedRoleId) { toast.error(t("Select a role first", "اختر الدور أولاً")); setSaving(false); return; }
        await pageAssignmentApi().setRolePages(selectedRoleId, localRolePages);
        setRoleAssignments((prev) => {
          const exists = prev.find((a) => a.roleId === selectedRoleId);
          if (exists) return prev.map((a) => a.roleId === selectedRoleId ? { ...a, pages: [...localRolePages] } : a);
          return [...prev, { roleId: selectedRoleId, pages: [...localRolePages] }];
        });
      } else if (tab === "users") {
        if (!selectedUserId) { toast.error(t("Select a user first", "اختر المستخدم أولاً")); setSaving(false); return; }
        await pageAssignmentApi().setUserPages(selectedUserId, localUserPages);
        setUserAssignments((prev) => {
          const exists = prev.find((a) => a.userId === selectedUserId);
          if (exists) return prev.map((a) => a.userId === selectedUserId ? { ...a, pages: [...localUserPages] } : a);
          return [...prev, { userId: selectedUserId, pages: [...localUserPages] }];
        });
      }
      setSaved(true);
      toast.success(t("Saved successfully", "تم الحفظ بنجاح"));
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to save", "فشل الحفظ"));
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = allPages.length - localHidden.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Page Manager", "مدير الصفحات")}
        description={t(
          "Control which pages are visible for all users, specific roles, or individual users.",
          "تحكم في الصفحات الظاهرة لجميع المستخدمين أو أدوار محددة أو مستخدمين معينين."
        )}
      >
        {canSettings && (
          <Button disabled={saving || (tab === "global" && !hasGlobalChanges)} onClick={save}>
            {saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? t("Saved", "تم الحفظ") : saving ? t("Saving…", "جارٍ الحفظ…") : t("Save changes", "حفظ التغييرات")}
          </Button>
        )}
      </PageHeader>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="global" className="gap-2"><Globe className="size-4" />{t("Global", "عام")}</TabsTrigger>
          <TabsTrigger value="roles" className="gap-2"><Shield className="size-4" />{t("Roles", "الأدوار")}</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><Users className="size-4" />{t("Users", "المستخدمين")}</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-800 dark:bg-emerald-950">
                <Eye className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t("Visible", "ظاهرة")}: {visibleCount}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 dark:border-red-800 dark:bg-red-950">
                <EyeOff className="size-3.5 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">{t("Hidden", "مخفي")}: {localHidden.length}</span>
              </div>
            </div>
            {canSettings && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleGlobalAll(true)}><Eye className="size-3.5" />{t("Show All", "إظهار الكل")}</Button>
                <Button variant="outline" size="sm" onClick={() => toggleGlobalAll(false)}><EyeOff className="size-3.5" />{t("Hide All", "إخفاء الكل")}</Button>
              </div>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("Search pages…", "بحث في الصفحات…")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="space-y-4">
            {NAV_SECTIONS.map((section) => (
              <PageSection
                key={section.title}
                section={section}
                filteredPages={filteredPages}
                selectedPages={allPages.filter((p) => !localHidden.includes(p.id)).map((p) => p.id)}
                onToggle={toggleGlobalPage}
                onToggleSection={toggleGlobalSection}
                collapsed={collapsed}
                onToggleCollapse={(s) => setCollapsed((prev) => ({ ...prev, [s]: !prev[s] }))}
                canSettings={canSettings}
                locale={locale}

              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("— Select Role —", "— اختر الدور —")}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            {selectedRoleId && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleRoleAll(true)}><Eye className="size-3.5" />{t("Show All", "إظهار الكل")}</Button>
                <Button variant="outline" size="sm" onClick={() => toggleRoleAll(false)}><EyeOff className="size-3.5" />{t("Hide All", "إخفاء الكل")}</Button>
              </div>
            )}
          </div>
          {selectedRoleId && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={t("Search pages…", "بحث في الصفحات…")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="space-y-4">
                {NAV_SECTIONS.map((section) => (
                  <PageSection
                    key={section.title}
                    section={section}
                    filteredPages={filteredPages}
                    selectedPages={localRolePages}
                    onToggle={toggleRolePage}
                    onToggleSection={toggleRoleSection}
                    collapsed={collapsed}
                    onToggleCollapse={(s) => setCollapsed((prev) => ({ ...prev, [s]: !prev[s] }))}
                    canSettings={canSettings}
                    locale={locale}
    
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("— Select User —", "— اختر المستخدم —")}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.fullName || user.email}</option>
              ))}
            </select>
            {selectedUserId && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleUserAll(true)}><Eye className="size-3.5" />{t("Show All", "إظهار الكل")}</Button>
                <Button variant="outline" size="sm" onClick={() => toggleUserAll(false)}><EyeOff className="size-3.5" />{t("Hide All", "إخفاء الكل")}</Button>
              </div>
            )}
          </div>
          {selectedUserId && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={t("Search pages…", "بحث في الصفحات…")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="space-y-4">
                {NAV_SECTIONS.map((section) => (
                  <PageSection
                    key={section.title}
                    section={section}
                    filteredPages={filteredPages}
                    selectedPages={localUserPages}
                    onToggle={toggleUserPage}
                    onToggleSection={toggleUserSection}
                    collapsed={collapsed}
                    onToggleCollapse={(s) => setCollapsed((prev) => ({ ...prev, [s]: !prev[s] }))}
                    canSettings={canSettings}
                    locale={locale}
    
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
