import {
  endOfMonth,
  format,
  isBefore,
  parseISO,
  startOfMonth,
  subDays,
} from "date-fns";
import { getAllDailyLogs, getDailyLog, getDateRange, getHabits } from "./storage";
import { getTodayString, habitsForDate, isHabitScheduled } from "./today";
import type { DailyLog, HabitDef } from "./types";

/** A day counts toward a streak when ~75% of the day's scheduled habits are done. */
export function streakThreshold(habitCount: number): number {
  return Math.max(1, Math.ceil(habitCount * 0.75));
}

/** Number of currently-active habits checked in a log (scheduled or not). */
export function countCheckedHabits(log: DailyLog, habits?: HabitDef[]): number {
  const list = habits ?? getHabits();
  return list.reduce((n, h) => (log.habits[h.id] ? n + 1 : n), 0);
}

/** Number of habits scheduled for the log's date that were checked. */
export function countScheduledChecked(log: DailyLog, habits?: HabitDef[]): number {
  const list = habits ?? getHabits();
  const dow = parseISO(log.date).getDay();
  return list.reduce(
    (n, h) => (isHabitScheduled(h, dow) && log.habits[h.id] ? n + 1 : n),
    0,
  );
}

export function currentStreak(): number {
  const habits = getHabits();
  let streak = 0;
  const todayStr = getTodayString();
  let cursor = parseISO(todayStr);
  let isToday = true;

  while (true) {
    const dateStr = format(cursor, "yyyy-MM-dd");
    const log = getDailyLog(dateStr);

    if (log?.restDay) {
      // Rest days don't add to the streak, but also don't break it.
      isToday = false;
      cursor = subDays(cursor, 1);
      if (streak > 365) break;
      continue;
    }

    const scheduled = habitsForDate(habits, dateStr);
    const threshold = streakThreshold(scheduled.length);
    const count = log ? countScheduledChecked(log, habits) : 0;

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
  let best = 0;
  let current = 0;
  let prevDate: Date | null = null;

  for (const log of logs) {
    const date = parseISO(log.date);

    if (log.restDay) {
      // Treat rest as continuing prevDate so the chain isn't broken on the next day.
      prevDate = date;
      continue;
    }

    const scheduled = habitsForDate(habits, log.date);
    const threshold = streakThreshold(scheduled.length);
    const count = countScheduledChecked(log, habits);

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

/** Streak for a single habit: consecutive scheduled days where it was checked. */
export function habitStreak(habitId: string): number {
  const habits = getHabits();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return 0;

  let streak = 0;
  const todayStr = getTodayString();
  let cursor = parseISO(todayStr);
  let isToday = true;

  while (true) {
    const dateStr = format(cursor, "yyyy-MM-dd");
    const dow = cursor.getDay();
    const scheduled = isHabitScheduled(habit, dow);
    const log = getDailyLog(dateStr);

    if (!scheduled || log?.restDay) {
      // Skip days the habit isn't scheduled, and rest days.
      isToday = false;
      cursor = subDays(cursor, 1);
      if (streak > 365) break;
      continue;
    }

    const checked = !!log?.habits[habitId];
    if (checked) {
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

/** Records computed across all-time logs (excluding the given date). */
export interface RecordBest {
  runMiles: number;
  coldCalls: number;
  plungeMinutes: number;
  habitsChecked: number;
  longestStreak: number;
}

export function allTimeBestExcluding(excludeDate?: string): RecordBest {
  const logs = getAllDailyLogs();
  const habits = getHabits();
  let runMiles = 0;
  let coldCalls = 0;
  let plungeMinutes = 0;
  let habitsChecked = 0;
  for (const log of logs) {
    if (log.date === excludeDate) continue;
    runMiles = Math.max(runMiles, log.runMiles || 0);
    coldCalls = Math.max(coldCalls, log.coldCalls || 0);
    plungeMinutes = Math.max(plungeMinutes, log.plungeMinutes || 0);
    habitsChecked = Math.max(habitsChecked, countCheckedHabits(log, habits));
  }
  return {
    runMiles,
    coldCalls,
    plungeMinutes,
    habitsChecked,
    longestStreak: bestStreak(),
  };
}

export interface PrFlag {
  kind: "runMiles" | "coldCalls" | "plungeMinutes" | "habitsChecked";
  value: number;
  label: string;
}

/** Return any PR achieved by `log` vs all-time bests excluding the same date. */
export function detectPrs(log: DailyLog): PrFlag[] {
  const best = allTimeBestExcluding(log.date);
  const habits = getHabits();
  const checked = countCheckedHabits(log, habits);
  const prs: PrFlag[] = [];
  if (log.runMiles > 0 && log.runMiles > best.runMiles) {
    prs.push({ kind: "runMiles", value: log.runMiles, label: "Longest run" });
  }
  if (log.coldCalls > 0 && log.coldCalls > best.coldCalls) {
    prs.push({ kind: "coldCalls", value: log.coldCalls, label: "Most cold calls" });
  }
  if (log.plungeMinutes > 0 && log.plungeMinutes > best.plungeMinutes) {
    prs.push({
      kind: "plungeMinutes",
      value: log.plungeMinutes,
      label: "Longest plunge",
    });
  }
  if (checked > 0 && checked > best.habitsChecked) {
    prs.push({ kind: "habitsChecked", value: checked, label: "Most habits in a day" });
  }
  return prs;
}
