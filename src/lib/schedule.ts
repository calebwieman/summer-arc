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

const WIND_DOWN: Block = {
  start: "21:15",
  end: "22:00",
  label: "Wind Down",
  kind: "rest",
};

/*
  The training week, v3 — iron in the morning, road in the afternoon.

  The CEREMONY HYROX classes are gone (one visit was enough), and with them
  the last reason to train in the evening: pre-workout at 4 PM was wrecking
  sleep, and Sarkeys is packed after 3. So the lifts own the 6:00 door-open
  slot — five mornings, 90 minutes to Lower/Push/Engine/Pull/Full body, built
  to leave nothing — and every afternoon carries a run at 4:10, right after
  Spanish lets out next door. Wednesday's lift is the engine day (sleds,
  SkiErg, wall balls — the HYROX sim); its run is now a hard track effort too,
  by choice — engine AM and intervals PM stacked on the same day. That means
  Thursday's intervals land on legs that already worked twice on Wednesday,
  not on a night's rest — watch the Gym surface's recovery line here first.

  A week this loaded only works if recovery is watched rather than assumed:
  the Gym surface tracks tonnage and session RPE and says so when the jump is
  too big. Saturday is the long run; Sunday is mobility and a zone-1 shakeout,
  recovery by contract — the day that makes seven days a week survivable.
*/

/** Five mornings, one label — the brief carries which session today is. */
function lift(brief: string): Block {
  return { start: "06:00", end: "07:45", label: "Lift", kind: "training", brief };
}

/**
 * Every aerobic afternoon shares one label so the sessions page and the R
 * letter treat them as one thing; the brief carries what today's version is.
 */
function pmRun(end: string, brief: string): Block {
  return { start: "16:10", end, label: "Easy Run", kind: "training", brief };
}

const INTERVALS: Block = {
  start: "16:10",
  end: "17:10",
  label: "Intervals",
  kind: "training",
  brief: "5 × 1km @ 10k effort · 2min jog — engine was yesterday, legs have had a night",
};

