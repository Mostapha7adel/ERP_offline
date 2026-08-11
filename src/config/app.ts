import type { CompanyProfile, AppPreferences } from "@/types/domain";

export const APP_NAME = "LedgerFlow";
export const APP_TAGLINE = "Offline accounting, without compromise";
export const APP_VERSION = "1.0.0";

export const DEFAULT_COMPANY: CompanyProfile = {
  name: "LedgerFlow",
  legalName: "LedgerFlow Inc.",
  taxId: "US-84-0000000",
  registrationNumber: "REG-2023-0042",
  email: "hello@ledgerflow.app",
  phone: "+1 (555) 010-2030",
  website: "www.ledgerflow.app",
  address: {
    street: "100 Market Street",
    city: "San Francisco",
    state: "CA",
    country: "United States",
    postalCode: "94105",
  },
  currency: "USD",
  fiscalYearStart: "2026-01-01",
  timezone: "America/Los_Angeles",
  logoInitials: "LF",
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  language: "en",
  dateFormat: "MMM d, yyyy",
  numberFormat: "en-US",
  lowStockThreshold: 15,
  currency: "USD",
  defaultTaxRate: 8.25,
  showDecimals: true,
  notificationsEnabled: true,
  autoSave: true,
};
