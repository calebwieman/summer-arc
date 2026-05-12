import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { DailyLog, WeeklyReview } from "./types";

const DAILY_PREFIX = "summer:daily:";
const WEEKLY_PREFIX = "summer:weekly:";

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
