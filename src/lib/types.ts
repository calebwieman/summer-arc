/**
 * A habit's stable id, and the key it occupies inside `DailyLog.habits`.
 *
 * This was a closed union of the five habits the app shipped with. It is open
 * now that habits are user-defined; the five original ids still exist as the
 * seeded registry in `lib/habits.ts`, so every log ever written keeps scoring
 * without a migration. Definitions live in the registry, never here — this
 * file describes what a *day* records, not what a habit is.
 */
export type HabitKey = string;

export interface DailyLog {
  /** YYYY-MM-DD */
  date: string;
  /**
   * Habit id → done. Sparse: an absent key is "not done", which is what lets a
   * habit be added later without rewriting the days that predate it.
   */
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
  /**
   * The run, as numbers rather than prose.
   *
   * `trainingNote` stays for what a sentence is good at ("legs felt flat, hot")
   * — but distance and time are the two things worth charting, and free text
   * cannot be charted. Both optional: a day with no run simply has neither, and
   * every reader treats absent as "did not run" rather than zero.
   */
  runMiles?: number;
  /** Total elapsed minutes, so pace is derivable and never stored twice. */
  runMinutes?: number;
}
