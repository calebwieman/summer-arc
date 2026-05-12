import {
  endOfMonth,
  format,
  isBefore,
  parseISO,
  startOfMonth,
  subDays,
} from "date-fns";
import { getAllDailyLogs, getDailyLog, getDateRange } from "./storage";
import { getTodayString } from "./today";
import type { DailyLog } from "./types";

export const STREAK_THRESHOLD = 6;

export function countCheckedHabits(log: DailyLog): number {
  return Object.values(log.habits).filter(Boolean).length;
}

export function currentStreak(): number {
  let streak = 0;
  const todayStr = getTodayString();
  let cursor = parseISO(todayStr);
  let isToday = true;

  while (true) {
    const dateStr = format(cursor, "yyyy-MM-dd");
    const log = getDailyLog(dateStr);
    const count = log ? countCheckedHabits(log) : 0;

    if (count >= STREAK_THRESHOLD) {
      streak++;
    } else if (!isToday) {
      break;
    }

    isToday = false;
    cursor = subDays(cursor, 1);
    if (streak > 365) break;
  }

  return streak;
}

export function bestStreak(): number {
  const logs = getAllDailyLogs();
  if (logs.length === 0) return 0;

  let best = 0;
  let current = 0;
  let prevDate: Date | null = null;

  for (const log of logs) {
    const date = parseISO(log.date);
    const count = countCheckedHabits(log);

    if (count >= STREAK_THRESHOLD) {
      const consecutive =
        prevDate &&
        format(subDays(date, 1), "yyyy-MM-dd") === format(prevDate, "yyyy-MM-dd");
      current = consecutive ? current + 1 : 1;
      if (current > best) best = current;
      prevDate = date;
    } else {
      current = 0;
      prevDate = null;
    }
  }

  return best;
}

export interface MonthStats {
  miles: number;
  coldCalls: number;
  plunges: number;
  bibleDays: number;
}

export function monthStats(monthDate: Date): MonthStats {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const todayStr = getTodayString();
  const today = parseISO(todayStr);
  const cappedEnd = isBefore(today, end) ? today : end;

  const logs = getDateRange(
    format(start, "yyyy-MM-dd"),
    format(cappedEnd, "yyyy-MM-dd"),
  );

  return {
    miles: round1(logs.reduce((sum, l) => sum + (l.runMiles || 0), 0)),
    coldCalls: logs.reduce((sum, l) => sum + (l.coldCalls || 0), 0),
    plunges: logs.filter((l) => l.habits.plunge).length,
    bibleDays: logs.filter((l) => l.habits.bibleAm || l.habits.bibleEvening)
      .length,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function recentSleepMedian(days = 14): number {
  const today = parseISO(getTodayString());
  const start = subDays(today, days);
  const logs = getDateRange(
    format(start, "yyyy-MM-dd"),
    format(today, "yyyy-MM-dd"),
  );
  const sleeps = logs
    .map((l) => l.sleepHours)
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  if (sleeps.length === 0) return 0;
  const mid = Math.floor(sleeps.length / 2);
  const median =
    sleeps.length % 2 === 0
      ? (sleeps[mid - 1] + sleeps[mid]) / 2
      : sleeps[mid];
  return round1(median);
}
