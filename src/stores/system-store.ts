import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEntityStore } from "./entity-store";
import { defaultRoles } from "@/lib/permissions";
import type { AppUser, AppRole, AuditLog } from "@/types/domain";

export const useUsersStore = createEntityStore<AppUser>("users", []);

export const useRolesStore = createEntityStore<AppRole>(
  "roles",
  defaultRoles,
);

export const useAuditLogsStore = createEntityStore<AuditLog>("audit-logs", []);

interface BackupState {
  lastBackupAt: string | null;
  setLastBackupAt: (value: string) => void;
}

export const useBackupStore = create<BackupState>()(
  persist(
    (set) => ({
      lastBackupAt: null,
      setLastBackupAt: (lastBackupAt) => set({ lastBackupAt }),
    }),
    { name: "ledgerflow:backup-meta" },
  ),
);
