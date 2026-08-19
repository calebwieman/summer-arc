import { format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { buildLogIndex } from "./log-index";
import { formatPace } from "./clock";

/**
 * The run log as chartable series.
 *
 * Two questions, two shapes: how much am I running (weekly mileage, a magnitude
 * over time) and how fast (pace per run, a trend). Different scales, so they
 * are two charts — never one chart with two axes.
 */

export interface RunPoint {
  date: string;
  /** "Tue 8/12" — the readout line, not an axis label. */
  label: string;
  miles: number;
  minutes: number;
  /** "7:35", or null when only distance was logged. */
  pace: string | null;
  /** Minutes per mile for scaling; null without a time. */
  paceMin: number | null;
}

export interface WeekBar {
  /** ISO date of the Monday. */
  start: string;
  /** "8/11" */
  label: string;
  miles: number;
  isCurrent: boolean;
}

export interface RunHistory {
  /** Ascending by date; only days with distance logged. Capped at `maxRuns`. */
  runs: RunPoint[];
  /** Oldest → current week, always exactly `weeksBack` long. */
  weeks: WeekBar[];
  latest: RunPoint | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function runHistory(
  today: string,
  weeksBack = 8,
  maxRuns = 14,
): RunHistory {
  const ix = buildLogIndex();

  const all: RunPoint[] = [];
  for (const [date, log] of ix.byDate) {
    const miles = log.runMiles ?? 0;
    if (!(miles > 0) || date > today) continue;
    const minutes = log.runMinutes ?? 0;
    all.push({
      date,
      label: format(parseISO(date), "EEE M/d"),
      miles,
      minutes,
      pace: formatPace(miles, minutes),
      paceMin: miles > 0 && minutes > 0 ? minutes / miles : null,
    });
  }
  all.sort((a, b) => a.date.localeCompare(b.date));

  const mondayOf = (d: string) =>
    format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const byWeek = new Map<string, number>();
  for (const r of all) {
    const wk = mondayOf(r.date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + r.miles);
  }

  // A fixed window ending on the current week, zero-filled: an empty week is a
  // fact about the training, not a gap in the chart.
  const currentMonday = mondayOf(today);
  const weeks: WeekBar[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const start = format(subWeeks(parseISO(currentMonday), i), "yyyy-MM-dd");
    weeks.push({
      start,
      label: format(parseISO(start), "M/d"),
      miles: round1(byWeek.get(start) ?? 0),
      isCurrent: start === currentMonday,
    });
  }

  const runs = all.slice(-maxRuns);
  return { runs, weeks, latest: runs[runs.length - 1] ?? null };
}
