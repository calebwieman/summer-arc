/** A user-defined habit. `id` is stable and used as the key in DailyLog.habits. */
export interface HabitDef {
  id: string;
  label: string;
}

/** Completion map keyed by HabitDef.id. */
export type DailyHabits = Record<string, boolean>;

export interface DailyLog {
  date: string;
  habits: DailyHabits;
  coldCalls: number;
  runMiles: number;
  runNotes: string;
  amLiftNotes: string;
  pmLiftNotes: string;
  plungeMinutes: number;
  sleepHours: number;
  win: string;
  lesson: string;
  top3Priorities: [string, string, string];
}

export interface WeeklyReview {
  weekStart: string;
  biggestWin: string;
  biggestLesson: string;
  changeNextWeek: string;
}
