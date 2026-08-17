import { format } from "date-fns";
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

/** Every habit key, in the order they come up in a day. */
export const HABIT_KEYS: HabitKey[] = [
  "wake",
  "phoneOff",
  "training",
  "deepWork",
  "lightsOut",
];

export const HABIT_LABELS: Record<HabitKey, string> = {
  wake: "Wake 04:45",
  phoneOff: "Phone off till Quiet Time",
  training: "Training",
  deepWork: "Deep Work",
  lightsOut: "Lights out",
};

export function makeEmptyLog(date: string): DailyLog {
  return {
    date,
    habits: {
      wake: false,
      phoneOff: false,
      training: false,
      deepWork: false,
      lightsOut: false,
    },
    deepWorkMinutes: 0,
    trainingNote: "",
    contentShipped: false,
    note: "",
    stamps: {},
  };
}