const LONG_RUN: Block = {
  start: "09:00",
  end: "10:45",
  label: "Long Run",
  kind: "training",
  brief: "80–100 min steady · last 15 at race effort · core + grip after",
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

/**
 * Every weekday opens the same way: up at 5:30, under a bar when the doors
 * open at 6:00, and the day's quiet half hour lands *after* the session —
 * pre-workout goes in the water bottle on the walk over, and breakfast is
 * earned. What changes per day is only the brief on the lift.
 */
function weekdayMorning(liftBrief: string): Block[] {
  return [
    { start: "05:30", end: "05:45", label: "Wake", kind: "personal" },
    lift(liftBrief),
    { start: "07:50", end: "08:20", label: "Breakfast", kind: "personal" },
    { start: "08:20", end: "08:40", label: "Quiet Time", kind: "personal" },
  ];
}

/** Mon / Wed / Fri — deep work until the ENGL walk starts at 10:38. */
function mwfDay(liftBrief: string): Block[] {
  return [
    ...weekdayMorning(liftBrief),
    { start: "08:45", end: "10:35", label: "Deep Work", kind: "work" },
    ...MWF_CLASSES,
  ];
}

/** Tue / Thu — POLY at 10:30, the long study spine after lunch. */
function trDay(liftBrief: string, run: Block): Block[] {
  return [
    ...weekdayMorning(liftBrief),
    { start: "08:45", end: "10:05", label: "Deep Work", kind: "work" },
    POLY,
    { start: "11:50", end: "12:15", label: "Lunch", kind: "personal" },
    // Second Deep Work block of the day — the habit is anchored to the first only.
    { start: "12:15", end: "15:00", label: "Deep Work", kind: "work" },
    SPAN_MTWR,
    run,
    { start: "17:30", end: "18:15", label: "Dinner", kind: "personal" },
    { start: "18:30", end: "21:15", label: "Build Block", kind: "work" },
    WIND_DOWN,
  ];
}

/** Mon / Wed / Fri afternoon — Spanish, the run, then the evening's shape. */
function mwfEvening(span: Block, run: Block, rest: Block[]): Block[] {
  return [
    span,
    run,
    { start: "17:00", end: "17:45", label: "Dinner", kind: "personal" },
    ...rest,
    WIND_DOWN,
  ];
}

const MON_EVENING = mwfEvening(
  SPAN_MTWR,
  pmRun("16:50", "40 min conversational — legs will be heavy from the squats, that's fine"),
  [{ start: "18:00", end: "21:15", label: "Build Block", kind: "work" }],
);

/** Wednesday's hard effort — track work on top of the engine morning. */
const WED_HARD: Block = {
  start: "16:10",
  end: "16:55",
  label: "Track Hard Effort",
  kind: "training",
  brief: "6 × 600m @ 5k effort · 90s jog — Sarkeys indoor track (6 laps/km); warm up + cool down inside the 45",
};

/** Wednesday — hard track effort after the engine morning; Build cut for BCM. */
const WED_EVENING = mwfEvening(
  SPAN_MTWR,
  WED_HARD,
  [
    { start: "18:00", end: "20:00", label: "Build Block", kind: "work" },
    { start: "20:30", end: "21:15", label: "BCM Renown", kind: "personal" },
  ],
);

const FRI_EVENING = mwfEvening(
  SPAN_FRI,
  pmRun("16:50", "40 min easy + 4 strides — shake the week out"),
  [{ start: "18:00", end: "21:15", label: "Build Block", kind: "work" }],
);

const SATURDAY: Block[] = [
  { start: "07:00", end: "07:15", label: "Wake", kind: "personal" },
  { start: "07:15", end: "08:00", label: "Quiet Time", kind: "personal" },
  { start: "08:00", end: "08:30", label: "Breakfast", kind: "personal" },
  LONG_RUN,
  { start: "12:00", end: "14:00", label: "Content", kind: "work" },
  WIND_DOWN,
];

/*
  The seventh day. Still a training day on paper, but recovery by contract:
  mobility in the morning because that is when stiffness tells the truth, and
  a zone-1 shakeout at four — conversational the whole way, outdoors, and if
  anything aches, walking the whole block still counts. Twelve hard sessions
  a week are only absorbable because this one stays honest.
*/
const SUNDAY: Block[] = [
  { start: "07:30", end: "07:45", label: "Wake", kind: "personal" },
  { start: "07:45", end: "08:30", label: "Quiet Time", kind: "personal" },
  {
    start: "08:45",
    end: "09:15",
    label: "Mobility",
    kind: "personal",
    brief: "hips · ankles · t-spine · foam roll — the weekly recovery audit",
  },
  { start: "09:30", end: "11:30", label: "Church", kind: "personal" },
  { start: "14:00", end: "15:30", label: "Weekly Reset", kind: "personal" },
  {
    start: "16:00",
    end: "16:40",
    label: "Recovery Run",
    kind: "training",
    brief: "30–40 min zone 1 outdoors, or a ruck/walk · honesty day",
  },
  { start: "19:00", end: "21:00", label: "Study", kind: "work" },
  WIND_DOWN,
];

/** The weekly template, keyed by `Date.prototype.getDay()`. */
export const WEEKLY_SCHEDULE: Record<Weekday, Block[]> = {
  0: SUNDAY,
  1: [
    ...mwfDay("Lower (heavy) — squat 5×5 · RDL · split squat · leg press · calves"),
    ...MON_EVENING,
  ],
  2: trDay(
    "Upper push — bench 5×5 · incline DB · seated press · dips · laterals",
    pmRun("16:50", "40 min conversational — easy means easy"),
  ),
  3: [
    ...mwfDay("Engine — HYROX sim: sleds · SkiErg · wall balls · carries, at effort"),
    ...WED_EVENING,
  ],
  4: trDay(
    "Upper pull — weighted pull-ups 5×5 · rows · pulldown · face pulls · arms",
    INTERVALS,
  ),
  5: [
    ...mwfDay("Full body — deadlift 5×3 · front squat · push press · chins"),
    ...FRI_EVENING,
  ],
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
