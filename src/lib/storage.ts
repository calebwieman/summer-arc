import { eachDayOfInterval, format, parseISO } from "date-fns";
import { DEFAULT_HABITS } from "./today";
import type { DailyLog, HabitDef, WeeklyReview } from "./types";

const DAILY_PREFIX = "summer:daily:";
const WEEKLY_PREFIX = "summer:weekly:";
const HABITS_KEY = "summer:habits";

function dailyKey(date: string) {
  return `${DAILY_PREFIX}${date}`;
}

function weeklyKey(weekStart: string) {
  return `${WEEKLY_PREFIX}${weekStart}`;
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
  const days = eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(end),
  });
  const logs: DailyLog[] = [];
  for (const day of days) {
    const log = getDailyLog(format(day, "yyyy-MM-dd"));
    if (log) logs.push(log);
  }
  return logs;
}

export function getWeeklyReview(weekStart: string): WeeklyReview | null {
  return read<WeeklyReview>(weeklyKey(weekStart));
}

export function saveWeeklyReview(review: WeeklyReview): void {
  write(weeklyKey(review.weekStart), review);
}

function isValidHabitList(value: unknown): value is HabitDef[] {
  return (
    Array.isArray(value) &&
    value.every(
      (h) =>
        h &&
        typeof h === "object" &&
        typeof (h as HabitDef).id === "string" &&
        typeof (h as HabitDef).label === "string",
    )
  );
}

export function getHabits(): HabitDef[] {
  const stored = read<HabitDef[]>(HABITS_KEY);
  if (isValidHabitList(stored) && stored.length > 0) return stored;
  return DEFAULT_HABITS;
}

export function saveHabits(habits: HabitDef[]): void {
  write(HABITS_KEY, habits);
}

export interface BackupBundle {
  schema: 1;
  exportedAt: string;
  daily: Record<string, DailyLog>;
  weekly: Record<string, WeeklyReview>;
  habits?: HabitDef[];
}

export function exportBackup(): BackupBundle {
  const daily: Record<string, DailyLog> = {};
  const weekly: Record<string, WeeklyReview> = {};
  if (typeof window === "undefined") {
    return { schema: 1, exportedAt: new Date().toISOString(), daily, weekly };
  }
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(DAILY_PREFIX)) {
      const log = read<DailyLog>(key);
      if (log) daily[log.date] = log;
    } else if (key.startsWith(WEEKLY_PREFIX)) {
      const review = read<WeeklyReview>(key);
      if (review) weekly[review.weekStart] = review;
    }
  }
  return {
    schema: 1,
    exportedAt: new Date().toISOString(),
    daily,
    weekly,
    habits: getHabits(),
  };
}

export function importBackup(
  bundle: unknown,
  { merge = true }: { merge?: boolean } = {},
): { daily: number; weekly: number } {
  if (typeof window === "undefined") return { daily: 0, weekly: 0 };
  if (!bundle || typeof bundle !== "object") throw new Error("Invalid backup file");
  const b = bundle as Partial<BackupBundle>;
  if (!b.daily || typeof b.daily !== "object") throw new Error("Invalid backup file");

  if (!merge) clearAllLogs();

  if (isValidHabitList(b.habits) && b.habits.length > 0) {
    saveHabits(b.habits);
  }

  let dailyCount = 0;
  for (const [date, log] of Object.entries(b.daily)) {
    if (log && typeof log === "object" && typeof date === "string") {
      write(dailyKey(date), log);
      dailyCount += 1;
    }
  }

  let weeklyCount = 0;
  if (b.weekly && typeof b.weekly === "object") {
    for (const [weekStart, review] of Object.entries(b.weekly)) {
      if (review && typeof review === "object" && typeof weekStart === "string") {
        write(weeklyKey(weekStart), review);
        weeklyCount += 1;
      }
    }
  }

  return { daily: dailyCount, weekly: weeklyCount };
}

export function clearAllLogs(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && (key.startsWith(DAILY_PREFIX) || key.startsWith(WEEKLY_PREFIX))) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) window.localStorage.removeItem(key);
}
