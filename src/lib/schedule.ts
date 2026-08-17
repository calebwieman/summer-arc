import type { HabitKey } from "./types";

/**
 * Static weekly template. No calendar API — this file is the single source of
 * truth for what the day is supposed to look like.
 *
 * All times are literal Central wall-clock ("HH:mm", 24h). The app assumes the
 * device is in Central; nothing here converts time zones.
 *
 * End times: where a duration was given it is used verbatim (the 60-minute
 * run). Classes use the standard OU pattern — 50 minutes on MWF, 75 on TR.
 * Everything else runs until the next block starts, except where that would
 * stretch a block past ~2h of dead air (weekend mornings), which instead get a
 * sensible fixed length and leave the remainder unscheduled.
 */

export type BlockKind = "training" | "class" | "work" | "personal" | "rest";

export interface Block {
  /** HH:mm, 24-hour, Central. */
  start: string;
  /** HH:mm, 24-hour, Central. */
  end: string;
  label: string;
  kind: BlockKind;
  /** When set, checking this habit is anchored to this block. */
  habit?: HabitKey;
}

/** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const WAKE: Block = {
  start: "04:45",
  end: "05:00",
  label: "Wake",
  kind: "personal",
  habit: "wake",
};

const WIND_DOWN: Block = {
  start: "21:15",
  end: "22:00",
  label: "Wind Down",
  kind: "rest",
  habit: "lightsOut",
};

/** Mon / Wed / Fri, everything up to the evening. */
const MWF_DAY: Block[] = [
  WAKE,
  { start: "05:00", end: "06:00", label: "Run", kind: "training", habit: "training" },
  { start: "06:20", end: "07:00", label: "Quiet Time", kind: "personal", habit: "phoneOff" },
  { start: "07:00", end: "07:30", label: "Breakfast", kind: "personal" },
  { start: "07:30", end: "09:00", label: "Admin", kind: "work" },
  { start: "09:00", end: "09:50", label: "ENGL 1213", kind: "class" },
  { start: "10:00", end: "12:20", label: "Deep Work", kind: "work", habit: "deepWork" },
  { start: "12:20", end: "13:00", label: "Lunch", kind: "personal" },
  { start: "13:00", end: "13:50", label: "FMS 1013", kind: "class" },
  { start: "15:00", end: "15:50", label: "SPAN 1115", kind: "class" },
  { start: "16:30", end: "17:30", label: "Content", kind: "work" },
  { start: "17:30", end: "18:30", label: "Dinner", kind: "personal" },
];

/** Mon / Fri evening. */
const MF_EVENING: Block[] = [
  { start: "18:30", end: "21:15", label: "Build Block", kind: "work" },
  WIND_DOWN,
];

/** Wednesday evening — Build Block is cut short for BCM. */
const WED_EVENING: Block[] = [
  { start: "18:30", end: "20:00", label: "Build Block", kind: "work" },
  { start: "20:30", end: "21:15", label: "BCM Renown", kind: "personal" },
  WIND_DOWN,
];

/** Tue / Thu. */
const TR_DAY: Block[] = [
  WAKE,
  { start: "05:30", end: "07:15", label: "NSC Session", kind: "training", habit: "training" },
  { start: "07:15", end: "07:45", label: "Quiet Time", kind: "personal", habit: "phoneOff" },
  { start: "07:45", end: "10:30", label: "Deep Work", kind: "work", habit: "deepWork" },
  { start: "10:30", end: "11:45", label: "POLY 1003", kind: "class" },
  { start: "11:50", end: "12:15", label: "Lunch", kind: "personal" },
  // Second Deep Work block of the day — the habit is anchored to the first only.
  { start: "12:15", end: "15:00", label: "Deep Work", kind: "work" },
  { start: "15:00", end: "16:15", label: "SPAN 1115", kind: "class" },
  { start: "18:30", end: "21:15", label: "Build Block", kind: "work" },
  WIND_DOWN,
];

const SATURDAY: Block[] = [
  WAKE,
  { start: "06:20", end: "07:30", label: "Quiet Time", kind: "personal", habit: "phoneOff" },
  { start: "09:00", end: "11:00", label: "Long Run", kind: "training", habit: "training" },
  { start: "12:00", end: "14:00", label: "Content", kind: "work" },
  WIND_DOWN,
];

const SUNDAY: Block[] = [
  WAKE,
  { start: "06:20", end: "07:30", label: "Quiet Time", kind: "personal", habit: "phoneOff" },
  { start: "09:30", end: "11:30", label: "Church", kind: "personal" },
  { start: "14:00", end: "15:30", label: "Weekly Reset", kind: "personal" },
  { start: "19:00", end: "21:00", label: "Study", kind: "work" },
  WIND_DOWN,
];

/** The weekly template, keyed by `Date.prototype.getDay()`. */
export const WEEKLY_SCHEDULE: Record<Weekday, Block[]> = {
  0: SUNDAY,
  1: [...MWF_DAY, ...MF_EVENING],
  2: TR_DAY,
  3: [...MWF_DAY, ...WED_EVENING],
  4: TR_DAY,
  5: [...MWF_DAY, ...MF_EVENING],
  6: SATURDAY,
};

/** Parse "YYYY-MM-DD" as a local date, avoiding the UTC shift of `new Date(str)`. */
function localDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekdayOf(date: string): Weekday {
  return localDate(date).getDay() as Weekday;
}

/** Every block scheduled for the given ISO date, in start order. */
export function blocksForDate(date: string): Block[] {
  return WEEKLY_SCHEDULE[weekdayOf(date)];
}

/**
 * The block a habit is anchored to on a given date, if any.
 * `deepWork` resolves to the first Deep Work block of the day.
 */
export function blockForHabit(habit: HabitKey, date: string): Block | undefined {
  return blocksForDate(date).find((b) => b.habit === habit);
}

/**
 * True when the habit has a block on this date. Rest days are real — `training`
 * is not scheduled on Sunday and `deepWork` is not scheduled on weekends, so
 * neither should count as a miss there.
 */
export function isHabitScheduled(habit: HabitKey, date: string): boolean {
  return blockForHabit(habit, date) !== undefined;
}

/** Every habit anchored on the given date, in block order. */
export function habitsForDate(date: string): HabitKey[] {
  return blocksForDate(date)
    .map((b) => b.habit)
    .filter((h): h is HabitKey => h !== undefined);
}

/** Minutes since midnight for an "HH:mm" string. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** The block containing `time` ("HH:mm") on the given date, if any. */
export function blockAt(date: string, time: string): Block | undefined {
  const mins = toMinutes(time);
  return blocksForDate(date).find(
    (b) => mins >= toMinutes(b.start) && mins < toMinutes(b.end),
  );
}
