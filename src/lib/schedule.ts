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
  sleep, and Sarkeys is packed after 3. So the lifts own the early-morning
  slot — five mornings of squat / bench / deadlift / pull / press, each built
  around a heavy top set and back-offs so the weight actually climbs week to
  week — and every afternoon carries a run at 4:10, right after Spanish lets
  out next door.

  ⚠ Wednesday is loaded on purpose and it is the week's live risk: a heavy
  deadlift morning and a 6×600m track effort the same afternoon, with
  Thursday's intervals landing on legs that worked twice the day before
  rather than on a night's rest. Two hard runs on consecutive days breaks
  the usual 48-hour rule. If anything is going to need backing off, it is
  this pair — soften Thursday first.

  The sets themselves live in Bevel, not here: this app owns the day, the
  letters and the record, and one place for sets beats two. Saturday is the
  long run; Sunday is mobility and a zone-1 shakeout, recovery by contract —
  the day that makes seven days a week survivable.
*/

/** Five mornings, one label — the brief carries which session today is. */
function lift(brief: string): Block {
  return { start: "06:45", end: "08:30", label: "Lift", kind: "training", brief };
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
  brief: "5 × 1km @ 10k effort · 2min jog — ⚠ second hard run in two days, cut it short if the legs are flat",
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
 * Every weekday opens the same way, and it opens later than it used to.
 *
 * The 5:30 alarm existed to clear a Deep Work block that no longer exists —
 * the only real constraint left is the 10:08 walk to POLY on Tue/Thu, the
 * earliest class of the week. Working back from that with nothing rushed
 * leaves the whole morning 45 minutes later: against a 10 PM lights-out
 * that is 8h15m in bed instead of 7h30m, which is the difference between
 * absorbing five hard lifts a week and accumulating them.
 *
 * Sarkeys opens at 6:00, so 6:45 still beats the crowd by hours. Quiet time
 * stays *after* the session and now gets a real 25 minutes with the walk to
 * class outside it, rather than butting against it.
 */
function weekdayMorning(liftBrief: string): Block[] {
  return [
    { start: "06:15", end: "06:30", label: "Wake", kind: "personal" },
    lift(liftBrief),
    { start: "08:30", end: "08:55", label: "Shower", kind: "personal" },
    { start: "08:55", end: "09:25", label: "Breakfast", kind: "personal" },
    { start: "09:25", end: "09:50", label: "Quiet Time", kind: "personal" },
  ];
}

/** Mon / Wed / Fri — the morning is open until the ENGL walk at 10:38. */
function mwfDay(liftBrief: string): Block[] {
  return [...weekdayMorning(liftBrief), ...MWF_CLASSES];
}

/** Tue / Thu — POLY at 10:30, the long study spine after lunch. */
function trDay(liftBrief: string, run: Block): Block[] {
  return [
    ...weekdayMorning(liftBrief),
    POLY,
    { start: "11:50", end: "12:15", label: "Lunch", kind: "personal" },
    SPAN_MTWR,
    run,
    { start: "17:30", end: "18:15", label: "Dinner", kind: "personal" },
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
  [],
);

/** Wednesday's hard effort — track work on top of the deadlift morning. */
const WED_HARD: Block = {
  start: "16:10",
  end: "16:55",
  label: "Track Hard Effort",
  kind: "training",
  brief: "6 × 600m @ 5k effort · 90s jog — Sarkeys indoor track (6 laps/km); warm up + cool down inside the 45",
};

/** Wednesday — hard track effort after the deadlift morning, then BCM. */
const WED_EVENING = mwfEvening(
  SPAN_MTWR,
  WED_HARD,
  [{ start: "20:30", end: "21:15", label: "BCM Renown", kind: "personal" }],
);

const FRI_EVENING = mwfEvening(
  SPAN_FRI,
  pmRun("16:50", "40 min easy + 4 strides — shake the week out"),
  [],
);

const SATURDAY: Block[] = [
  { start: "07:00", end: "07:15", label: "Wake", kind: "personal" },
  { start: "07:15", end: "08:00", label: "Quiet Time", kind: "personal" },
  { start: "08:00", end: "08:30", label: "Breakfast", kind: "personal" },
  LONG_RUN,
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
    ...mwfDay("Lower A — squat top set @RPE8 + back-offs · RDL · split squat · calves"),
    ...MON_EVENING,
  ],
  2: trDay(
    "Upper push — bench top set @RPE8 + back-offs · incline DB · press · dips",
    pmRun("16:50", "40 min conversational — easy means easy"),
  ),
  3: [
    ...mwfDay("Lower B — deadlift top set @RPE8 + back-offs · front squat · hip thrust"),
    ...WED_EVENING,
  ],
  4: trDay(
    "Upper pull — weighted pull-up top set @RPE8 + back-offs · rows · arms",
    INTERVALS,
  ),
  5: [
    ...mwfDay("Full body — OHP top set @RPE8 + back-offs · chins · DB bench · carries (RPE 7)"),
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
 * "Quiet Time" stays a weekday habit without anyone stating that anywhere.
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

/**
 * The template's revision. Bumped when the shipped week is rewritten (v3 was
 * the morning-lift rebuild) — an override saved against an older revision is
 * still honored, but it is *stale*: the ground moved underneath it, and the
 * routine editor says so instead of letting a summer schedule silently
 * outlive the semester that replaced it.
 */
export const TEMPLATE_REV = 3;

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
type OverrideRevs = Partial<Record<Weekday, number>>;
interface OverrideStore {
  days: Overrides;
  revs: OverrideRevs;
}

let cacheRaw: string | null | undefined;
let cacheVal: OverrideStore = { days: {}, revs: {} };

/*
  Two stored shapes. The original was a flat weekday→blocks record with no
  notion of which template it was edited against — so those read back with
  rev 0, which is exactly right: they predate revisioning, and the honest
  answer about their freshness is "unknown, treat as stale".
*/
function overrides(): OverrideStore {
  if (typeof window === "undefined") return { days: {}, revs: {} };
  const raw = window.localStorage.getItem(ROUTINE_KEY);
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  cacheVal = { days: {}, revs: {} };
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const versioned =
        parsed && typeof parsed === "object" && "days" in parsed;
      const src = (versioned
        ? (parsed as { days: unknown }).days
        : parsed) as Record<string, unknown>;
      const revs = versioned
        ? ((parsed as { revs?: unknown }).revs as Record<string, unknown>) ?? {}
        : {};
      if (src && typeof src === "object") {
        for (const d of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
          const arr = src[String(d)];
          if (Array.isArray(arr) && arr.length > 0 && arr.every(isRoutineBlock)) {
            cacheVal.days[d] = [...arr].sort(
              (a, b) => toMinutes(a.start) - toMinutes(b.start),
            );
            const r = revs[String(d)];
            cacheVal.revs[d] = typeof r === "number" ? r : 0;
          }
        }
      }
    } catch {
      /* corrupted → template */
    }
  }
  return cacheVal;
}

function persist(store: OverrideStore): void {
  const dayKeys = Object.keys(store.days);
  if (dayKeys.length === 0) {
    window.localStorage.removeItem(ROUTINE_KEY);
  } else {
    window.localStorage.setItem(
      ROUTINE_KEY,
      JSON.stringify({ days: store.days, revs: store.revs }),
    );
  }
  cacheRaw = undefined;
  window.dispatchEvent(new Event(ROUTINE_CHANGED));
}

/** The day as the user has shaped it, falling back to the template. */
export function routineFor(day: Weekday): Block[] {
  return overrides().days[day] ?? WEEKLY_SCHEDULE[day];
}

export function routineEdited(day: Weekday): boolean {
  return overrides().days[day] != null;
}

/** An override saved against an older template than the one shipping now. */
export function routineStale(day: Weekday): boolean {
  const o = overrides();
  return o.days[day] != null && (o.revs[day] ?? 0) < TEMPLATE_REV;
}

/** Every stored override (versioned shape), for the backup bundle. */
export function routineOverrides(): Record<string, unknown> {
  const o = overrides();
  return { days: o.days, revs: o.revs };
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
  const cur = overrides();
  const next: OverrideStore = {
    days: { ...cur.days },
    revs: { ...cur.revs },
  };
  if (blocks) {
    next.days[day] = [...blocks].sort(
      (a, b) => toMinutes(a.start) - toMinutes(b.start),
    );
    // Saving IS reviewing: the edit was made against the current template.
    next.revs[day] = TEMPLATE_REV;
  } else {
    delete next.days[day];
    delete next.revs[day];
  }
  persist(next);
  return null;
}

/** Replace every override at once — the restore path. Trusts nothing. */
export function setRoutineAll(raw: unknown): number {
  if (typeof window === "undefined" || !raw || typeof raw !== "object") return 0;
  // Accept both bundle shapes: the versioned {days, revs} this app writes
  // now, and the flat weekday record older backups carry — whose days
  // restore with rev 0 and correctly read as stale until reviewed.
  const versioned = "days" in (raw as Record<string, unknown>);
  const src = (versioned
    ? (raw as { days: unknown }).days
    : raw) as Record<string, unknown>;
  const revs = versioned
    ? (((raw as { revs?: unknown }).revs as Record<string, unknown>) ?? {})
    : {};
  if (!src || typeof src !== "object") return 0;
  const next: OverrideStore = { days: {}, revs: {} };
  let count = 0;
  for (const d of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
    const arr = src[String(d)];
    if (Array.isArray(arr) && arr.length > 0 && arr.every(isRoutineBlock)) {
      if (routineProblem(arr as Block[]) == null) {
        next.days[d] = arr as Block[];
        const r = revs[String(d)];
        next.revs[d] = typeof r === "number" ? r : 0;
        count += 1;
      }
    }
  }
  if (count > 0) persist(next);
  return count;
}
