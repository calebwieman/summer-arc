/**
 * Static weekly template. No calendar API — this file is the single source of
 * truth for what the day is supposed to look like, training included.
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
  /**
   * What this block is actually for, in one line, shown on the focus card.
   * Training uses it to carry the session so the app tells you what today is
   * rather than waiting for you to remember it.
   */
  brief?: string;
}

/** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const WAKE: Block = {
  start: "04:45",
  end: "05:00",
  label: "Wake",
  kind: "personal",
};

const WIND_DOWN: Block = {
  start: "21:15",
  end: "22:00",
  label: "Wind Down",
  kind: "rest",
};

/*
  The training week, built for Hyrox with no race booked — so it is a base and
  build week, not a sharpening one, and the shape matters more than any single
  session.

  The race is eight 1km runs with a station between each, which is why running
  gets three days and two of them are aerobic: the limiter for almost everyone
  is not the stations, it is running at all after them. So one quality day, one
  easy day, one long day, two station days at the Hyrox gym, and one strength
  day. Everything else is running at OU.

  The order is deliberate. Wednesday is easy because it sits between the two
  station days, which are the two hardest sessions of the week. Strength lands
  on Friday, one lighter day before the long run, rather than stacked against a
  station day. Sunday has no training block at all — a rest day the app scores
  as a rest day rather than a miss, which is what the anchor-by-kind rule in
  `habits.ts` buys.
*/

const INTERVALS: Block = {
  start: "05:00",
  end: "06:00",
  label: "Intervals",
  kind: "training",
  brief: "5 × 1km @ 10k effort · 2min jog",
};

const EASY_RUN: Block = {
  start: "05:00",
  end: "06:00",
  label: "Easy Run",
  kind: "training",
  brief: "45–55 min conversational · nothing hard",
};

const STRENGTH: Block = {
  start: "05:00",
  end: "06:00",
  label: "Strength",
  kind: "training",
  brief: "Squat · RDL · split squat · farmer carry — 4×6 heavy, clean",
};

const HYROX: Block = {
  start: "05:30",
  end: "07:15",
  label: "Hyrox Session",
  kind: "training",
  brief: "Stations + compromised runs — log the splits",
};

const LONG_RUN: Block = {
  start: "09:00",
  end: "11:00",
  label: "Long Run",
  kind: "training",
  brief: "75–90 min steady · last 15 at race effort",
};

/** Mon / Wed / Fri, everything up to the evening. Training varies by day. */
function mwfDay(training: Block): Block[] {
  return [
    WAKE,
    training,
    { start: "06:20", end: "07:00", label: "Quiet Time", kind: "personal" },
    { start: "07:00", end: "07:30", label: "Breakfast", kind: "personal" },
    { start: "07:30", end: "09:00", label: "Admin", kind: "work" },
    { start: "09:00", end: "09:50", label: "ENGL 1213", kind: "class" },
    { start: "10:00", end: "12:20", label: "Deep Work", kind: "work" },
    { start: "12:20", end: "13:00", label: "Lunch", kind: "personal" },
    { start: "13:00", end: "13:50", label: "FMS 1013", kind: "class" },
    { start: "15:00", end: "15:50", label: "SPAN 1115", kind: "class" },
    { start: "16:30", end: "17:30", label: "Content", kind: "work" },
    { start: "17:30", end: "18:30", label: "Dinner", kind: "personal" },
  ];
}

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

/** Tue / Thu — the two station days at the Hyrox gym. */
const TR_DAY: Block[] = [
  WAKE,
  HYROX,
  { start: "07:15", end: "07:45", label: "Quiet Time", kind: "personal" },
  { start: "07:45", end: "10:30", label: "Deep Work", kind: "work" },
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
  { start: "06:20", end: "07:30", label: "Quiet Time", kind: "personal" },
  LONG_RUN,
  { start: "12:00", end: "14:00", label: "Content", kind: "work" },
  WIND_DOWN,
];

const SUNDAY: Block[] = [
  WAKE,
  { start: "06:20", end: "07:30", label: "Quiet Time", kind: "personal" },
  { start: "09:30", end: "11:30", label: "Church", kind: "personal" },
  { start: "14:00", end: "15:30", label: "Weekly Reset", kind: "personal" },
  { start: "19:00", end: "21:00", label: "Study", kind: "work" },
  WIND_DOWN,
];

/** The weekly template, keyed by `Date.prototype.getDay()`. */
export const WEEKLY_SCHEDULE: Record<Weekday, Block[]> = {
  0: SUNDAY,
  1: [...mwfDay(INTERVALS), ...MF_EVENING],
  2: TR_DAY,
  3: [...mwfDay(EASY_RUN), ...WED_EVENING],
  4: TR_DAY,
  5: [...mwfDay(STRENGTH), ...MF_EVENING],
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

/**
 * The distinct training sessions in the week, in the order they first occur.
 *
 * Structurally fixed by the template rather than by anything the user can
 * edit, which is what lets a page built on it have a constant height: five
 * rows today, and five rows until this file changes.
 */
export function trainingLabels(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const day of [1, 2, 3, 4, 5, 6, 0] as Weekday[]) {
    for (const b of WEEKLY_SCHEDULE[day]) {
      if (b.kind !== "training" || seen.has(b.label)) continue;
      seen.add(b.label);
      out.push(b.label);
    }
  }
  return out;
}

/** The training block scheduled on a date, if any. */
export function trainingBlockOn(date: string): Block | undefined {
  return blocksForDate(date).find((b) => b.kind === "training");
}

/**
 * Every distinct block label across the week, in first-appearance order.
 * The habit editor offers these as anchor targets — a habit anchored to a
 * label is scheduled exactly on the days that label appears, which is how
 * "Deep Work" stays a weekday habit without anyone stating that anywhere.
 */
export function allBlockLabels(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const day of [1, 2, 3, 4, 5, 6, 0] as Weekday[]) {
    for (const b of WEEKLY_SCHEDULE[day]) {
      if (seen.has(b.label)) continue;
      seen.add(b.label);
      out.push(b.label);
    }
  }
  return out;
}
