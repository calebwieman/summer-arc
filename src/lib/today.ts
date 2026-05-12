import { format } from "date-fns";
import type { DailyLog, DailyHabits } from "./types";

export function getTodayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatHeaderDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return format(new Date(year, month - 1, day), "EEEE, MMMM d");
}

export const HABIT_ORDER: Array<{ key: keyof DailyHabits; label: string }> = [
  { key: "run", label: "Morning run" },
  { key: "amLift", label: "AM lift" },
  { key: "plunge", label: "Cold plunge" },
  { key: "bibleAm", label: "Bible (AM)" },
  { key: "noPhoneBeforeBible", label: "No phone before Bible" },
  { key: "pmLift", label: "PM lift" },
  { key: "bibleEvening", label: "Bible (PM)" },
  { key: "sleepBy10", label: "Sleep by 10" },
];

export function makeEmptyLog(date: string): DailyLog {
  return {
    date,
    habits: {
      run: false,
      amLift: false,
      plunge: false,
      bibleAm: false,
      noPhoneBeforeBible: false,
      pmLift: false,
      bibleEvening: false,
      sleepBy10: false,
    },
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
