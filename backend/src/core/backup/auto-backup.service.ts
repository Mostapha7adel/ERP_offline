import { settingsRepository } from "../../modules/settings/settings.repository.js";
import { backupRepository } from "../../modules/backup/backup.repository.js";
import { logger } from "../logger/logger.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Auto-backup runner: creates a full database snapshot on a schedule configured
 * through preferences and prunes old backups by retention. When an external
 * folder (e.g. a cloud-synced directory) is configured, a copy of the download
 * payload is written there so it can be picked up by Dropbox/OneDrive/etc.
 */
export class AutoBackupService {
  private lastRunAt = 0;

  async tick(): Promise<void> {
    const enabled = (await settingsRepository.get("prefs.autoBackupEnabled")) ?? false;
    if (!enabled) return;

    const frequencyHours = Number((await settingsRepository.get("prefs.autoBackupFrequencyHours")) ?? 24);
    const intervalMs = frequencyHours * 60 * 60 * 1000;
    const now = Date.now();
    if (now - this.lastRunAt < intervalMs) return;
    this.lastRunAt = now;

    try {
      const { backupService } = await import("../../modules/backup/backup.service.js");
      const backup = await backupService.createBackup({ label: `Automatic backup ${new Date().toLocaleString()}` }, {});
      logger.info({ backupId: backup.id }, "Automatic backup created");

      // Write a portable copy into the configured (cloud-synced) folder.
      const folder = (await settingsRepository.get("prefs.autoBackupFolder")) as string | undefined;
      if (folder && folder.trim().length > 0) {
        try {
          const dir = resolve(folder.trim());
          mkdirSync(dir, { recursive: true });
          const { json } = await backupService.getDownload(backup.id);
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const file = join(dir, `ledgerflow-backup-${stamp}.json`);
          writeFileSync(file, json, "utf8");
          logger.info({ file }, "Automatic backup copied to external folder");
        } catch (err) {
          logger.warn({ err }, "Could not copy automatic backup to external folder");
        }
      }

      // Prune old automatic backups beyond the retention window.
      await this.prune();
    } catch (err) {
      logger.error({ err }, "Automatic backup failed");
    }
  }

  private async prune(): Promise<void> {
    try {
      const retention = Number((await settingsRepository.get("prefs.autoBackupRetention")) ?? 7);
      const backups = await backupRepository.findAll();
      const automatic = backups
        .filter((b: { label?: string }) => String(b.label ?? "").toLowerCase().includes("automatic"))
        .sort((a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt));
      const excess = automatic.length - retention;
      for (let i = 0; i < excess; i++) {
        await backupRepository.delete(automatic[i].id);
      }
      if (excess > 0) logger.info({ pruned: excess }, "Pruned old automatic backups");
    } catch (err) {
      logger.warn({ err }, "Could not prune automatic backups");
    }
  }
}

export const autoBackupService = new AutoBackupService();