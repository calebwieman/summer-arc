import type { BlockKind, Weekday } from "./schedule";
import { todayISO } from "./clock";
import { blocksForDate, weekdayOf } from "./schedule";

/**
 * The habit registry.
 *
 * Habits used to be a closed five-member union declared *by* the schedule —
 * `Block.habit` named the habit that block owned. That cannot express a habit
 * the user invents, so the relationship is inverted here: a habit declares
 * where it lands, and the schedule stays a dumb description of the day.
 *
 * Anchoring is a match rule rather than a block index because one habit can
 * legitimately own differently-named blocks on different days, and the Hyrox
 * week makes that the normal case rather than the exception: training is
 * Intervals on Monday, a Hyrox Session on Tuesday and Thursday, an Easy Run on
 * Wednesday, Strength on Friday and a Long Run on Saturday. Matching on kind
 * covers all six; matching on label covers the habits that name exactly one
 * block.
 */

/** Which block a habit commits inside. Absent = the habit floats. */
export interface HabitAnchor {
  /** Any block whose label is in this list. First match on the day wins. */
  labels?: string[];
  /** Any block of this kind. Used where the label varies by weekday. */
  kind?: BlockKind;
}

export interface HabitDef {
  /** Stable key. Also the key inside `DailyLog.habits`, so it must never change. */
  id: string;
  label: string;
  /** Register glyph. One or two characters. */
  code: string;
  /** Name from ICONS in components/day/habit-icons.ts. */
  icon: string;
  /**
   * Weekdays the habit is expected, used only when it has no anchor. An
   * anchored habit is scheduled exactly when its anchor block exists, which is
   * what makes Sunday a real rest day for training rather than a miss.
   */
  days: Weekday[];
  anchor?: HabitAnchor;
  /**
   * The habit does not exist before this date. Stamped when a new built-in is
   * reconciled into an established registry, so weeks of history are not
   * rescored as misses for a letter that was not there.
   */
  since?: string;
  order: number;
  /**
   * Kept out of the day's done/total tally.
   *
   * For a habit that is real and worth a letter but is not one of the day's
   * standing commitments — the run, which happens when it happens and is
   * written up at night. Counting it would make the tally read 4/6 on a day
   * that was actually complete. It still scores in the record.
   */
  offSummary?: boolean;
  /**
   * Retired rather than deleted, so the history it already wrote stays
   * readable and stays out of today's scoring.
   */
  archived?: boolean;
}

const KEY = "standard:habits:v1";
/** Fired after any write so open surfaces can re-read without prop drilling. */
export const HABITS_CHANGED = "standard:habits-changed";

export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * The five habits the app shipped with. Ids match the old `HabitKey` union
 * exactly, so every DailyLog ever written keeps scoring without migration.
 */
export const BUILT_INS: HabitDef[] = [
  {
    id: "wake",
    label: "Wake 04:45",
    code: "W",
    icon: "sunrise",
    days: ALL_DAYS,
    anchor: { labels: ["Wake"] },
    order: 0,
  },
  {
    id: "phoneOff",
    label: "Phone off till Quiet Time",
    code: "Q",
    icon: "phone",
    days: ALL_DAYS,
    anchor: { labels: ["Quiet Time"] },
    order: 1,
  },
  {
    id: "training",
    label: "Training",
    code: "T",
    // The dumbbell. Training shared footprints with the run for a week, and
    // two identical silhouettes in a six-icon register is a bug.
    icon: "lift",
    days: ALL_DAYS,
    // Kind, not label: every session in the Hyrox week is this one habit.
    anchor: { kind: "training" },
    order: 2,
  },
  {
    id: "run",
    label: "Run",
    code: "R",
    icon: "run",
    // The letter's birthday. A fresh registry gets the built-ins directly, so
    // the reconcile stamp above never runs for it — without this, logs that
    // predate the feature would score as run misses.
    since: "2026-08-19",
    days: ALL_DAYS,
    /*
      No anchor, deliberately. Every other letter belongs to a block and is
      thrown inside it; this one belongs to no hour. The run happens when it
      happens and gets written up at the end of the day, so it is a letter you
      scrub to rather than a slot you arrive at.
    */
    offSummary: true,
    order: 3,
  },
  {
    id: "deepWork",
    label: "Deep Work",
    code: "D",
    icon: "target",
    days: ALL_DAYS,
    anchor: { labels: ["Deep Work"] },
    order: 4,
  },
  {
    id: "lightsOut",
    label: "Lights out",
    code: "L",
    icon: "moon",
    days: ALL_DAYS,
    anchor: { labels: ["Wind Down"] },
    order: 5,
  },
];

