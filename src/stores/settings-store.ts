import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_COMPANY,
  DEFAULT_PREFERENCES,
  APP_VERSION,
} from "@/config/app";
import type { CompanyProfile, AppPreferences, BackupMeta } from "@/types/domain";
import { uuid } from "@/lib/utils";

interface SettingsState {
  company: CompanyProfile;
  preferences: AppPreferences;
  backupHistory: BackupMeta[];
  updateCompany: (patch: Partial<CompanyProfile>) => void;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
  recordBackup: (name: string, size: number, type: "manual" | "auto") => void;
  removeBackup: (id: string) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      company: DEFAULT_COMPANY,
      preferences: DEFAULT_PREFERENCES,
      backupHistory: [],
      updateCompany: (patch) =>
        set((state) => ({ company: { ...state.company, ...patch } })),
      updatePreferences: (patch) =>
        set((state) => ({
          preferences: { ...state.preferences, ...patch },
        })),
      recordBackup: (name, size, type) =>
        set((state) => ({
          backupHistory: [
            {
              id: uuid("bkp"),
              name,
              createdAt: new Date().toISOString(),
              size,
              type,
              version: APP_VERSION,
            },
            ...state.backupHistory,
          ].slice(0, 25),
        })),
      removeBackup: (id) =>
        set((state) => ({
          backupHistory: state.backupHistory.filter((b) => b.id !== id),
        })),
      reset: () =>
        set({ company: DEFAULT_COMPANY, preferences: DEFAULT_PREFERENCES, backupHistory: [] }),
    }),
    { name: "ledgerflow:settings" },
  ),
);
