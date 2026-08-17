import type { DailyLog, HabitKey } from "./types";

/**
 * Restoring a backup written by the old summer-arc app.
 *
 * The old schema used different habit ids (`run`, `bibleAm`, `sleepBy10`, …)
 * and different fields. Written through verbatim, every restored day reads as
 * all five habits missed — a silent success that fabricates a fortnight of
 * failure. This maps what genuinely corresponds and, crucially, records what
 * has *no source at all* so the record can show those as no-data rather than
 * as misses.
 */

/** Old habit id → new key, where the two actually mean the same thing. */
const HABIT_MAP: Record<string, HabitKey> = {
  run: "training",
  noPhoneBeforeBible: "phoneOff",
  sleepBy10: "lightsOut",
};

/** Fallbacks used only when the primary source id is absent. */
const HABIT_FALLBACK: Partial<Record<HabitKey, string[]>> = {
  phoneOff: ["bibleAm"],
};

/**
 * The old app had no wake and no deep-work habit, so those can never be
 * recovered — they are marked no-data rather than invented as misses.
 */
const NO_SOURCE: HabitKey[] = ["wake", "deepWork"];

interface LegacyLog {
  date?: string;
  habits?: Record<string, boolean>;
  runNotes?: string;
  win?: string;
  lesson?: string;
  [k: string]: unknown;
}

/** True when a value looks like a log written by the old app. */
export function isLegacyLog(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (
    "coldCalls" in o ||
    "top3Priorities" in o ||
    "runMiles" in o ||
    "plungeMinutes" in o
  ) {
    return true;
  }
  // Or: a habits map whose keys are all old ids.
  const h = o.habits;
  if (h && typeof h === "object") {
    const keys = Object.keys(h as object);
    const NEW = new Set(["wake", "phoneOff", "training", "deepWork", "lightsOut"]);
    if (keys.length > 0 && !keys.some((k) => NEW.has(k))) return true;
  }
  return false;
}

export function isLegacyBundle(b: unknown): boolean {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  if (o.schema === 1 || o.schema === 2) return true;
  if ("weekly" in o) return true;
  const daily = o.daily as Record<string, unknown> | undefined;
  if (daily && typeof daily === "object") {
    return Object.values(daily).some(isLegacyLog);
  }
  return false;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Convert one old log into the current shape. */
export function migrateLegacyLog(date: string, input: unknown): DailyLog {
  const raw = (input ?? {}) as LegacyLog;
  const oldHabits = raw.habits ?? {};

  const habits: Record<HabitKey, boolean> = {
    wake: false,
    phoneOff: false,
    training: false,
    deepWork: false,
    lightsOut: false,
  };

  for (const [oldId, key] of Object.entries(HABIT_MAP)) {
    if (oldHabits[oldId] === true) habits[key] = true;
  }
  for (const [key, ids] of Object.entries(HABIT_FALLBACK) as [
    HabitKey,
    string[],
  ][]) {
    if (!habits[key] && ids.some((id) => oldHabits[id] === true)) {
      habits[key] = true;
    }
  }

  // The day's reflection had two fields; keep both rather than pick one.
  const note = [str(raw.win), str(raw.lesson)].filter(Boolean).join(" — ");

  return {
    date,
    habits,
    deepWorkMinutes: 0,
    trainingNote: str(raw.runNotes),
    contentShipped: false,
    note,
    stamps: {},
    // Habits the old app never tracked. The record shows these as no-data.
    noData: NO_SOURCE,
  };
}

/** How much a bundle will actually recover, for reporting before/after. */
export function describeMigration(daily: Record<string, unknown>): {
  days: number;
  recovered: HabitKey[];
  unrecoverable: HabitKey[];
} {
  return {
    days: Object.keys(daily).length,
    recovered: ["training", "phoneOff", "lightsOut"],
    unrecoverable: NO_SOURCE,
  };
}
