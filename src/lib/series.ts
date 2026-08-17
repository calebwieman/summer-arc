import { format, parseISO, subDays } from "date-fns";
import { isHabitScheduled } from "./schedule";
import { getAllDailyLogs, getDailyLog, hasMissedTwice } from "./storage";
import { HABIT_KEYS, HABIT_LABELS, getTodayString } from "./today";
import type { HabitKey } from "./types";

export interface HabitDaySample {
  date: string;
  /** Weekday initial for the axis. */
  dow: string;
  scheduled: boolean;
  done: boolean;
  /** Today is still in progress — never drawn as a miss. */
  isToday: boolean;
  /** Before anything was ever logged — no data, not a miss. */
  preAdoption: boolean;
  /** Scheduled, complete, and after adoption: the days that actually score. */
  counted: boolean;
}

export interface HabitSeries {
  key: HabitKey;
  label: string;
  /** Oldest → newest, length `days`, ending on `today`. */
  samples: HabitDaySample[];
  doneCount: number;
  scheduledCount: number;
  /** doneCount / scheduledCount — the SAME window as the fraction, always. */
  rate: number;
  missedTwice: boolean;
  /** Indices into `samples` of the current consecutive-miss run (length ≥ 2). */
  flagRun: number[];
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Build the 14-day picture per habit.
 *
 * Two rules keep this honest. Days before the first-ever log are `preAdoption`
 * and are drawn as no-data, never as misses — otherwise a fresh install renders
 * a fortnight of fabricated failure. And the percentage is derived from the
 * very same counted set as the fraction, so the two can never disagree on screen.
 */
export function buildHabitSeries(
  days = 14,
  today = getTodayString(),
): HabitSeries[] {
  const end = parseISO(today);
  const all = getAllDailyLogs();
  const since = all.length > 0 ? all[0].date : null;

  // Read each day once, not once per habit.
  const window: { date: string; dow: string; done: Record<string, boolean> }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(end, i);
    const date = format(d, "yyyy-MM-dd");
    window.push({
      date,
      dow: DOW[d.getDay()],
      done: (getDailyLog(date)?.habits ?? {}) as Record<string, boolean>,
    });
  }

  return HABIT_KEYS.map((key) => {
    const samples: HabitDaySample[] = window.map((w) => {
      const scheduled = isHabitScheduled(key, w.date);
      const isToday = w.date === today;
      const preAdoption = since == null || w.date < since;
      return {
        date: w.date,
        dow: w.dow,
        scheduled,
        done: w.done[key] === true,
        isToday,
        preAdoption,
        counted: scheduled && !isToday && !preAdoption,
      };
    });

    const counted = samples.filter((s) => s.counted);
    const doneCount = counted.filter((s) => s.done).length;

    // Trailing run of consecutive misses, over counted days only.
    const flagRun: number[] = [];
    for (let i = samples.length - 1; i >= 0; i--) {
      const s = samples[i];
      if (!s.counted) continue;
      if (s.done) break;
      flagRun.unshift(i);
    }

    return {
      key,
      label: HABIT_LABELS[key],
      samples,
      doneCount,
      scheduledCount: counted.length,
      rate: counted.length === 0 ? 0 : doneCount / counted.length,
      missedTwice: hasMissedTwice(key),
      flagRun: flagRun.length >= 2 ? flagRun : [],
    };
  });
}
