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
  The training week, rebuilt hybrid — run in the morning, lift or stations in
  the afternoon, five two-a-days. Dallas (Nov 18–22) is still the target.

  The shape is the hybrid-athlete standard: an aerobic base of six runs
  (four easy, one quality, one long) under three lifts and the two CEREMONY
  HYROX classes at the Sarkeys Fitness Center (Mon/Wed 5:30 PM, free, four
  minutes away). Runs own 6:00 AM because that is when the building opens and
  the day's first class isn't until 10:30; lifts own the 4:10 slot because
  Spanish ends at 3:50 next door and the evening build block starts at 6:30
  regardless. Hard things stay separated by design: the only quality run
  (Tuesday) is followed by the week's easiest run, the lifts sit eight-plus
  hours after that morning's run, and Sunday's session is recovery by contract
  — zone 1 or a walk, the day that lets seven days a week be survivable at
  all. The ramp is the real risk of a doubles week: the easy runs start at
  thirty-to-forty minutes and earn their length; the mileage is allowed to
  grow, not assumed.
*/

const INTERVALS: Block = {
  start: "06:00",
  end: "07:00",
  label: "Intervals",
  kind: "training",
  brief: "5 × 1km @ 10k effort · 2min jog — track opens 6:00",
};

/**
 * Every aerobic run shares one label so the sessions page and the training
 * letter treat them as one thing; the brief carries what today's version is.
 */
function easyRun(end: string, brief: string): Block {
  return { start: "06:00", end, label: "Easy Run", kind: "training", brief };
}

/** Same idea for the iron: one label, three briefs. */
function lift(brief: string): Block {
  return { start: "16:10", end: "17:25", label: "Lift", kind: "training", brief };
}

const HYROX: Block = {
  // CEREMONY HYROX, Sarkeys Fitness Center Flex Studio. The 5:30 class; the
  // 6:30 runs as a fallback when registration misses — same block either way.
  start: "17:30",
  end: "18:15",
  label: "Hyrox Session",
  kind: "training",
  brief: "CEREMONY HYROX @ Sarkeys FC — register on fitrec.ou.edu (closes 1h before) · log the splits",
};

const LONG_RUN: Block = {
  start: "09:00",
  end: "11:00",
  label: "Long Run",
  kind: "training",
  brief: "75–90 min steady · last 15 at race effort",
};

/**
 * The class blocks, times from the registrar as of Aug 23. ENGL is section
 * 017 (Weryackwe) after the online conversion was traded away for the last
 * in-person seat; its brief carries the walk, because the Energy Center is
 * the far corner of campus and the block before it has to actually end.
 */
const ENGL: Block = {
  start: "11:00",
  end: "11:50",
  label: "ENGL 1213",
  kind: "class",
  brief: "Sarkeys Energy Ctr P0203 (P level, below lobby) · Weryackwe · leave South Hall 10:38",
};

const FMS: Block = {
  start: "13:00",
  end: "13:50",
  label: "FMS 1013",
  kind: "class",
  brief: "Dale Hall 0128 · Sperb · Looking at Movies 8e is Inclusive Access — already billed",
};

const SPAN_MTWR: Block = {
  start: "15:00",
  end: "15:50",
  label: "SPAN 1115",
  kind: "class",
  brief: "Kaufman Hall 0132 · Cortest",
};

const SPAN_FRI: Block = {
  start: "15:00",
  end: "15:50",
  label: "SPAN 1115",
  kind: "class",
  brief: "Friday is the video-conference session — link in Canvas, join from anywhere",
};

const POLY: Block = {
  start: "10:30",
  end: "11:45",
  label: "POLY 1003",
  kind: "class",
  brief: "Carson Engr Ctr 0438 — 4th floor · Wei Li · 15 min walk, leave 10:08",
};

/** The MWF class run, identical Monday through Friday from 11:00 onward. */
const MWF_CLASSES: Block[] = [
  ENGL,
  { start: "12:00", end: "12:50", label: "Lunch", kind: "personal" },
  FMS,
];

/** Mon / Wed / Fri morning — the day's first session, then the class run. */
function mwfMorning(run: Block): Block[] {
  return [
    { start: "05:30", end: "05:45", label: "Wake", kind: "personal" },
    run,
    { start: "07:00", end: "07:30", label: "Quiet Time", kind: "personal" },
    { start: "07:30", end: "08:00", label: "Breakfast", kind: "personal" },
    { start: "08:00", end: "09:00", label: "Admin", kind: "work" },
    // Ends short of the hour on purpose: the ENGL walk starts at 10:38.
    { start: "09:00", end: "10:35", label: "Deep Work", kind: "work" },
    ...MWF_CLASSES,
  ];
}

