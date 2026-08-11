import { format, formatDistanceToNow, parseISO } from "date-fns";
import { useSettingsStore } from "@/stores/settings-store";

/** Read current preferences without subscribing (safe in utility functions). */
function prefs() {
  return useSettingsStore.getState().preferences;
}

export function formatCurrency(
  amount: number,
  currency?: string,
  showDecimals?: boolean,
): string {
  const p = prefs();
  const cur = currency ?? p.currency;
  const decimals = showDecimals ?? p.showDecimals;
  return new Intl.NumberFormat(p.numberFormat || "en-US", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(amount);
}

export function formatNumber(amount: number, decimals?: number): string {
  const p = prefs();
  const d = decimals ?? (p.showDecimals ? 2 : 0);
  return new Intl.NumberFormat(p.numberFormat || "en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(amount);
}

export function formatCompact(amount: number, currency?: string): string {
  const p = prefs();
  const cur = currency ?? p.currency;
  return new Intl.NumberFormat(p.numberFormat || "en-US", {
    style: "currency",
    currency: cur,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** Some stored dateFormat preferences use lowercase `mm` (minutes) which date-fns
 * resolves to minutes instead of `MM` (month), e.g. `dd/mm/yyyy` renders "03/49/2026".
 * Also guard against duplicated `yy` tokens that would render "002026".
 * Normalize date-only tokens so this preference is always safe. */
function normalizeDateFormat(fmt: string): string {
  return fmt
    .replace(/mm/g, "MM")
    .replace(/yyyyyyyy/g, "yyyy")
    .replace(/yyyyyy/g, "yyyy")
    .replace(/yyyyy/g, "yyyy")
    .replace(/(?<!y)yy(?!y)/g, "yyyy");
}

export function formatDate(value: string, pattern?: string): string {
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  const fmt = normalizeDateFormat(pattern ?? prefs().dateFormat ?? "MMM d, yyyy");
  return format(date, fmt);
}

export function formatDateTime(value: string): string {
  const p = prefs();
  const isDayFirst = (p.dateFormat ?? "MMM d, yyyy").startsWith("dd");
  return formatDate(value, isDayFirst ? "dd/MM/yyyy • h:mm a" : "MMM d, yyyy • h:mm a");
}

export function timeAgo(value: string): string {
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function padNumber(value: number, length = 4): string {
  return String(value).padStart(length, "0");
}

export function formatAccountBalance(amount: number, currency?: string): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(amount), currency)}`;
}
