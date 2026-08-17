/**
 * The five tracked habits. This union is closed on purpose — habits are no
 * longer user-editable, and every one of them is anchored to a block in
 * `lib/schedule.ts`.
 */
export type HabitKey =
  | "lightsOut"
  | "wake"
  | "phoneOff"
  | "deepWork"
  | "training";

export interface DailyLog {
  /** YYYY-MM-DD */
  date: string;
  habits: Record<HabitKey, boolean>;
  deepWorkMinutes: number;
  trainingNote: string;
  contentShipped: boolean;
  note: string;
  /**
   * Minute-of-day each habit was committed. Additive and optional — the shape
   * above is unchanged, and every reader treats a missing stamp as unknown.
   * Powers the "done 04:52" receipt and, over time, wake-time drift.
   */
  stamps?: Partial<Record<HabitKey, number>>;
  /**
   * Habits that cannot be scored for this day because no source for them
   * exists — set when restoring a backup from a version that never tracked
   * them. The record draws these as no-data, never as a miss.
   */
  noData?: HabitKey[];
}