/** Mon / Wed — afternoon into the Sarkeys class, dinner after. */
function hyroxEvening(rest: Block[]): Block[] {
  return [
    SPAN_MTWR,
    { start: "16:10", end: "17:10", label: "Content", kind: "work" },
    HYROX,
    { start: "18:30", end: "19:15", label: "Dinner", kind: "personal" },
    ...rest,
    WIND_DOWN,
  ];
}

const MON_EVENING = hyroxEvening([
  { start: "19:15", end: "21:15", label: "Build Block", kind: "work" },
]);

/** Wednesday — Build Block is cut short for BCM. */
const WED_EVENING = hyroxEvening([
  { start: "19:15", end: "20:00", label: "Build Block", kind: "work" },
  { start: "20:30", end: "21:15", label: "BCM Renown", kind: "personal" },
]);

/** Friday — the third lift of the week, straight after the online Spanish. */
const FRI_EVENING: Block[] = [
  SPAN_FRI,
  lift("Full-body pump — incline press · pull · laterals · arms · carries"),
  { start: "17:30", end: "18:15", label: "Dinner", kind: "personal" },
  { start: "18:30", end: "21:15", label: "Build Block", kind: "work" },
  WIND_DOWN,
];

/** Tue / Thu — morning run, afternoon lift: the pure hybrid days. */
function trDay(run: Block, pm: Block): Block[] {
  return [
    { start: "05:30", end: "05:45", label: "Wake", kind: "personal" },
    run,
    { start: "07:00", end: "07:30", label: "Quiet Time", kind: "personal" },
    { start: "07:30", end: "08:00", label: "Breakfast", kind: "personal" },
    { start: "08:00", end: "10:05", label: "Deep Work", kind: "work" },
    POLY,
    { start: "11:50", end: "12:15", label: "Lunch", kind: "personal" },
    // Second Deep Work block of the day — the habit is anchored to the first only.
    { start: "12:15", end: "15:00", label: "Deep Work", kind: "work" },
    SPAN_MTWR,
    pm,
    { start: "17:30", end: "18:15", label: "Dinner", kind: "personal" },
    { start: "18:30", end: "21:15", label: "Build Block", kind: "work" },
    WIND_DOWN,
  ];
}

const SATURDAY: Block[] = [
  WAKE,
  { start: "06:20", end: "07:30", label: "Quiet Time", kind: "personal" },
  LONG_RUN,
  { start: "12:00", end: "14:00", label: "Content", kind: "work" },
  WIND_DOWN,
];

/*
  The seventh day. He asked for six-if-not-seven, so Sunday carries a session
  — but it is recovery by contract, not a workout that snuck in: zone 1,
  conversational the whole way, outdoors because the gym does not open until
  two. If anything aches, walking the whole block still counts. The week's
  ability to absorb twelve sessions depends on this one staying honest.
*/
const SUNDAY: Block[] = [
  WAKE,
  { start: "06:20", end: "07:15", label: "Quiet Time", kind: "personal" },
  {
    start: "07:30",
    end: "08:15",
    label: "Easy Run",
    kind: "training",
    brief: "Recovery — 30–45 min zone 1 outdoors, or a ruck/walk · honesty day",
  },
  { start: "09:30", end: "11:30", label: "Church", kind: "personal" },
  { start: "14:00", end: "15:30", label: "Weekly Reset", kind: "personal" },
  { start: "19:00", end: "21:00", label: "Study", kind: "work" },
  WIND_DOWN,
];

/** The weekly template, keyed by `Date.prototype.getDay()`. */
export const WEEKLY_SCHEDULE: Record<Weekday, Block[]> = {
  0: SUNDAY,
  1: [...mwfMorning(easyRun("06:50", "40–50 min conversational")), ...MON_EVENING],
  2: trDay(INTERVALS, lift("Upper — bench · row · OHP · pulldown · arms, 3–4×6–10")),
  3: [...mwfMorning(easyRun("06:50", "40–50 min conversational")), ...WED_EVENING],
  4: trDay(easyRun("07:00", "30–40 min truly easy — the week’s hardest days surround it"),
           lift("Lower — squat · RDL · split squat · calves + grip work")),
  5: [...mwfMorning(easyRun("06:40", "30 min shakeout + 4 strides")), ...FRI_EVENING],
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
  return routineFor(weekdayOf(date));
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
 * Follows the routine, so an edited week reshapes it. The sessions page caps
 * what it renders — its surface cannot scroll — so a week with many distinct
 * session names shows the first six and says so.
 */
export function trainingLabels(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const day of [1, 2, 3, 4, 5, 6, 0] as Weekday[]) {
    for (const b of routineFor(day)) {
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
    for (const b of routineFor(day)) {
      if (seen.has(b.label)) continue;
      seen.add(b.label);
      out.push(b.label);
    }
  }
  return out;
}


/* ------------------------------------------------------------------ routine */

/**
 * User overrides for the weekly template.
 *
 * The template above is the default, not the law: a semester reshuffles class
 * times within a week of starting, and a routine you cannot edit gets abandoned
 * rather than lived in. Overrides are stored per weekday and read by everything
 * through `routineFor`, so the whole app — the spine, the sessions page, the
 * anchor lists in the habit editor — follows an edit with no other wiring.
 *
 * The cache is keyed on the raw string: `blocksForDate` runs on every clock
 * tick, and parsing localStorage sixty times a minute would be rude.
 */

const ROUTINE_KEY = "standard:routine:v1";
export const ROUTINE_CHANGED = "standard:routine-changed";

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const KINDS: BlockKind[] = ["training", "class", "work", "personal", "rest"];

export function isRoutineBlock(v: unknown): v is Block {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.start === "string" &&
    TIME_RE.test(o.start) &&
    typeof o.end === "string" &&
    TIME_RE.test(o.end) &&
    typeof o.label === "string" &&
    o.label.trim().length > 0 &&
    typeof o.kind === "string" &&
    (KINDS as string[]).includes(o.kind)
  );
}

