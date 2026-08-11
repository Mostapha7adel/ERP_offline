import { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { UserPlus, Pencil, Trash2, MoreHorizontal, Power, ShieldCheck, Users as UsersIcon } from "lucide-react";
import { useT } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useUsersStore, useRolesStore } from "@/stores/system-store";
import { usePermission } from "@/shared/components/permission-gate";
import { formatDate, timeAgo } from "@/lib/format";
import { usersApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { AppUser } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { UserFormDialog } from "./user-form-dialog";
import { RolesPanel } from "./roles-page";
import { initials } from "@/lib/utils";

const columnHelper = createColumnHelper<AppUser>();

export function UsersPage() {
  const items = useUsersStore((s) => s.items);
  const roles = useRolesStore((s) => s.items);
  const add = useUsersStore((s) => s.add);
  const update = useUsersStore((s) => s.update);
  const remove = useUsersStore((s) => s.remove);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const canCreate = usePermission("users.create");
  const canUpdate = usePermission("users.update");
  const canDelete = usePermission("users.delete");
  const { t } = useT();

  const loading = useSimulatedLoading(650, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) =>
      [u.name, u.email, roles.find((r) => r.id === u.roleId)?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search, roles]);

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";

  const toggleSuspend = async (user: AppUser) => {
    const nextStatus = user.status === "active" ? "suspended" : "active";
    try {
      const updated = await usersApi().update(user.id, {
        status: nextStatus === "active" ? "active" : "inactive",
      });
      update(updated.id, updated);
      toast.success(nextStatus === "active" ? t("User activated", "تم تفعيل المستخدم") : t("User suspended", "تم تعليق المستخدم"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Update failed", "فشل التحديث"));
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: t("User", "المستخدم"),
        cell: (info) => {
          const user = info.row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar>
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                <AvatarFallback style={{ backgroundColor: user.color }}>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("roleId", {
        header: t("Role", "الدور"),
        cell: (info) => <Badge variant="secondary">{roleName(String(info.getValue()))}</Badge>,
      }),
      columnHelper.accessor("status", {
        header: t("Status", "الحالة"),
        cell: (info) => {
          const status = String(info.getValue());
          const map: Record<string, string> = { active: "success", invited: "warning", suspended: "destructive" };
          return <Badge variant={(map[status] as "success" | "warning" | "destructive") ?? "secondary"}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
        },
      }),
      columnHelper.accessor("lastActiveAt", {
        header: t("Last active", "آخر نشاط"),
        cell: (info) => (
          <span className="text-muted-foreground">{timeAgo(String(info.getValue()))}</span>
        ),
      }),
      columnHelper.accessor("createdAt", {
        header: t("Joined", "تاريخ الانضمام"),
        cell: (info) => <span className="text-muted-foreground">{formatDate(String(info.getValue()))}</span>,
      }),
      columnHelper.display({
        id: "actions",
        cell: (info) => {
          const user = info.row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={t("Actions", "إجراءات")}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!canUpdate}
                    onSelect={() => { setEditing(user); }}><Pencil className="size-4" /> {t("Edit", "تعديل")}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggleSuspend(user)}>
                    <Power className="size-4" /> {user.status === "active" ? t("Suspend", "تعليق") : t("Activate", "تفعيل")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={!canDelete}
                    onSelect={() => { setDeleting(user); setConfirmOpen(true); }}>
                    <Trash2 className="size-4" /> {t("Delete", "حذف")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    [roleName, canUpdate, canDelete, update, t],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("Users", "المستخدمون")} description={t("Manage who has access to your workspace.", "إدارة من يمكنه الوصول إلى مساحة عملك.")} />
        <SkeletonTable rows={8} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("Users & Access", "المستخدمون والصلاحيات")} description={t("Manage members, roles and permissions.", "إدارة الأعضاء والأدوار والصلاحيات.")}>
        <Button onClick={() => setCreateOpen(true)} disabled={!canCreate}>
          <UserPlus className="size-4" /> {t("Invite user", "دعوة مستخدم")}
        </Button>
      </PageHeader>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users"><UsersIcon className="size-4" /> {t("Users", "المستخدمون")}</TabsTrigger>
          <TabsTrigger value="roles"><ShieldCheck className="size-4" /> {t("Roles & Permissions", "الأدوار والصلاحيات")}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-0 pt-4">
          <DataTable
            columns={columns}
            data={filtered}
            pagination={false}
            emptyTitle={t("No users found", "لا يوجد مستخدمون")}
            emptyDescription={t("Invite a team member to get started.", "ادعُ أحد أعضاء الفريق للبدء.")}
            toolbar={
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search users…", "ابحث عن المستخدمين…")} className="w-full sm:max-w-xs" />
                <Badge variant="outline" className="justify-center">{filtered.length} {t("users", "مستخدم")}</Badge>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="roles" className="mt-0 pt-4">
          <RolesPanel />
        </TabsContent>
      </Tabs>

      <UserFormDialog
        open={createOpen || editing !== null}
        editing={editing}
        onOpenChange={(open) => { if (!open) setEditing(null); setCreateOpen(false); }}
        onSave={(user) => {
          if (editing) update(editing.id, user);
          else add(user);
          setEditing(null);
          setCreateOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete user", "حذف المستخدم")}
        description={t("Remove ${name} from the workspace? This cannot be undone.", "هل تريد إزالة ${name} من مساحة العمل؟ لا يمكن التراجع عن هذا الإجراء.").replace("${name}", deleting?.name ?? t("this user", "هذا المستخدم"))}
        confirmLabel={t("Delete", "حذف")}
        loading={deletingUser}
        onConfirm={async () => {
          if (!deleting) return;
          setDeletingUser(true);
          try {
            await usersApi().remove(deleting.id);
            remove(deleting.id);
            toast.success(t("User deleted", "تم حذف المستخدم"));
            setConfirmOpen(false);
            setDeleting(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
          } finally {
            setDeletingUser(false);
          }
        }}
      />
    </div>
  );
}