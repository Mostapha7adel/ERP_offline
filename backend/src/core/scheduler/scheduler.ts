import { logger } from "../logger/logger.js";

/**
 * Lightweight in-process scheduler. The ERP runs fully offline, so scheduled
 * work (auto-backup, alert push) is driven by a simple setInterval that checks
 * the relevant settings and performs the work. No external cron dependency.
 */
export function scheduleEvery(ms: number, label: string, work: () => Promise<void>): NodeJS.Timeout {
  const timer = setInterval(() => {
    void work().catch((err) => {
      logger.warn({ err }, `Scheduled task "${label}" failed`);
    });
  }, ms);
  // Do not keep the process alive solely for the scheduler.
  timer.unref();
  logger.info({ ms, label }, `Scheduled task "${label}" registered`);
  return timer;
}