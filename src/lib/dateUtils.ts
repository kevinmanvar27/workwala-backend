/**
 * dateUtils.ts — Linko shared date/time helpers
 * All display formatting uses IST (Asia/Kolkata, UTC+5:30).
 */

export const IST_TIMEZONE = 'Asia/Kolkata';
export const IST_LOCALE   = 'en-IN';

// ─── IST offset helpers ───────────────────────────────────────────────────────

/** Returns the IST offset in milliseconds (+05:30 = 19800000 ms). */
function istOffsetMs(): number {
  return 5.5 * 60 * 60 * 1000; // +05:30 fixed offset
}

/**
 * Returns the current time as a `datetime-local` string (YYYY-MM-DDTHH:mm)
 * expressed in IST — suitable for `<input type="datetime-local">` default values.
 */
export function nowIST(): string {
  const utc = Date.now();
  return new Date(utc + istOffsetMs()).toISOString().slice(0, 16);
}

/**
 * Returns a `datetime-local` string (YYYY-MM-DDTHH:mm) in IST for
 * `days` days from now.
 */
export function nowPlusDaysIST(days: number): string {
  const utc = Date.now() + days * 24 * 60 * 60 * 1000;
  return new Date(utc + istOffsetMs()).toISOString().slice(0, 16);
}

/**
 * Returns current time + `minutes` minutes as a datetime-local string in IST.
 * Useful for scheduling defaults.
 */
export function nowPlusMinutesIST(minutes: number): string {
  const utc = Date.now() + minutes * 60 * 1000;
  return new Date(utc + istOffsetMs()).toISOString().slice(0, 16);
}

// ─── Display formatters ───────────────────────────────────────────────────────

/**
 * Format a date/ISO string for display in IST with full date + time.
 * e.g. "15 Aug 2026, 3:30 PM"
 */
export function formatDateTimeIST(
  date: Date | string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '—';
  return new Date(date).toLocaleString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...opts,
  });
}

/**
 * Format a date/ISO string for display in IST — date only.
 * e.g. "15 Aug 2026"
 */
export function formatDateIST(
  date: Date | string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

/**
 * Format a date/ISO string for display in IST — time only.
 * e.g. "3:30 PM"
 */
export function formatTimeIST(
  date: Date | string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
}