type Overrides = Partial<Record<Weekday, Block[]>>;

let cacheRaw: string | null | undefined;
let cacheVal: Overrides = {};

function overrides(): Overrides {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(ROUTINE_KEY);
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  cacheVal = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const d of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
        const arr = parsed[String(d)];
        if (Array.isArray(arr) && arr.length > 0 && arr.every(isRoutineBlock)) {
          cacheVal[d] = [...arr].sort(
            (a, b) => toMinutes(a.start) - toMinutes(b.start),
          );
        }
      }
    } catch {
      /* corrupted → template */
    }
  }
  return cacheVal;
}

/** The day as the user has shaped it, falling back to the template. */
export function routineFor(day: Weekday): Block[] {
  return overrides()[day] ?? WEEKLY_SCHEDULE[day];
}

export function routineEdited(day: Weekday): boolean {
  return overrides()[day] != null;
}

/** Every stored override, for the backup bundle. */
export function routineOverrides(): Overrides {
  return overrides();
}

/**
 * Why a proposed day cannot be saved, in words, or null when it can. Overlap
 * is rejected rather than warned: the whole spine assumes at most one current
 * block, and a saved overlap would quietly break focus everywhere.
 */
export function routineProblem(blocks: Block[]): string | null {
  if (blocks.length === 0) return "a day needs at least one block";
  for (const b of blocks) {
    if (!isRoutineBlock(b)) return "every block needs a name and real times";
    if (toMinutes(b.end) <= toMinutes(b.start)) {
      return `${b.label.trim() || "a block"} ends before it starts`;
    }
  }
  const sorted = [...blocks].sort(
    (a, b) => toMinutes(a.start) - toMinutes(b.start),
  );
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
      return `${sorted[i - 1].label} overlaps ${sorted[i].label}`;
    }
  }
  return null;
}

/**
 * Store a day (null restores the template). Returns the problem instead of
 * saving when the day is invalid.
 */
export function setRoutineDay(
  day: Weekday,
  blocks: Block[] | null,
): string | null {
  if (typeof window === "undefined") return "no storage here";
  if (blocks) {
    const problem = routineProblem(blocks);
    if (problem) return problem;
  }
  const next: Overrides = { ...overrides() };
  if (blocks) {
    next[day] = [...blocks].sort(
      (a, b) => toMinutes(a.start) - toMinutes(b.start),
    );
  } else {
    delete next[day];
  }
  if (Object.keys(next).length === 0) {
    window.localStorage.removeItem(ROUTINE_KEY);
  } else {
    window.localStorage.setItem(ROUTINE_KEY, JSON.stringify(next));
  }
  cacheRaw = undefined;
  window.dispatchEvent(new Event(ROUTINE_CHANGED));
  return null;
}

/** Replace every override at once — the restore path. Trusts nothing. */
export function setRoutineAll(raw: unknown): number {
  if (typeof window === "undefined" || !raw || typeof raw !== "object") return 0;
  const next: Overrides = {};
  let days = 0;
  for (const d of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
    const arr = (raw as Record<string, unknown>)[String(d)];
    if (Array.isArray(arr) && arr.length > 0 && arr.every(isRoutineBlock)) {
      if (routineProblem(arr as Block[]) == null) {
        next[d] = arr as Block[];
        days += 1;
      }
    }
  }
  if (days > 0) {
    window.localStorage.setItem(ROUTINE_KEY, JSON.stringify(next));
    cacheRaw = undefined;
    window.dispatchEvent(new Event(ROUTINE_CHANGED));
  }
  return days;
}
