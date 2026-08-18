import { getAllDailyLogs } from "./storage";
import { isHabitScheduledOn, type HabitDef } from "./habits";
import type { DailyLog, HabitKey } from "./types";

/**
 * Every log, read once.
 *
 * The app is about to grow several derived readings — weekday profile, session
 * rates, weekly training load — and every one of them wants to walk the history
 * asking the same question of the same days. Written the obvious way, each of
 * them calls `getDailyLog` per day per habit, and each of those is a
 * `localStorage.getItem` plus a `JSON.parse` of the whole day. `buildHabitSeries`
 * already does exactly that and it costs about a hundred milliseconds and twelve
 * thousand reads for fourteen days across five habits.
 *
 * So: one pass over storage, one parse per day, and every consumer reads the
 * map. Build it once per (date, dataVersion) and thread it down.
 *
 * The three-state grammar lives here too, because the second failure mode of
 * many derived readings is not slowness but disagreement — one surface counting
 * a day as a miss that another counts as no-data. There is one definition of
 * each state and it is in this file:
 *
 *   done      the habit was thrown that day
 *   missed    it was scheduled, the day is over, and it was not thrown
 *   no data   it was not scheduled, or the day is marked `noData` for it, or
 *             the day is before anything was ever logged, or it is today
 *
 * No-data is not a miss and never enters a denominator. That rule is what makes
 * a rest day a rest day and a restored backup honest about what it does not
 * know.
 */
export interface LogIndex {
  byDate: Map<string, DailyLog>;
  /** Every logged date, ascending. */
  dates: string[];
  /** The earliest logged date, or null when nothing has been logged. */
  first: string | null;
}

export function buildLogIndex(): LogIndex {
  const logs = getAllDailyLogs();
  const byDate = new Map<string, DailyLog>();
  for (const l of logs) byDate.set(l.date, l);
  return {
    byDate,
    dates: logs.map((l) => l.date),
    first: logs.length > 0 ? logs[0].date : null,
  };
}

/** Empty index, for the first render before anything has been read. */
export const EMPTY_INDEX: LogIndex = {
  byDate: new Map(),
  dates: [],
  first: null,
};

export type DayState = "done" | "missed" | "none";

/**
 * What this day says about this habit. The single definition — every derived
 * reading in the app goes through here so they cannot drift apart.
 */
export function stateOf(
  ix: LogIndex,
  habit: HabitDef,
  date: string,
  today: string,
): DayState {
  if (!isHabitScheduledOn(habit, date)) return "none";
  // Before the first log there is nothing to know; drawing a miss would invent
  // a failure that never happened.
  if (ix.first == null || date < ix.first) return "none";
  const log = ix.byDate.get(date);
  if (log?.noData?.includes(habit.id)) return "none";
  if (log?.habits?.[habit.id] === true) return "done";
  // Today is still in play: an unthrown habit at 09:00 is not yet a miss.
  if (date >= today) return "none";
  return "missed";
}

/** Done over scheduled across a set of dates, or null when nothing counted. */
export function rateOver(
  ix: LogIndex,
  habit: HabitDef,
  dates: string[],
  today: string,
): { done: number; scheduled: number; rate: number | null } {
  let done = 0;
  let scheduled = 0;
  for (const d of dates) {
    const s = stateOf(ix, habit, d, today);
    if (s === "none") continue;
    scheduled += 1;
    if (s === "done") done += 1;
  }
  return { done, scheduled, rate: scheduled === 0 ? null : done / scheduled };
}

/** The habits thrown on a date, whatever their schedule says. */
export function thrownOn(ix: LogIndex, date: string): HabitKey[] {
  const log = ix.byDate.get(date);
  if (!log?.habits) return [];
  return Object.entries(log.habits)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
}
