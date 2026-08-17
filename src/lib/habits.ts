import type { BlockKind, Weekday } from "./schedule";
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
 * legitimately own differently-named blocks on different days: training is the
 * 05:00 Run on MWF, the 05:30 NSC Session on TR and the 09:00 Long Run on
 * Saturday. Matching on kind covers all three; matching on label covers the
 * habits that name exactly one block.
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
  order: number;
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
    icon: "run",
    days: ALL_DAYS,
    // Kind, not label: Run / NSC Session / Long Run are all this habit.
    anchor: { kind: "training" },
    order: 2,
  },
  {
    id: "deepWork",
    label: "Deep Work",
    code: "D",
    icon: "target",
    days: ALL_DAYS,
    anchor: { labels: ["Deep Work"] },
    order: 3,
  },
  {
    id: "lightsOut",
    label: "Lights out",
    code: "L",
    icon: "moon",
    days: ALL_DAYS,
    anchor: { labels: ["Wind Down"] },
    order: 4,
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
    return defs.length > 0
      ? [...defs].sort((a, b) => a.order - b.order)
      : BUILT_INS;
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
  if (habit.anchor) return anchorIndexFor(habit, date) >= 0;
  return habit.days.includes(weekdayOf(date));
}

/** Ids of every habit expected on the date, in display order. */
export function habitIdsForDate(date: string, habits = getHabits()): string[] {
  return habits
    .filter((h) => isHabitScheduledOn(h, date))
    .map((h) => h.id);
}
