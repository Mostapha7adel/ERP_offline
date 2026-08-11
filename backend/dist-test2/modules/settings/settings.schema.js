import { z } from "zod";
export const companySettingsSchema = z.object({
    name: z.string().min(1, "Company name is required").max(200),
    legalName: z.string().max(200).optional(),
    address: z.string().max(500).optional(),
    phone: z.string().max(30).optional(),
    email: z.string().email().optional().or(z.literal("")),
    taxNumber: z.string().max(50).optional(),
    currency: z.string().max(3).default("USD"),
    fiscalYearStart: z.string().default("01-01"),
    logoUrl: z.string().url().optional().or(z.literal("")),
});
export const preferencesSchema = z.object({
    defaultWarehouseId: z.string().optional(),
    lowStockThreshold: z.number().int().nonnegative().default(10),
    invoicePrefix: z.string().max(10).default("INV"),
    purchasePrefix: z.string().max(10).default("PUR"),
    taxEnabled: z.boolean().default(true),
    defaultTaxRate: z.number().min(0).max(100).default(0),
    dateFormat: z.string().max(20).default("yyyy-MM-dd"),
    notifyOnLowStock: z.boolean().default(true),
    notifyOnInvoiceCreated: z.boolean().default(true),
});
export const settingsUpdateSchema = z.object({
    company: companySettingsSchema.optional(),
    preferences: preferencesSchema.optional(),
});
export const settingValueSchema = z.object({
    value: z.unknown(),
});
