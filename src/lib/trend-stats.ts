import { format, parseISO, startOfWeek, subDays, subWeeks } from "date-fns";
import { buildLogIndex } from "./log-index";

/**
 * The rest of the log as chartable series: when the day actually started, how
 * much deep work each week held, and whether content went out. The run already
 * has its own module; these three complete "visualize everything".
 */

export interface StampPoint {
  date: string;
  /** "Tue 8/12" — the readout line. */
  label: string;
  /** Minute-of-day the habit was committed. */
  minute: number;
}

export interface WeekMinutes {
  /** ISO date of the Monday. */
  start: string;
  /** "8/11" */
  label: string;
  minutes: number;
  isCurrent: boolean;
}

export interface ShipDay {
  date: string;
  dow: string;
  shipped: boolean;
  isToday: boolean;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * When a habit was actually thrown, day by day. Built for the wake stamp —
 * watching 4:47 creep toward 5:20 is the point — but any stamped habit works.
 */
export function stampSeries(
  today: string,
  habitId: string,
  days = 21,
): StampPoint[] {
  const ix = buildLogIndex();
  const out: StampPoint[] = [];
  const end = parseISO(today);
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(end, i);
    const date = format(d, "yyyy-MM-dd");
    const minute = ix.byDate.get(date)?.stamps?.[habitId];
    if (typeof minute !== "number") continue;
    out.push({ date, label: format(d, "EEE M/d"), minute });
  }
  return out;
}

/** Deep-work minutes summed per Monday-anchored week, zero-filled. */
export function deepWeeks(today: string, weeksBack = 8): WeekMinutes[] {
  const ix = buildLogIndex();
  const mondayOf = (d: string) =>
    format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const byWeek = new Map<string, number>();
  for (const [date, log] of ix.byDate) {
    const mins = log.deepWorkMinutes ?? 0;
    if (!(mins > 0) || date > today) continue;
    const wk = mondayOf(date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + mins);
  }

  const currentMonday = mondayOf(today);
  const out: WeekMinutes[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const start = format(subWeeks(parseISO(currentMonday), i), "yyyy-MM-dd");
    out.push({
      start,
      label: format(parseISO(start), "M/d"),
      minutes: byWeek.get(start) ?? 0,
      isCurrent: start === currentMonday,
    });
  }
  return out;
}

/** The last `days` of contentShipped, oldest first. */
export function contentSeries(today: string, days = 14): ShipDay[] {
  const ix = buildLogIndex();
  const end = parseISO(today);
  const out: ShipDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(end, i);
    const date = format(d, "yyyy-MM-dd");
    out.push({
      date,
      dow: DOW[d.getDay()],
      shipped: ix.byDate.get(date)?.contentShipped === true,
      isToday: date === today,
    });
  }
  return out;
}

/** 95 -> "1h35", 60 -> "1h", 45 -> "45m" — column captions stay short. */
export function formatHours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
