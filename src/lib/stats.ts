import { format, parseISO, subDays } from "date-fns";
import { getHabits, isHabitScheduledOn, type HabitDef } from "./habits";
import { getAllDailyLogs, getDailyLog } from "./storage";
import { getTodayString } from "./today";

/**
 * Streaks.
 *
 * The rebuild removed these deliberately — "no streaks anywhere, two
 * consecutive scheduled misses is the only failure signal". They are back by
 * request, and the two ideas coexist rather than replace each other: the
 * seismograph still flags a double miss, and a streak is now shown beside it.
 *
 * Two rules keep a streak honest, and both mirror how the rest of the app
 * scores. Only scheduled days count, so a Sunday with no training block neither
 * extends nor breaks a running streak — it is simply not a day this habit had
 * anything to say about. And today, while still in play, cannot break one: an
 * unthrown habit at 09:00 is not yet a miss, so it is skipped rather than
 * counted against you.
 */

/** How far back any streak walk will go before giving up. */
const MAX_LOOKBACK_DAYS = 800;

function wasDone(date: string, id: string): boolean {
  return getDailyLog(date)?.habits?.[id] === true;
}

/** ISO date of the earliest log, or null when nothing has been logged. */
function earliestLogDate(): string | null {
  const logs = getAllDailyLogs();
  return logs.length > 0 ? logs[0].date : null;
}

/** Scheduled dates for a habit, newest first, back to `since`. */
function scheduledDatesDesc(
  habit: HabitDef,
  from: string,
  since: string,
): string[] {
  const out: string[] = [];
  const start = parseISO(from);
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    const date = format(subDays(start, i), "yyyy-MM-dd");
    if (date < since) break;
    if (isHabitScheduledOn(habit, date)) out.push(date);
  }
  return out;
}

/**
 * Consecutive scheduled days completed, counting back from today.
 * Today is skipped rather than counted as a break while it is still open.
 */
export function currentStreak(habit: HabitDef, today = getTodayString()): number {
  const since = earliestLogDate();
  if (!since) return 0;

  let n = 0;
  for (const date of scheduledDatesDesc(habit, today, since)) {
    const done = wasDone(date, habit.id);
    if (date === today && !done) continue;
    if (!done) break;
    n += 1;
  }
  return n;
}

/** The longest run of completed scheduled days anywhere in the history. */
export function bestStreak(habit: HabitDef, today = getTodayString()): number {
  const since = earliestLogDate();
  if (!since) return 0;

  // Oldest → newest, so a run is just a counter.
  const dates = scheduledDatesDesc(habit, today, since).reverse();
  let best = 0;
  let run = 0;
  for (const date of dates) {
    const done = wasDone(date, habit.id);
    if (date === today && !done) continue;
    if (done) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

export interface HabitStats {
  id: string;
  label: string;
  current: number;
  best: number;
  /** Completed / scheduled across the whole history, as 0–1. */
  lifetimeRate: number;
  doneCount: number;
  scheduledCount: number;
}

export function habitStats(
  habit: HabitDef,
  today = getTodayString(),
): HabitStats {
  const since = earliestLogDate();
  const dates = since ? scheduledDatesDesc(habit, today, since) : [];
  // Today is excluded from the denominator for the same reason it cannot break
  // a streak: it is not over.
  const scored = dates.filter((d) => d !== today);
  const done = scored.filter((d) => wasDone(d, habit.id)).length;
  return {
    id: habit.id,
    label: habit.label,
    current: currentStreak(habit, today),
    best: bestStreak(habit, today),
    lifetimeRate: scored.length === 0 ? 0 : done / scored.length,
    doneCount: done,
    scheduledCount: scored.length,
  };
}

export function allHabitStats(today = getTodayString()): HabitStats[] {
  return getHabits().map((h) => habitStats(h, today));
}

export interface DayScore {
  date: string;
  done: number;
  total: number;
  /** 0–1, or -1 when nothing was scheduled that day. */
  ratio: number;
}

/** Done-vs-scheduled for a single date, using today's registry. */
export function scoreDay(date: string, habits = getHabits()): DayScore {
  const log = getDailyLog(date);
  const scheduled = habits.filter((h) => isHabitScheduledOn(h, date));
  const done = scheduled.filter((h) => log?.habits?.[h.id]).length;
  return {
    date,
    done,
    total: scheduled.length,
    ratio: scheduled.length === 0 ? -1 : done / scheduled.length,
  };
}

export interface OverallStats {
  daysLogged: number;
  firstDate: string | null;
  /** Mean of every completed day's ratio, as 0–1. */
  averageRatio: number;
  /** Days where every scheduled habit was done. */
  perfectDays: number;
}

export function overallStats(today = getTodayString()): OverallStats {
  const logs = getAllDailyLogs().filter((l) => l.date <= today);
  if (logs.length === 0) {
    return { daysLogged: 0, firstDate: null, averageRatio: 0, perfectDays: 0 };
  }
  const habits = getHabits();
  const scores = logs
    .filter((l) => l.date !== today)
    .map((l) => scoreDay(l.date, habits))
    .filter((s) => s.ratio >= 0);

  const perfect = scores.filter((s) => s.done === s.total && s.total > 0).length;
  const mean =
    scores.length === 0
      ? 0
      : scores.reduce((sum, s) => sum + s.ratio, 0) / scores.length;

  return {
    daysLogged: logs.length,
    firstDate: logs[0].date,
    averageRatio: mean,
    perfectDays: perfect,
  };
}
