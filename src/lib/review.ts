import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import { getDateRange } from "./storage";
import type { DailyHabits, WeeklyReview } from "./types";

export interface WeekSummary {
  miles: number;
  amLifts: number;
  pmLifts: number;
  coldCallsTotal: number;
  coldCallsPerWeekday: number;
  plunges: number;
  bibleAm: number;
  biblePm: number;
  avgSleepHours: number;
  habitCompletion: Record<keyof DailyHabits, number>;
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

const ZERO_HABIT_COUNTS: Record<keyof DailyHabits, number> = {
  run: 0,
  amLift: 0,
  plunge: 0,
  bibleAm: 0,
  noPhoneBeforeBible: 0,
  pmLift: 0,
  bibleEvening: 0,
  sleepBy10: 0,
};

export function summarizeWeek(weekStart: Date): WeekSummary {
  const end = weekEndOf(weekStart);
  const logs = getDateRange(
    format(weekStart, "yyyy-MM-dd"),
    format(end, "yyyy-MM-dd"),
  );

  let miles = 0;
  let amLifts = 0;
  let pmLifts = 0;
  let coldCallsTotal = 0;
  let weekdayColdCalls = 0;
  let plunges = 0;
  let bibleAm = 0;
  let biblePm = 0;
  const sleeps: number[] = [];
  const habitCompletion: Record<keyof DailyHabits, number> = {
    ...ZERO_HABIT_COUNTS,
  };

  for (const log of logs) {
    miles += log.runMiles || 0;
    coldCallsTotal += log.coldCalls || 0;

    const dow = getDay(parseISO(log.date));
    if (dow >= 1 && dow <= 5) {
      weekdayColdCalls += log.coldCalls || 0;
    }

    if (log.habits.amLift) amLifts++;
    if (log.habits.pmLift) pmLifts++;
    if (log.habits.plunge) plunges++;
    if (log.habits.bibleAm) bibleAm++;
    if (log.habits.bibleEvening) biblePm++;

    if (log.sleepHours > 0) sleeps.push(log.sleepHours);

    (Object.keys(habitCompletion) as Array<keyof DailyHabits>).forEach((k) => {
      if (log.habits[k]) habitCompletion[k]++;
    });
  }

  const avgSleepHours =
    sleeps.length === 0
      ? 0
      : round1(sleeps.reduce((s, h) => s + h, 0) / sleeps.length);

  return {
    miles: round1(miles),
    amLifts,
    pmLifts,
    coldCallsTotal,
    coldCallsPerWeekday: round1(weekdayColdCalls / 5),
    plunges,
    bibleAm,
    biblePm,
    avgSleepHours,
    habitCompletion,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