function isDef(v: unknown): v is HabitDef {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.label === "string" &&
    typeof o.code === "string" &&
    Array.isArray(o.days)
  );
}

/** Every habit in the registry, retired ones included, in display order. */
export function getAllHabits(): HabitDef[] {
  if (typeof window === "undefined") return BUILT_INS;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return BUILT_INS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return BUILT_INS;
    const defs = parsed.filter(isDef);
    if (defs.length === 0) return BUILT_INS;

    /*
      Reconcile the built-ins into a stored registry.

      Stored defs used to shadow BUILT_INS entirely, so a registry saved before
      a built-in existed could never receive it — the Run letter simply never
      appeared for anyone who had ever edited a habit. Archiving still wins: a
      retired built-in is present-but-archived, so the merge cannot resurrect
      it.
    */
    const have = new Set(defs.map((d) => d.id));
    let changed = false;
    for (const b of BUILT_INS) {
      if (!have.has(b.id)) {
        // Born today, as far as this registry is concerned: without the stamp
        // every day since the first log rescored as a miss for a letter that
        // did not exist yet.
        defs.push({ ...b, since: b.since ?? todayISO() });
        changed = true;
      }
    }

    /*
      One-time normalisation: a stored training that still carries the old
      footprints default moves to the dumbbell, now that the run owns
      footprints. A hand-picked icon is anything else, and is left alone.
    */
    for (const d of defs) {
      if (d.id === "training" && d.icon === "run") {
        d.icon = "lift";
        changed = true;
      }
    }

    if (changed) window.localStorage.setItem(KEY, JSON.stringify(defs));
    return [...defs].sort((a, b) => a.order - b.order);
  } catch {
    return BUILT_INS;
  }
}

/** The habits that count: everything not retired. */
export function getHabits(): HabitDef[] {
  return getAllHabits().filter((h) => !h.archived);
}

export function saveHabits(list: HabitDef[]): void {
  if (typeof window === "undefined") return;
  const normalised = list.map((h, i) => ({ ...h, order: i }));
  window.localStorage.setItem(KEY, JSON.stringify(normalised));
  window.dispatchEvent(new Event(HABITS_CHANGED));
}

export function getHabit(id: string): HabitDef | undefined {
  return getAllHabits().find((h) => h.id === id);
}

/** Label for a habit id, falling back to the id so history never renders blank. */
export function habitLabel(id: string, habits = getAllHabits()): string {
  return habits.find((h) => h.id === id)?.label ?? id;
}

/** A slug id derived from the label, kept unique against the existing set. */
export function makeHabitId(label: string, existing: HabitDef[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "habit";
  const taken = new Set(existing.map((h) => h.id));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const next = `${base}-${i}`;
    if (!taken.has(next)) return next;
  }
}

/**
 * The block a habit commits inside on a given date, if any.
 *
 * Returns the index into `blocksForDate(date)` so callers can address the block
 * without re-scanning. -1 when the habit floats or its anchor is not on today.
 */
export function anchorIndexFor(habit: HabitDef, date: string): number {
  if (!habit.anchor) return -1;
  const blocks = blocksForDate(date);
  const { labels, kind } = habit.anchor;
  return blocks.findIndex(
    (b) =>
      (labels ? labels.includes(b.label) : false) ||
      (kind ? b.kind === kind : false),
  );
}

/**
 * True when the habit is expected on this date.
 *
 * Anchored habits follow their block, which is what keeps rest real — there is
 * no training block on Sunday and no Deep Work block at the weekend, so neither
 * is a miss there. Floating habits follow their own weekday set.
 */
export function isHabitScheduledOn(habit: HabitDef, date: string): boolean {
  if (habit.archived) return false;
  // Before a habit existed there is nothing to have missed.
  if (habit.since && date < habit.since) return false;
  if (habit.anchor) return anchorIndexFor(habit, date) >= 0;
  return habit.days.includes(weekdayOf(date));
}

/** Ids of every habit expected on the date, in display order. */
export function habitIdsForDate(date: string, habits = getHabits()): string[] {
  return habits
    .filter((h) => isHabitScheduledOn(h, date))
    .map((h) => h.id);
}
