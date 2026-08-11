import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductFormValues } from "@/lib/schemas";
import type { Product } from "@/types/domain";
import { productsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import { useT } from "@/shared/lib/i18n";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/shared/components/forms/form";
import { CurrencyInput } from "@/shared/components/forms/currency-input";
import { Combobox } from "@/shared/components/forms/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

const UNIT_OPTIONS = [
  { value: "pc", label: "pc", labelAr: "قطعة" },
  { value: "pack", label: "pack", labelAr: "عبوة" },
  { value: "box", label: "box", labelAr: "صندوق" },
  { value: "bag", label: "bag", labelAr: "كيس" },
  { value: "tin", label: "tin", labelAr: "علبة" },
  { value: "kg", label: "kg", labelAr: "كيلوغرام" },
  { value: "liter", label: "liter", labelAr: "لتر" },
  { value: "set", label: "set", labelAr: "طقم" },
];

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (product: Product) => void;
  categories: string[];
  nextSku: string;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSave,
  categories,
  nextSku,
}: ProductFormDialogProps) {
  const isEdit = Boolean(product);
  const [saving, setSaving] = useState(false);
  const { t } = useT();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: product?.sku ?? nextSku,
      name: product?.name ?? "",
      category: product?.category ?? (categories[0] ?? "General"),
      unit: product?.unit ?? "pc",
      costPrice: product?.costPrice ?? 0,
      salePrice: product?.salePrice ?? 0,
      taxRate: product?.taxRate ?? 8.25,
      reorderLevel: product?.reorderLevel ?? 10,
      description: product?.description ?? "",
    },
  });

  // The dialog stays mounted between opens, so defaultValues only apply at
  // mount. Reset with the current record every time it opens, otherwise edit
  // forms would show empty fields.
  useEffect(() => {
    if (!open) return;
    form.reset({
      sku: product?.sku ?? nextSku,
      name: product?.name ?? "",
      category: product?.category ?? (categories[0] ?? "General"),
      unit: product?.unit ?? "pc",
      costPrice: product?.costPrice ?? 0,
      salePrice: product?.salePrice ?? 0,
      taxRate: product?.taxRate ?? 8.25,
      reorderLevel: product?.reorderLevel ?? 10,
      description: product?.description ?? "",
    });
  }, [open, product, nextSku, categories, form]);

  const onSubmit = async (values: ProductFormValues) => {
    setSaving(true);
    try {
      const input = {
        sku: values.sku.trim() || undefined,
        name: values.name.trim(),
        category: values.category,
        unit: values.unit,
        purchasePrice: Number(values.costPrice),
        salePrice: Number(values.salePrice),
        taxRate: Number(values.taxRate),
        reorderLevel: Number(values.reorderLevel),
        description: values.description?.trim() || undefined,
        trackStock: true,
      };
      const record = isEdit && product
        ? await productsApi().update(product.id, input)
        : await productsApi().create(input);
      onSave(record);
      onOpenChange(false);
      form.reset();
      toast.success(isEdit ? t("Product updated", "تم تحديث المنتج") : t("Product created", "تم إنشاء المنتج"));
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Edit", "تعديل") : t("Add", "إضافة")} {t("product", "منتج")}</DialogTitle>
          <DialogDescription>{t("Define product details, pricing and reorder levels.", "حدد تفاصيل المنتج والأسعار ومستويات إعادة الطلب.")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Product name *", "اسم المنتج *")}</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Wireless Keyboard" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder={nextSku} disabled={isEdit} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Category *", "الفئة *")}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={categories.map((c) => ({ value: c, label: c }))}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Unit", "الوحدة")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNIT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{t(o.label, o.labelAr ?? o.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Cost price", "سعر التكلفة")}</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onNumericChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Sale price", "سعر البيع")}</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onNumericChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Tax rate (%)", "نسبة الضريبة (%)")}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reorderLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Reorder level", "مستوى إعادة الطلب")}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Description", "الوصف")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("Optional short description…", "وصف قصير اختياري…")} className="resize-none" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("Cancel", "إلغاء")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("Saving…", "جارٍ الحفظ…") : isEdit ? t("Save changes", "حفظ التغييرات") : t("Create product", "إنشاء منتج")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}