import { toast as sonnerToast } from "sonner";

/**
 * Thin wrapper around Sonner for a single import point across the app.
 * Exported as `toast` and a hook for idiomatic usage.
 */
export const toast = sonnerToast;

export function useToast() {
  return sonnerToast;
}