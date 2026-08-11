import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { warehouseSchema, type WarehouseFormValues } from "@/lib/schemas";
import { toast } from "@/shared/lib/toast";
import { warehousesApi } from "@/lib/api";
import type { Warehouse } from "@/types/domain";
import { useT } from "@/shared/lib/i18n";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/shared/components/forms/form";

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse | null;
  onSave: (warehouse: Warehouse) => void;
}

export function WarehouseFormDialog({ open, onOpenChange, warehouse, onSave }: WarehouseFormDialogProps) {
  const isEdit = Boolean(warehouse);
  const [saving, setSaving] = useState(false);
  const { t } = useT();
  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      code: warehouse?.code ?? "",
      name: warehouse?.name ?? "",
      location: warehouse?.location ?? "",
      manager: warehouse?.manager ?? "",
    },
  });

  // The dialog stays mounted between opens, so defaultValues only apply at
  // mount. Reset with the current record every time it opens, otherwise edit
  // forms would show empty fields.
  useEffect(() => {
    if (!open) return;
    form.reset({
      code: warehouse?.code ?? "",
      name: warehouse?.name ?? "",
      location: warehouse?.location ?? "",
      manager: warehouse?.manager ?? "",
    });
  }, [open, warehouse, form]);

  const onSubmit = async (values: WarehouseFormValues) => {
    setSaving(true);
    try {
      const input = {
        code: values.code.trim(),
        name: values.name.trim(),
        address: values.location.trim() || undefined,
        manager: values.manager?.trim() || undefined,
      };
      const record = isEdit && warehouse
        ? await warehousesApi().update(warehouse.id, input)
        : await warehousesApi().create(input);
      onSave(record);
      onOpenChange(false);
      form.reset();
      toast.success(isEdit ? t("Warehouse updated", "تم تحديث المستودع") : t("Warehouse created", "تم إنشاء المستودع"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to save warehouse", "فشل حفظ المستودع"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Edit", "تعديل") : t("Add", "إضافة")} {t("warehouse", "مستودع")}</DialogTitle>
          <DialogDescription>{t("Log a location where inventory is stored.", "سجّل موقعاً يُخزَّن فيه المخزون.")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Name *", "الاسم *")}</FormLabel>
                  <FormControl><Input placeholder="Main Distribution Center" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Code *", "الكود *")}</FormLabel>
                  <FormControl><Input placeholder="WH-MAIN" disabled={isEdit} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Location *", "الموقع *")}</FormLabel>
                  <FormControl><Input placeholder="San Francisco, CA" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="manager" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Manager", "المدير")}</FormLabel>
                  <FormControl><Input placeholder={t("Full name", "الاسم الكامل")} {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
              <Button type="submit" disabled={saving}>{saving ? t("Saving…", "جارٍ الحفظ…") : isEdit ? t("Save changes", "حفظ التغييرات") : t("Create warehouse", "إنشاء مستودع")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}