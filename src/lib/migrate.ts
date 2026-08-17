import { ALL_DAYS, type HabitDef } from "./habits";
import type { DailyLog, HabitKey } from "./types";

/**
 * Restoring a backup written by the old summer-arc app.
 *
 * The old schema is `{ schema: 2, daily, weekly, habits }`. Two differences do
 * the damage if ignored.
 *
 * It had no notion of a scheduled day: every habit was written for every day,
 * so a rest day and a miss are the same record. And it carried its own habit
 * list — nine of them, with generated ids — where this app shipped five. Force
 * everything into those five and most of a summer becomes either invented
 * failure or silently discarded.
 *
 * So: equivalent habits fold into the built-in they match, the rest are
 * imported as real habits of their own (ids preserved, so their history needs
 * no rewriting), and any habit a given day has no record of at all is marked
 * no-data for that day rather than written down as false.
 */

/**
 * Old habit → built-in, matched on label because the old app generated random
 * ids for anything the user created. Ids are matched too, for the handful that
 * were stable built-ins over there.
 */
const BUILTIN_BY_LABEL: Record<string, HabitKey> = {
  "early morning": "wake",
  wake: "wake",
  bible: "phoneOff",
  "quiet time": "phoneOff",
  "no phone before bible": "phoneOff",
  run: "training",
  training: "training",
  "business moving forward": "deepWork",
  "deep work": "deepWork",
  "bed by 10": "lightsOut",
  "lights out": "lightsOut",
};

const BUILTIN_BY_ID: Record<string, HabitKey> = {
  run: "training",
  bibleAm: "phoneOff",
  noPhoneBeforeBible: "phoneOff",
  sleepBy10: "lightsOut",
};

/** Old habits that are fields here rather than habits. */
const FIELD_BY_LABEL: Record<string, "contentShipped"> = {
  content: "contentShipped",
  shipped: "contentShipped",
};

/** Best-effort icon for an imported habit, so it is not all check marks. */
const ICON_HINTS: [RegExp, string][] = [
  [/lift|gym|weight|strength/i, "lift"],
  [/run|jog|mile/i, "run"],
  [/bike|cycle|ride/i, "bike"],
  [/swim/i, "swim"],
  [/fuel|eat|food|diet|meal|nutrition/i, "leaf"],
  [/water|hydrate/i, "water"],
  [/social|friend|people|call/i, "people"],
  [/read|book|study|bible|scripture/i, "book"],
  [/write|journal|note/i, "pen"],
  [/money|sale|business|revenue/i, "money"],
  [/sleep|bed|night/i, "moon"],
  [/morning|wake|early/i, "sunrise"],
  [/content|post|ship/i, "spark"],
];

function iconFor(label: string): string {
  for (const [re, name] of ICON_HINTS) if (re.test(label)) return name;
  return "check";
}

const norm = (s: unknown) =>
  typeof s === "string" ? s.trim().toLowerCase() : "";

interface LegacyHabit {
  id?: unknown;
  label?: unknown;
}

interface LegacyLog {
  date?: string;
  habits?: Record<string, boolean>;
  runNotes?: unknown;
  amLiftNotes?: unknown;
  pmLiftNotes?: unknown;
  win?: unknown;
  lesson?: unknown;
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
    "plungeMinutes" in o ||
    "mood" in o
  ) {
    return true;
  }
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

/** Where one old habit ends up. */
type Route =
  | { kind: "habit"; id: HabitKey }
  | { kind: "field"; field: "contentShipped" };

export interface MigrationPlan {
  /** old habit id → destination */
  routes: Record<string, Route>;
  /** Habits to add to the registry, beyond the built-ins. */
  imported: HabitDef[];
  /** Every habit id a migrated day could carry a value for. */
  targets: HabitKey[];
  folded: { from: string; to: HabitKey }[];
  dropped: string[];
}

const BUILTIN_IDS: HabitKey[] = [
  "wake",
  "phoneOff",
  "training",
  "deepWork",
  "lightsOut",
];

