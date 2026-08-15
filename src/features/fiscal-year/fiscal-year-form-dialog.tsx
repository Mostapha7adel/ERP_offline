import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fiscalYearApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { FiscalYear } from "@/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/shared/components/forms/form";
import { DatePicker } from "@/shared/components/forms/date-picker";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

interface FiscalYearFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (year: FiscalYear) => void;
}

type FormValues = z.infer<typeof formSchema>;

export function FiscalYearFormDialog({ open, onOpenChange, onSave }: FiscalYearFormDialogProps) {
  const { t } = useT();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", startDate: new Date(), endDate: new Date() },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ name: "", startDate: new Date(), endDate: new Date() });
  }, [open, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      const year = await fiscalYearApi().create({
        name: values.name,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        notes: (document.getElementById("fy-notes") as HTMLInputElement | null)?.value || undefined,
      });
      onSave(year);
      onOpenChange(false);
      toast.success(t("${name} opened", "تم فتح ${name}").replace("${name}", year.name));
    } catch (error) {
      toast.error(translateApiError(error, t));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Open a fiscal year", "فتح سنة مالية")}</DialogTitle>
          <DialogDescription>
            {t("The period cannot overlap an existing fiscal year.", "لا يمكن أن تتداخل الفترة مع سنة مالية موجودة.")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Name", "الاسم")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("e.g. FY 2027", "مثال: السنة المالية 2027")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Start date", "تاريخ البداية")} *</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("End date", "تاريخ النهاية")} *</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Textarea
              id="fy-notes"
              placeholder={t("Notes (optional)…", "ملاحظات (اختياري)…")}
              rows={2}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("Cancel", "إلغاء")}
              </Button>
              <Button type="submit">{t("Open fiscal year", "فتح سنة مالية")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
