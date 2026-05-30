import {
  endOfMonth,
  format,
  isBefore,
  parseISO,
  startOfMonth,
  subDays,
} from "date-fns";
import { getAllDailyLogs, getDailyLog, getDateRange, getHabits } from "./storage";
import { getTodayString } from "./today";
import type { DailyLog, HabitDef } from "./types";

/** A day counts toward a streak when ~75% of the active habits are done. */
export function streakThreshold(habitCount: number): number {
  return Math.max(1, Math.ceil(habitCount * 0.75));
}

/** Number of currently-active habits checked in a log. */
export function countCheckedHabits(log: DailyLog, habits?: HabitDef[]): number {
  const list = habits ?? getHabits();
  return list.reduce((n, h) => (log.habits[h.id] ? n + 1 : n), 0);
}

export function currentStreak(): number {
  const habits = getHabits();
  const threshold = streakThreshold(habits.length);
  let streak = 0;
  const todayStr = getTodayString();
  let cursor = parseISO(todayStr);
  let isToday = true;

  while (true) {
    const dateStr = format(cursor, "yyyy-MM-dd");
    const log = getDailyLog(dateStr);
    const count = log ? countCheckedHabits(log, habits) : 0;

    if (count >= threshold) {
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

  const habits = getHabits();
  const threshold = streakThreshold(habits.length);
  let best = 0;
  let current = 0;
  let prevDate: Date | null = null;

  for (const log of logs) {
    const date = parseISO(log.date);
    const count = countCheckedHabits(log, habits);

    if (count >= threshold) {
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
  habitCheckins: number;
}

export function monthStats(monthDate: Date): MonthStats {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const todayStr = getTodayString();
  const today = parseISO(todayStr);
  const cappedEnd = isBefore(today, end) ? today : end;
  const habits = getHabits();

  const logs = getDateRange(
    format(start, "yyyy-MM-dd"),
    format(cappedEnd, "yyyy-MM-dd"),
  );

  return {
    miles: round1(logs.reduce((sum, l) => sum + (l.runMiles || 0), 0)),
    coldCalls: logs.reduce((sum, l) => sum + (l.coldCalls || 0), 0),
    habitCheckins: logs.reduce((sum, l) => sum + countCheckedHabits(l, habits), 0),
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
