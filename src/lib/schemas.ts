import { z } from "zod";

export const partySchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  code: z.string().optional(),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.string().optional(),
  currency: z.string().default("USD"),
  status: z.enum(["active", "inactive", "blocked"]).default("active"),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  note: z.string().optional(),
});

export type PartyFormValues = z.infer<typeof partySchema>;

export const productSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(40),
  barcode: z.string().max(40).optional(),
  name: z.string().min(2, "Product name is required").max(160),
  category: z.string().min(1, "Category is required"),
  unit: z.string().default("pc"),
  costPrice: z.coerce.number().min(0, "Must be 0 or more"),
  salePrice: z.coerce.number().min(0, "Must be 0 or more"),
  taxRate: z.coerce.number().min(0).max(100),
  reorderLevel: z.coerce.number().int().min(0),
  description: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const warehouseSchema = z.object({
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(2, "Name is required").max(120),
  location: z.string().min(1, "Location is required").max(160),
  manager: z.string().optional(),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;

export const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  roleId: z.string().min(1, "Select a role"),
  status: z.enum(["active", "invited", "suspended"]).default("active"),
});

export type UserFormValues = z.infer<typeof userSchema>;

export const roleSchema = z.object({
  name: z.string().min(2, "Role name is required"),
  description: z.string().optional(),
});

export type RoleFormValues = z.infer<typeof roleSchema>;

export const transactionSchema = z.object({
  reference: z.string().optional(),
  bankAccountId: z.string().min(1, "Select an account"),
  date: z.coerce.date({ required_error: "Date is required" }),
  type: z.enum(["inflow", "outflow", "transfer"]),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(2, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;