import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usersApi } from "@/lib/api";
import type { AppUser } from "@/types/domain";
import { useRolesStore } from "@/stores/system-store";
import { useAuthStore } from "@/stores/auth-store";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/forms/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { AvatarPicker } from "@/shared/components/forms/avatar-picker";
import { initials } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  roleId: z.string().min(1, "Select a role"),
  status: z.enum(["active", "invited", "suspended"]),
  jobTitle: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

interface UserFormDialogProps {
  open: boolean;
  editing: AppUser | null;
  onOpenChange: (open: boolean) => void;
  onSave: (user: AppUser) => void;
}

export function UserFormDialog({ open, editing, onOpenChange, onSave }: UserFormDialogProps) {
  const roles = useRolesStore((s) => s.items);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(editing?.avatarUrl ?? "");
  const { t } = useT();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editing?.name ?? "",
      email: editing?.email ?? "",
      roleId: editing?.roleId ?? "",
      status: editing?.status ?? "invited",
      jobTitle: editing?.jobTitle ?? "",
      password: "",
    },
  });

  // The dialog stays mounted between opens, so defaultValues only apply at
  // mount. Reset with the current record every time it opens, otherwise edit
  // forms would show empty fields.
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: editing?.name ?? "",
      email: editing?.email ?? "",
      roleId: editing?.roleId ?? "",
      status: editing?.status ?? "invited",
      jobTitle: editing?.jobTitle ?? "",
      password: "",
    });
    setAvatarUrl(editing?.avatarUrl ?? "");
  }, [open, editing, form]);

  const onSubmit = async (values: Values) => {
    setSaving(true);
    try {
      const backendStatus: "active" | "inactive" =
        values.status === "active" ? "active" : "inactive";
      const user = editing
        ? await usersApi().update(editing.id, {
            name: values.name,
            email: values.email,
            roleId: values.roleId,
            status: backendStatus,
            jobTitle: values.jobTitle || undefined,
            avatarUrl: avatarUrl || undefined,
          })
        : await usersApi().create({
            name: values.name,
            email: values.email,
            roleId: values.roleId,
            password: values.password || "LedgerFlow@123",
            status: backendStatus,
            jobTitle: values.jobTitle || undefined,
            avatarUrl: avatarUrl || undefined,
          });
      // Super admin may also reset a password (their own or any other user's).
      if (editing && isSuperAdmin && values.password) {
        await usersApi().resetPassword(editing.id, values.password);
      }
      onSave(user);
      form.reset();
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("Edit user", "تعديل المستخدم") : t("Invite user", "دعوة مستخدم")}</DialogTitle>
          <DialogDescription className="capitalize-first">{editing ? t("Update this member's details.", "قم بتحديث تفاصيل هذا العضو.") : t("Add a new member to your workspace.", "أضف عضواً جديداً إلى مساحة عملك.")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("Full name *", "الاسم الكامل *")}</FormLabel>
                <FormControl><Input placeholder={t("e.g. Jordan Lee", "مثال: محمد أحمد")} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("Email *", "البريد الإلكتروني *")}</FormLabel>
                <FormControl><Input type="email" placeholder="name@company.com" {...field} /></FormControl>
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
            <div>
              <FormLabel>{t("Profile photo", "الصورة الشخصية")}</FormLabel>
              <AvatarPicker
                value={avatarUrl}
                fallback={initials(form.watch("name") || editing?.name || "U")}
                fallbackColor={editing?.color}
                disabled={saving}
                onChange={setAvatarUrl}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="roleId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Role *", "الدور *")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder={t("Select role", "اختر الدور")} /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Status", "الحالة")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(editing ? ["active", "invited", "suspended"] : ["invited", "active"]) .map((s) => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            {editing && isSuperAdmin ? (
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Reset password (optional)", "إعادة تعيين كلمة المرور (اختياري)")}</FormLabel>
                  <FormControl><Input type="password" autoComplete="new-password" placeholder={t("Leave blank to keep the current password", "اتركه فارغاً للحفاظ على كلمة المرور الحالية")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ) : null}
            {!editing ? (
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Initial password *", "كلمة المرور الأولية *")}</FormLabel>
                  <FormControl><Input type="password" placeholder={t("At least 8 characters", "8 أحرف على الأقل")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
              <Button type="submit" disabled={saving}>{saving ? t("Saving…", "جارٍ الحفظ…") : editing ? t("Save changes", "حفظ التغييرات") : t("Send invite", "إرسال الدعوة")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}