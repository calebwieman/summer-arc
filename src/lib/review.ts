import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import { getDateRange, getHabits } from "./storage";
import type { HabitDef, WeeklyReview } from "./types";

export interface WeekSummary {
  miles: number;
  coldCallsTotal: number;
  coldCallsPerWeekday: number;
  avgSleepHours: number;
  habits: HabitDef[];
  /** Completion count per habit id, out of the days logged that week. */
  habitCompletion: Record<string, number>;
}

export function thisWeekStart(today: Date): Date {
  return startOfWeek(today, { weekStartsOn: 1 });
}

export function mostRecentCompletedWeekStart(today: Date): Date {
  return subDays(thisWeekStart(today), 7);
}

export function weekEndOf(weekStart: Date): Date {
  return addDays(weekStart, 6);
}

export function formatWeekRange(weekStart: Date): string {
  const end = weekEndOf(weekStart);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const startLabel = format(weekStart, sameMonth ? "MMM d" : "MMM d");
  const endLabel = format(end, sameMonth ? "d" : "MMM d");
  return `${startLabel} – ${endLabel}, ${format(end, "yyyy")}`;
}

export function isWeekLocked(weekStart: Date, today: Date): boolean {
  const end = weekEndOf(weekStart);
  return differenceInCalendarDays(today, end) > 14;
}

export function makeEmptyReview(weekStart: string): WeeklyReview {
  return {
    weekStart,
    biggestWin: "",
    biggestLesson: "",
    changeNextWeek: "",
  };
}

export function summarizeWeek(weekStart: Date): WeekSummary {
  const end = weekEndOf(weekStart);
  const logs = getDateRange(
    format(weekStart, "yyyy-MM-dd"),
    format(end, "yyyy-MM-dd"),
  );
  const habits = getHabits();

  let miles = 0;
  let coldCallsTotal = 0;
  let weekdayColdCalls = 0;
  const sleeps: number[] = [];
  const habitCompletion: Record<string, number> = {};
  for (const habit of habits) habitCompletion[habit.id] = 0;

  for (const log of logs) {
    miles += log.runMiles || 0;
    coldCallsTotal += log.coldCalls || 0;

    const dow = getDay(parseISO(log.date));
    if (dow >= 1 && dow <= 5) {
      weekdayColdCalls += log.coldCalls || 0;
    }

    if (log.sleepHours > 0) sleeps.push(log.sleepHours);

    for (const habit of habits) {
      if (log.habits[habit.id]) habitCompletion[habit.id]++;
    }
  }

  const avgSleepHours =
    sleeps.length === 0
      ? 0
      : round1(sleeps.reduce((s, h) => s + h, 0) / sleeps.length);

  return {
    miles: round1(miles),
    coldCallsTotal,
    coldCallsPerWeekday: round1(weekdayColdCalls / 5),
    avgSleepHours,
    habits,
    habitCompletion,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
