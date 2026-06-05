/** A user-defined habit. `id` is stable and used as the key in DailyLog.habits. */
export interface HabitDef {
  id: string;
  label: string;
  /**
   * Weekdays this habit is scheduled (0=Sun..6=Sat). Undefined or empty = every day.
   * Days outside the schedule don't show on Today and don't count against streaks.
   */
  weekdays?: number[];
  /** Target completions per week. Undefined = no target (display as "every day"). */
  weeklyTarget?: number;
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
  /** 1–5 self-rated mood/energy. 0 or undefined = unset. */
  mood?: number;
  /** Free-text Bible reading (e.g. "John 3", "Psalm 23, Prov 4"). */
  bibleReading?: string;
  /** Rest day marker: streak continues but the day isn't required to be filled. */
  restDay?: boolean;
  /** Compressed base64 photo data URL (~50KB target). */
  photoDataUrl?: string;
}

export interface WeeklyReview {
  weekStart: string;
  biggestWin: string;
  biggestLesson: string;
  changeNextWeek: string;
}
