import { AppError } from "../../core/errors/app-error.js";
import { settingsRepository } from "./settings.repository.js";
import {
  companySettingsSchema,
  preferencesSchema,
  type CompanySettingsInput,
  type PreferencesInput,
} from "./settings.schema.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";

export class SettingsService {
  async getCompany(): Promise<CompanySettingsInput> {
    const raw = await settingsRepository.getAll();
    return companySettingsSchema.parse({
      name: raw["company.name"] ?? "LedgerFlow",
      legalName: raw["company.legalName"],
      address: raw["company.address"],
      phone: raw["company.phone"],
      email: raw["company.email"],
      taxNumber: raw["company.taxNumber"],
      currency: raw["company.currency"] ?? "USD",
      fiscalYearStart: raw["company.fiscalYearStart"] ?? "01-01",
      logoUrl: raw["company.logoUrl"],
    });
  }

  async getPreferences(): Promise<PreferencesInput> {
    const raw = await settingsRepository.getAll();
    return preferencesSchema.parse({
      defaultWarehouseId: raw["prefs.defaultWarehouseId"],
      lowStockThreshold: raw["prefs.lowStockThreshold"] ?? 10,
      invoicePrefix: raw["prefs.invoicePrefix"] ?? "INV",
      purchasePrefix: raw["prefs.purchasePrefix"] ?? "PUR",
      taxEnabled: raw["prefs.taxEnabled"] ?? true,
      defaultTaxRate: raw["prefs.defaultTaxRate"] ?? 0,
      dateFormat: raw["prefs.dateFormat"] ?? "yyyy-MM-dd",
      notifyOnLowStock: raw["prefs.notifyOnLowStock"] ?? true,
      notifyOnInvoiceCreated: raw["prefs.notifyOnInvoiceCreated"] ?? true,
      costingMethod: raw["prefs.costingMethod"] ?? "average",
      enforceCreditLimit: raw["prefs.enforceCreditLimit"] ?? false,
      autoBackupEnabled: raw["prefs.autoBackupEnabled"] ?? false,
      autoBackupFrequencyHours: raw["prefs.autoBackupFrequencyHours"] ?? 24,
      autoBackupRetention: raw["prefs.autoBackupRetention"] ?? 7,
      autoBackupFolder: raw["prefs.autoBackupFolder"] ?? "",
    });
  }

  async getAll() {
    return {
      company: await this.getCompany(),
      preferences: await this.getPreferences(),
    };
  }

  async updateCompany(input: CompanySettingsInput, audit: AuditContext) {
    const validated = companySettingsSchema.parse(input);
    for (const [key, value] of Object.entries(validated)) {
      await settingsRepository.set(`company.${key}`, value, "company");
    }
    await auditService.log(audit, "update:company-settings", "settings");
    return this.getCompany();
  }

  async updatePreferences(input: PreferencesInput, audit: AuditContext) {
    const validated = preferencesSchema.parse(input);
    for (const [key, value] of Object.entries(validated)) {
      await settingsRepository.set(`prefs.${key}`, value, "preferences");
    }
    await auditService.log(audit, "update:preferences", "settings");
    return this.getPreferences();
  }

  async updateAll(input: { company?: CompanySettingsInput; preferences?: PreferencesInput }, audit: AuditContext) {
    let company = await this.getCompany();
    let preferences = await this.getPreferences();
    if (input.company) company = await this.updateCompany(input.company, audit);
    if (input.preferences) preferences = await this.updatePreferences(input.preferences, audit);
    return { company, preferences };
  }

  async getByKey(key: string) {
    const value = await settingsRepository.get(key);
    if (value === undefined) throw AppError.notFound(`Setting "${key}" not found`);
    return { key, value };
  }
}

export const settingsService = new SettingsService();
