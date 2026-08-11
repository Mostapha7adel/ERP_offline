import type { TranslateFn } from "./i18n";

interface ErrorMatcher {
  regex: RegExp;
  build: (groups: RegExpMatchArray) => [en: string, ar: string];
}

/**
 * Translates backend error messages into the active UI locale. Backend errors
 * are always produced in English; this layer maps the known ones to a
 * bilingual pair chosen at render time (Arabic when the app is in Arabic,
 * English otherwise). Unmatched messages fall back to their raw text.
 */
const MATCHERS: ErrorMatcher[] = [
  {
    regex: /^Insufficient stock for product "(.+)" in warehouse "(.+)"$/,
    build: ([, product, warehouse]) => [
      `Insufficient stock for product "${product}" in warehouse "${warehouse}"`,
      `الكمية غير كافية للمنتج «${product}» في المستودع «${warehouse}»`,
    ],
  },
  {
    regex: /^Product "(.+)" not found$/,
    build: ([, product]) => [
      `Product "${product}" not found`,
      `المنتج «${product}» غير موجود`,
    ],
  },
  {
    regex: /^Account "(.+)" not found$/,
    build: ([, account]) => [
      `Account "${account}" not found`,
      `الحساب «${account}» غير موجود`,
    ],
  },
  {
    regex: /^Warehouse not found$/,
    build: () => ["Warehouse not found", "المستودع غير موجود"],
  },
  {
    regex: /^Customer not found$/,
    build: () => ["Customer not found", "العميل غير موجود"],
  },
  {
    regex: /^Supplier not found$/,
    build: () => ["Supplier not found", "المورد غير موجود"],
  },
  {
    regex: /^Party with email "(.+)" already exists$/,
    build: ([, value]) => [
      `This email is already registered (${value})`,
      `هذا البريد الإلكتروني مسجّل بالفعل لعميل/مورد آخر (${value})`,
    ],
  },
  {
    regex: /^Party with phone "(.+)" already exists$/,
    build: ([, value]) => [
      `This phone number is already in use (${value})`,
      `هذا الرقم مستخدم بالفعل لعميل/مورد آخر (${value})`,
    ],
  },
  {
    regex: /^Party with tax number "(.+)" already exists$/,
    build: ([, value]) => [
      `This tax number is already in use (${value})`,
      `هذا الرقم الضريبي مستخدم بالفعل لعميل/مورد آخر (${value})`,
    ],
  },
  {
    regex: /^customer code "(.+)" already exists$/,
    build: ([, value]) => [
      `This customer code is already in use (${value})`,
      `كود العميل هذا مستخدم بالفعل (${value})`,
    ],
  },
  {
    regex: /^supplier code "(.+)" already exists$/,
    build: ([, value]) => [
      `This supplier code is already in use (${value})`,
      `كود المورد هذا مستخدم بالفعل (${value})`,
    ],
  },
  {
    regex: /^User with email "(.+)" already exists$/,
    build: ([, value]) => [
      `This email is already registered to a user (${value})`,
      `هذا البريد مسجّل بالفعل لمستخدم آخر (${value})`,
    ],
  },
  {
    regex: /^User with phone "(.+)" already exists$/,
    build: ([, value]) => [
      `This phone number is already in use (${value})`,
      `هذا الرقم مستخدم بالفعل لمستخدم آخر (${value})`,
    ],
  },
  {
    regex: /^Product SKU "(.+)" already exists$/,
    build: ([, value]) => [
      `This product code (SKU) is already in use (${value})`,
      `كود المنتج هذا مستخدم بالفعل (${value})`,
    ],
  },
  {
    regex: /^Product barcode "(.+)" already exists$/,
    build: ([, value]) => [
      `This barcode is already in use (${value})`,
      `الباركود هذا مستخدم بالفعل (${value})`,
    ],
  },
  {
    regex: /^Role "(.+)" already exists$/,
    build: ([, value]) => [
      `A role with this name already exists (${value})`,
      `يوجد دور بهذا الاسم بالفعل (${value})`,
    ],
  },
  {
    regex: /^invoice not found$/i,
    build: () => ["Invoice not found", "الفاتورة غير موجودة"],
  },
  {
    regex: /^customerId is required for sales invoices$/,
    build: () => ["A customer is required for sales invoices", "يجب اختيار العميل في فواتير المبيعات"],
  },
  {
    regex: /^supplierId is required for purchase invoices$/,
    build: () => ["A supplier is required for purchase invoices", "يجب اختيار المورد في فواتير الشراء"],
  },
  {
    regex: /^At least one line is required$/,
    build: () => ["At least one line is required", "يجب إضافة سطر واحد على الأقل"],
  },
  {
    regex: /^Quantity must be greater than zero$/,
    build: () => ["Quantity must be greater than zero", "الكمية يجب أن تكون أكبر من صفر"],
  },
  {
    regex: /^Payment amount must be positive$/,
    build: () => ["Payment amount must be positive", "مبلغ الدفع يجب أن يكون أكبر من صفر"],
  },
  {
    regex: /^Payment exceeds invoice total$/,
    build: () => ["Payment exceeds the invoice total", "مبلغ الدفع يتجاوز إجمالي الفاتورة"],
  },
  {
    regex: /^Cannot pay a void invoice$/,
    build: () => ["Cannot pay a cancelled invoice", "لا يمكن دفع فاتورة ملغاة"],
  },
  {
    regex: /^Cannot update a void invoice$/,
    build: () => ["Cannot update a cancelled invoice", "لا يمكن تعديل فاتورة ملغاة"],
  },
  {
    regex: /^Cannot receive a void invoice$/,
    build: () => ["Cannot receive a cancelled invoice", "لا يمكن استلام فاتورة ملغاة"],
  },
  {
    regex: /^A warehouse is required to receive the goods$/,
    build: () => ["A warehouse is required to receive the goods", "المستودع مطلوب لاستلام البضاعة"],
  },
  {
    regex: /^Only purchase orders can be received$/,
    build: () => ["Only purchase orders can be received", "يمكن استلام أوامر الشراء فقط"],
  },
  {
    regex: /^Cannot delete (.+) with linked transactions$/,
    build: ([, kind]) => [
      `Cannot delete this ${kind} because it has linked transactions`,
      `لا يمكن حذف هذا ${kind === "customer" ? "العميل" : "السجل"} لارتباطه بمعاملات`,
    ],
  },
  {
    regex: /^Journal entry must be balanced \(debits must equal credits\)$/,
    build: () => ["Journal entry must be balanced (debits must equal credits)", "يجب أن يكون قيد اليومية متوازناً (المدين = الدائن)"],
  },
];

export function translateApiError(error: unknown, t: TranslateFn): string {
  const fallback = t("Operation failed", "فشلت العملية");
  if (!(error instanceof Error) || !error.message) return fallback;
  for (const matcher of MATCHERS) {
    const match = error.message.match(matcher.regex);
    if (match) {
      const [en, ar] = matcher.build(match);
      return t(en, ar);
    }
  }
  return error.message;
}
