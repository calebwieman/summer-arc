import { format } from "date-fns";
import type { DailyHabits, DailyLog, HabitDef } from "./types";

export function getTodayString(): string {
  return format(new Date(), "yyyy-MM-dd");
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
