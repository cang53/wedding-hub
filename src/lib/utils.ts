import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { LOCALE, CURRENCY } from "./config";

/** shadcn's standard cn() helper — merge classnames with Tailwind dedup. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as EUR with Belgian conventions:
 * `€1.234` — period as thousands separator, no decimals for whole amounts.
 * Returns "—" for null/undefined/NaN so callers can pass raw DB values.
 */
export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(Number(n));
}

/** Short date: "12 Sep 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Long date: "Saturday, 12 September 2026". */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Time only: "14:30". Returns "" if isAllDay or no time component. */
export function formatTime(iso: string | null | undefined, isAllDay = false): string {
  if (!iso || isAllDay) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Days from now until target date. Negative if already past. */
export function daysUntil(iso: string): number {
  const target = new Date(iso);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
