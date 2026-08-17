import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { isHabitScheduled } from "./schedule";
import { HABIT_KEYS, HABIT_LABELS, getTodayString } from "./today";
import type { DailyLog, HabitKey } from "./types";

const DAILY_PREFIX = "standard:daily:";

function dailyKey(date: string) {
  return `${DAILY_PREFIX}${date}`;
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getDailyLog(date: string): DailyLog | null {
  return read<DailyLog>(dailyKey(date));
}

export function getAllDailyLogs(): DailyLog[] {
  if (typeof window === "undefined") return [];
  const logs: DailyLog[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(DAILY_PREFIX)) continue;
    const log = read<DailyLog>(key);
    if (log) logs.push(log);
  }
  return logs.sort((a, b) => a.date.localeCompare(b.date));
}

export function saveDailyLog(log: DailyLog): void {
  write(dailyKey(log.date), log);
}

export function getDateRange(start: string, end: string): DailyLog[] {
  const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
  const logs: DailyLog[] = [];
  for (const day of days) {
    const log = getDailyLog(format(day, "yyyy-MM-dd"));
    if (log) logs.push(log);
  }
  return logs;
}

/** ISO date of the earliest log, or null when nothing has been logged yet. */
function earliestLogDate(): string | null {
  const logs = getAllDailyLogs();
  return logs.length > 0 ? logs[0].date : null;
}

function wasDone(date: string, habit: HabitKey): boolean {
  return getDailyLog(date)?.habits?.[habit] === true;
}

/**
 * A day counts toward a habit's denominator only when it is on or after the
 * first day anything was logged (so adopting the app mid-window isn't scored as
 * a pile of misses) and the habit is actually scheduled that day — Sunday is
 * not a training miss, and the weekend is not a deep-work miss.
 */
function isScoredDay(date: string, habit: HabitKey, since: string): boolean {
  return date >= since && isHabitScheduled(habit, date);
}

/**
 * Share of scheduled days in the trailing window where the habit was done,
 * as 0–1. Today is excluded — it isn't over yet, and scoring an in-progress day
 * as a miss is just noise. A scheduled day with no log counts as a miss.
 * Returns 0 when there is nothing to score yet.
 */
export function getRollingRate(habitKey: HabitKey, days = 14): number {
  const since = earliestLogDate();
  if (!since) return 0;

  const yesterday = subDays(parseISO(getTodayString()), 1);
  let done = 0;
  let scored = 0;

  for (let i = 0; i < days; i++) {
    const date = format(subDays(yesterday, i), "yyyy-MM-dd");
    if (!isScoredDay(date, habitKey, since)) continue;
    scored++;
    if (wasDone(date, habitKey)) done++;
  }

  return scored === 0 ? 0 : done / scored;
}

/** How far back `hasMissedTwice` will look to find two scheduled days. */
const MISS_LOOKBACK_DAYS = 60;

/**
 * True only when the two most recent completed scheduled days were both missed.
 * This is the only failure signal in the app — there are no streaks. Today is
 * excluded, and unscheduled days are skipped rather than counted as a break, so
 * missing Saturday's long run and then Monday's run reads as twice in a row.
 */
export function hasMissedTwice(habitKey: HabitKey): boolean {
  const since = earliestLogDate();
  if (!since) return false;

  const yesterday = subDays(parseISO(getTodayString()), 1);
  const recent: boolean[] = [];

  for (let i = 0; i < MISS_LOOKBACK_DAYS && recent.length < 2; i++) {
    const date = format(subDays(yesterday, i), "yyyy-MM-dd");
    if (!isScoredDay(date, habitKey, since)) continue;
    recent.push(wasDone(date, habitKey));
  }

  return recent.length === 2 && !recent[0] && !recent[1];
}

/**
 * The most recent session note before `beforeDate`. Shown while logging today's
 * training so the last workout is in view when you write this one — the thing a
 * runner actually wants at the moment of entry.
 */
export function lastTrainingNote(
  beforeDate: string,
): { date: string; note: string } | null {
  const prior = getAllDailyLogs().filter(
    (l) => l.date < beforeDate && l.trainingNote?.trim(),
  );
  const last = prior[prior.length - 1];
  return last ? { date: last.date, note: last.trainingNote.trim() } : null;
}

export interface BackupBundle {
  schema: 3;
  exportedAt: string;
  daily: Record<string, DailyLog>;
}

export function exportBackup(): BackupBundle {
  const daily: Record<string, DailyLog> = {};
  for (const log of getAllDailyLogs()) daily[log.date] = log;
  return { schema: 3, exportedAt: new Date().toISOString(), daily };
}

export function importBackup(
  bundle: unknown,
  { merge = true }: { merge?: boolean } = {},
): { daily: number } {
  if (typeof window === "undefined") return { daily: 0 };
  if (!bundle || typeof bundle !== "object") throw new Error("Invalid backup file");
  const b = bundle as Partial<BackupBundle>;
  if (!b.daily || typeof b.daily !== "object") throw new Error("Invalid backup file");

  if (!merge) clearAllLogs();

  let count = 0;
  for (const [date, log] of Object.entries(b.daily)) {
    if (log && typeof log === "object" && typeof date === "string") {
      write(dailyKey(date), log);
      count += 1;
    }
  }
  return { daily: count };
}

export function clearAllLogs(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(DAILY_PREFIX)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) window.localStorage.removeItem(key);
}

/** Flat CSV of every daily log, one row per day. */
export function exportCsv(): string {
  const cols = [
    "date",
    "deep_work_minutes",
    "content_shipped",
    "training_note",
    "note",
    ...HABIT_KEYS.map((k) => `habit:${HABIT_LABELS[k]}`),
  ];
  const rows = getAllDailyLogs().map((log) => [
    log.date,
    log.deepWorkMinutes || "",
    log.contentShipped ? "1" : "",
    log.trainingNote ?? "",
    log.note ?? "",
    ...HABIT_KEYS.map((k) => (log.habits?.[k] ? "1" : "")),
  ]);
  return [cols, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
