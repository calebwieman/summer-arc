import { format, parseISO } from "date-fns";
import type { DailyHabits, DailyLog, HabitDef } from "./types";

export function getTodayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return format(d, "yyyy-MM-dd");
}

export function formatHeaderDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return format(new Date(year, month - 1, day), "EEEE, MMMM d");
}

/**
 * Default habit set. IDs intentionally match the original fixed keys so that
 * any logs saved before habits became editable continue to read correctly.
 */
export const DEFAULT_HABITS: HabitDef[] = [
  { id: "run", label: "Morning run" },
  { id: "amLift", label: "AM lift" },
  { id: "plunge", label: "Cold plunge" },
  { id: "bibleAm", label: "Bible (AM)" },
  { id: "noPhoneBeforeBible", label: "No phone before Bible" },
  { id: "pmLift", label: "PM lift" },
  { id: "bibleEvening", label: "Bible (PM)" },
  { id: "sleepBy10", label: "Sleep by 10" },
];

export function createHabitId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `h_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** True when a habit is scheduled for the given weekday (0=Sun..6=Sat). */
export function isHabitScheduled(habit: HabitDef, weekday: number): boolean {
  if (!habit.weekdays || habit.weekdays.length === 0) return true;
  return habit.weekdays.includes(weekday);
}

/** Filter the habit list down to those scheduled for the given ISO date. */
export function habitsForDate(habits: HabitDef[], date: string): HabitDef[] {
  const dow = parseISO(date).getDay();
  return habits.filter((h) => isHabitScheduled(h, dow));
}

function emptyHabits(habits: HabitDef[]): DailyHabits {
  const map: DailyHabits = {};
  for (const habit of habits) map[habit.id] = false;
  return map;
}

export function makeEmptyLog(date: string, habits: HabitDef[] = DEFAULT_HABITS): DailyLog {
  return {
    date,
    habits: emptyHabits(habits),
    coldCalls: 0,
    runMiles: 0,
    runNotes: "",
    amLiftNotes: "",
    pmLiftNotes: "",
    plungeMinutes: 0,
    sleepHours: 0,
    win: "",
    lesson: "",
    top3Priorities: ["", "", ""],
  };
}
