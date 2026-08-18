import { format } from "date-fns";

/** Minutes since local midnight, as a float so the now-line can move smoothly. */
export function minutesNow(d: Date = new Date()): number {
  return (
    d.getHours() * 60 +
    d.getMinutes() +
    d.getSeconds() / 60 +
    d.getMilliseconds() / 60000
  );
}

/*
  Twelve-hour everywhere it is read.

  The schedule stores "HH:mm" in 24h and every comparison in the app is done in
  minutes since midnight, so nothing about the clock's arithmetic changes — this
  is a display format and only a display format. The meridiem is a single
  lowercase letter with no space because the day rail gives a start time about
  fifty pixels and "12:20 PM" does not fit in them; "12:20p" does, and stays
  unambiguous, which "12:20" on its own would not.
*/
function clockLabel(h24: number, m: number, seconds?: number): string {
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(m).padStart(2, "0");
  const ss = seconds == null ? "" : `:${String(seconds).padStart(2, "0")}`;
  return `${h}:${mm}${ss}${h24 < 12 ? "a" : "p"}`;
}

/** 462.5 -> "7:42a" */
export function formatClock(minutes: number): string {
  const total = Math.floor(minutes);
  return clockLabel(Math.floor(total / 60) % 24, total % 60);
}

/** "17:30", the schedule's own format -> "5:30p". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return clockLabel(h, m);
}

/** With seconds, for the masthead's proof of life. */
export function formatWatch(d: Date): string {
  return clockLabel(d.getHours(), d.getMinutes(), d.getSeconds());
}

/** Compact duration for countdowns: 95 -> "1h 35m", 8 -> "8m", 0.4 -> "<1m". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export interface ClockOverride {
  /** YYYY-MM-DD */
  date?: string;
  /** minutes since midnight */
  minutes?: number;
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dev/preview affordance: `?t=07:50` and `?d=2026-08-19` pin the clock so any
 * point in the day can be inspected without waiting for it. Invalid values are
 * ignored rather than throwing — this is a URL, not an API.
 */
export function readClockOverride(search: string): ClockOverride {
  const out: ClockOverride = {};
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return out;
  }

  const d = params.get("d");
  if (d && DATE_RE.test(d)) {
    const parsed = new Date(`${d}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) out.date = d;
  }

  const t = params.get("t");
  const m = t ? TIME_RE.exec(t) : null;
  if (m) out.minutes = Number(m[1]) * 60 + Number(m[2]);

  return out;
}

export function todayISO(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd");
}
