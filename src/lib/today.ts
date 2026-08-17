import { format } from "date-fns";
import { getHabits } from "./habits";
import type { DailyLog, HabitKey } from "./types";

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
 * Every live habit id, in display order.
 *
 * This was a hardcoded array beside a hardcoded label map. Both are now derived
 * from the registry, because the set is user-defined — a static list would go
 * stale the moment a habit is added, and a static label map would render the
 * raw id for anything the user created.
 */
export function habitKeys(): HabitKey[] {
  return getHabits().map((h) => h.id);
}

/**
 * A blank day. `habits` is deliberately empty rather than every id set false:
 * absent means "not done", so a habit invented next month does not have to be
 * back-written into every day that came before it.
 */
export function makeEmptyLog(date: string): DailyLog {
  return {
    date,
    habits: {},
    deepWorkMinutes: 0,
    trainingNote: "",
    contentShipped: false,
    note: "",
    stamps: {},
  };
}
