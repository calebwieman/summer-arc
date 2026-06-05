import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import { getDateRange, getHabits, getWeeklyReview } from "./storage";
import { isHabitScheduled } from "./today";
import type { HabitDef, WeeklyReview } from "./types";

export interface WeekStats {
  miles: number;
  coldCallsTotal: number;
  coldCallsPerWeekday: number;
  avgSleepHours: number;
  habitCompletion: Record<string, number>;
  /** Per-habit scheduled-day count this week. */
  habitScheduled: Record<string, number>;
}

export interface WeekSummary extends WeekStats {
  habits: HabitDef[];
  prev: WeekStats;
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

function computeWeekStats(weekStart: Date, habits: HabitDef[]): WeekStats {
  const end = weekEndOf(weekStart);
  const logs = getDateRange(
    format(weekStart, "yyyy-MM-dd"),
    format(end, "yyyy-MM-dd"),
  );

  let miles = 0;
  let coldCallsTotal = 0;
  let weekdayColdCalls = 0;
  const sleeps: number[] = [];
  const habitCompletion: Record<string, number> = {};
  const habitScheduled: Record<string, number> = {};
  for (const habit of habits) {
    habitCompletion[habit.id] = 0;
    habitScheduled[habit.id] = 0;
  }

  // Count scheduled days across the whole week regardless of whether a log exists.
  for (let d = 0; d < 7; d++) {
    const day = addDays(weekStart, d);
    const dow = day.getDay();
    for (const habit of habits) {
      if (isHabitScheduled(habit, dow)) habitScheduled[habit.id]++;
    }
  }

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
    habitCompletion,
    habitScheduled,
  };
}

export function summarizeWeek(weekStart: Date): WeekSummary {
  const habits = getHabits();
  const current = computeWeekStats(weekStart, habits);
  const prev = computeWeekStats(subDays(weekStart, 7), habits);
  return {
    ...current,
    habits,
    prev,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Build a clean markdown block for the given week. */
export function weekToMarkdown(weekStart: Date): string {
  const summary = summarizeWeek(weekStart);
  const end = weekEndOf(weekStart);
  const review = getWeeklyReview(format(weekStart, "yyyy-MM-dd"));
  const logs = getDateRange(
    format(weekStart, "yyyy-MM-dd"),
    format(end, "yyyy-MM-dd"),
  );

  const lines: string[] = [];
  lines.push(`# Week of ${formatWeekRange(weekStart)}`);
  lines.push("");
  lines.push("## Numbers");
  lines.push(`- Miles: ${summary.miles}`);
  lines.push(
    `- Cold calls: ${summary.coldCallsTotal} (${summary.coldCallsPerWeekday}/weekday)`,
  );
  lines.push(`- Avg sleep: ${summary.avgSleepHours}h`);
  lines.push("");
  lines.push("## Habits");
  for (const habit of summary.habits) {
    const target = summary.habitScheduled[habit.id] || 7;
    lines.push(
      `- ${habit.label}: ${summary.habitCompletion[habit.id] ?? 0}/${target}`,
    );
  }
  lines.push("");
  if (logs.length > 0) {
    lines.push("## Daily highlights");
    for (const log of logs) {
      const bits: string[] = [];
      if (log.win.trim()) bits.push(`**Win:** ${log.win.trim()}`);
      if (log.lesson.trim()) bits.push(`**Lesson:** ${log.lesson.trim()}`);
      if (bits.length === 0) continue;
      lines.push(`### ${format(parseISO(log.date), "EEE, MMM d")}`);
      for (const b of bits) lines.push(b);
      lines.push("");
    }
  }
  if (review) {
    lines.push("## Reflection");
    if (review.biggestWin.trim()) {
      lines.push(`**Biggest win:** ${review.biggestWin.trim()}`);
    }
    if (review.biggestLesson.trim()) {
      lines.push(`**Biggest lesson:** ${review.biggestLesson.trim()}`);
    }
    if (review.changeNextWeek.trim()) {
      lines.push(`**Change next week:** ${review.changeNextWeek.trim()}`);
    }
  }
  return lines.join("\n").trim() + "\n";
}