/** A one or two character register code, unique against what is taken. */
function codeFor(label: string, taken: Set<string>): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const candidates = [
    words[0]?.[0],
    words.map((w) => w[0]).join("").slice(0, 2),
    label.replace(/\s/g, "").slice(0, 2),
  ]
    .filter(Boolean)
    .map((c) => (c as string).toUpperCase());
  for (const c of candidates) if (!taken.has(c)) return c;
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    if (!taken.has(c)) return c;
  }
  return "?";
}

/**
 * Decide where every old habit goes, before touching a single day.
 *
 * Imported habits keep their original id, which is what lets the day logs be
 * migrated by re-keying only the ones that fold into a built-in.
 */
export function planMigration(
  bundle: unknown,
  existingOrder = BUILTIN_IDS.length,
): MigrationPlan {
  const b = (bundle ?? {}) as { habits?: unknown; daily?: unknown };
  const legacyHabits: LegacyHabit[] = Array.isArray(b.habits) ? b.habits : [];

  const routes: Record<string, Route> = {};
  const imported: HabitDef[] = [];
  const folded: { from: string; to: HabitKey }[] = [];
  const dropped: string[] = [];
  const takenCodes = new Set(["W", "Q", "T", "D", "L"]);
  let order = existingOrder;

  for (const h of legacyHabits) {
    const id = typeof h.id === "string" ? h.id : "";
    if (!id) continue;
    const label = typeof h.label === "string" && h.label.trim() ? h.label : id;
    const key = norm(label);

    const builtin = BUILTIN_BY_LABEL[key] ?? BUILTIN_BY_ID[id];
    if (builtin) {
      routes[id] = { kind: "habit", id: builtin };
      folded.push({ from: label, to: builtin });
      continue;
    }

    const field = FIELD_BY_LABEL[key];
    if (field) {
      routes[id] = { kind: "field", field };
      dropped.push(`${label} → the Content field`);
      continue;
    }

    // No equivalent: it becomes a habit here rather than being thrown away.
    const code = codeFor(label, takenCodes);
    takenCodes.add(code);
    imported.push({
      id,
      label,
      code,
      icon: iconFor(label),
      // Faithful, not inferred. The old app had no schedule, and guessing one
      // from the completion pattern would quietly turn misses into rest days —
      // exactly the laundering this app refuses to do elsewhere. Narrow it in
      // Settings → Habits, where it is a decision rather than a guess.
      days: ALL_DAYS,
      order: order++,
    });
    routes[id] = { kind: "habit", id };
  }

  const targets = [...BUILTIN_IDS, ...imported.map((h) => h.id)];
  return { routes, imported, targets, folded, dropped };
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Convert one old log into the current shape, using a prepared plan. */
export function migrateLegacyLog(
  date: string,
  input: unknown,
  plan: MigrationPlan,
): DailyLog {
  const raw = (input ?? {}) as LegacyLog;
  const oldHabits = raw.habits ?? {};

  const habits: Record<HabitKey, boolean> = {};
  /** Targets this day actually has a record for. */
  const sourced = new Set<HabitKey>();
  let contentShipped = false;

  for (const [oldId, value] of Object.entries(oldHabits)) {
    const route = plan.routes[oldId];
    if (!route) continue;
    if (route.kind === "field") {
      if (value === true) contentShipped = true;
      continue;
    }
    // OR, because two old habits can legitimately fold into one here.
    habits[route.id] = habits[route.id] === true || value === true;
    sourced.add(route.id);
  }

  // Anything this day has no record of is unknown, not failed. The old app
  // gained habits over the summer, so early days genuinely have no answer for
  // the later ones — writing those down as false is inventing a miss.
  const noData = plan.targets.filter((t) => !sourced.has(t));

  // Training detail lived in three separate note fields over there.
  const trainingNote = [str(raw.runNotes), str(raw.amLiftNotes), str(raw.pmLiftNotes)]
    .filter(Boolean)
    .join(" · ");

  // The day's reflection had two fields; keep both rather than pick one.
  const note = [str(raw.win), str(raw.lesson)].filter(Boolean).join(" — ");

  return {
    date,
    habits,
    deepWorkMinutes: 0,
    trainingNote,
    contentShipped,
    note,
    stamps: {},
    noData,
  };
}
