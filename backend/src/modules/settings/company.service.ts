import { settingsRepository } from "./settings.repository.js";

export class CompanyService {
  async getCompany() {
    const raw = await settingsRepository.getAll();
    return {
      name: (raw["company.name"] as string) ?? "LedgerFlow",
      legalName: raw["company.legalName"] as string | undefined,
      address: raw["company.address"] as string | undefined,
      phone: raw["company.phone"] as string | undefined,
      email: raw["company.email"] as string | undefined,
      taxNumber: raw["company.taxNumber"] as string | undefined,
      currency: (raw["company.currency"] as string) ?? "EGP",
      fiscalYearStart: (raw["company.fiscalYearStart"] as string) ?? "01-01",
      logoUrl: raw["company.logoUrl"] as string | undefined,
    };
  }
}

export const companyService = new CompanyService();