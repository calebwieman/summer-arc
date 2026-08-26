import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import {
  getAllHabits,
  getHabit,
  getHabits,
  isHabitScheduledOn,
  saveHabits,
  type HabitDef,
} from "./habits";
import {
  isLegacyBundle,
  isLegacyLog,
  migrateLegacyLog,
  planMigration,
} from "./migrate";
import { routineEdited, routineOverrides, setRoutineAll } from "./schedule";
import { blocksForDate } from "./schedule";
import { getPrefs, setPrefs, type Prefs } from "./prefs";
import { getTodayString } from "./today";
import type { DailyLog, HabitKey } from "./types";

const DAILY_PREFIX = "standard:daily:";
const DAILY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dailyKey(date: string) {
  return `${DAILY_PREFIX}${date}`;
}

/**
 * The daily-log shape gate. Routine blocks are validated per-element on
 * every read; the core logs — the thing the whole app is —
 * had no gate at all, so one date-less entry from a hand-edited backup
 * white-screened every surface on every launch. Guarding the readers too is
 * what un-bricks a device that is already poisoned, instead of demanding a
 * site-data wipe that costs the semester.
 */
function isDailyLog(v: unknown): v is DailyLog {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.date === "string" && DAILY_DATE_RE.test(o.date);
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getDailyLog(date: string): DailyLog | null {
  const log = read<DailyLog>(dailyKey(date));
  return log && isDailyLog(log) ? log : null;
}

export function getAllDailyLogs(): DailyLog[] {
  if (typeof window === "undefined") return [];
  const logs: DailyLog[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(DAILY_PREFIX)) continue;
    const log = read<DailyLog>(key);
    if (log && isDailyLog(log)) logs.push(log);
  }
  return logs.sort((a, b) => a.date.localeCompare(b.date));
}

export function saveDailyLog(log: DailyLog): void {
  write(dailyKey(log.date), log);
}

export function getDateRange(start: string, end: string): DailyLog[] {
  const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
  const logs: DailyLog[] = [];
  for (const day of days) {
    const log = getDailyLog(format(day, "yyyy-MM-dd"));
    if (log) logs.push(log);
  }
  return logs;
}

/** ISO date of the earliest log, or null when nothing has been logged yet. */
function earliestLogDate(): string | null {
  const logs = getAllDailyLogs();
  return logs.length > 0 ? logs[0].date : null;
}

function wasDone(date: string, habit: HabitKey): boolean {
  return getDailyLog(date)?.habits?.[habit] === true;
}

/**
 * A day counts toward a habit's denominator only when it is on or after the
 * first day anything was logged (so adopting the app mid-window isn't scored as
 * a pile of misses) and the habit is actually scheduled that day — Sunday is
 * not a training miss, and the weekend is not a deep-work miss.
 */
function isScoredDay(date: string, habit: HabitDef, since: string): boolean {
  // A day the log explicitly has no answer for is no more scoreable than an
  // unscheduled one — restored history predates habits that came later.
  if (getDailyLog(date)?.noData?.includes(habit.id)) return false;
  return date >= since && isHabitScheduledOn(habit, date);
}

/**
 * Share of scheduled days in the trailing window where the habit was done,
 * as 0–1. Today is excluded — it isn't over yet, and scoring an in-progress day
 * as a miss is just noise. A scheduled day with no log counts as a miss.
 * Returns 0 when there is nothing to score yet.
 */
export function getRollingRate(habitKey: HabitKey, days = 14): number {
  const since = earliestLogDate();
  const habit = getHabit(habitKey);
  if (!since || !habit) return 0;

  const yesterday = subDays(parseISO(getTodayString()), 1);
  let done = 0;
  let scored = 0;

  for (let i = 0; i < days; i++) {
    const date = format(subDays(yesterday, i), "yyyy-MM-dd");
    if (!isScoredDay(date, habit, since)) continue;
    scored++;
    if (wasDone(date, habitKey)) done++;
  }

  return scored === 0 ? 0 : done / scored;
}

/** How far back `hasMissedTwice` will look to find two scheduled days. */
const MISS_LOOKBACK_DAYS = 60;

/**
 * True only when the two most recent completed scheduled days were both missed.
 * This is the only failure signal in the app — there are no streaks. Today is
 * excluded, and unscheduled days are skipped rather than counted as a break, so
 * missing Saturday's long run and then Monday's run reads as twice in a row.
 */
export function hasMissedTwice(habitKey: HabitKey): boolean {
  const since = earliestLogDate();
  const habit = getHabit(habitKey);
  if (!since || !habit) return false;

  const yesterday = subDays(parseISO(getTodayString()), 1);
  const recent: boolean[] = [];

  for (let i = 0; i < MISS_LOOKBACK_DAYS && recent.length < 2; i++) {
    const date = format(subDays(yesterday, i), "yyyy-MM-dd");
    if (!isScoredDay(date, habit, since)) continue;
    recent.push(wasDone(date, habitKey));
  }

  return recent.length === 2 && !recent[0] && !recent[1];
}

/**
 * One miss behind you, and the next one makes two.
 *
 * `hasMissedTwice` fires *after* the second miss — one day too late to act on
 * the rule the whole app is named for. The window in which "never miss twice"
 * is actionable is exactly one day wide, and until now the app was silent in
 * it. Same lookback, same scored-day rule, same exclusion of today: this is
 * that function stopped one miss earlier.
 */
export function isOnTheLine(habitKey: HabitKey): boolean {
  const since = earliestLogDate();
  const habit = getHabit(habitKey);
  if (!since || !habit) return false;

  const yesterday = subDays(parseISO(getTodayString()), 1);
  const recent: boolean[] = [];

  for (let i = 0; i < MISS_LOOKBACK_DAYS && recent.length < 1; i++) {
    const date = format(subDays(yesterday, i), "yyyy-MM-dd");
    if (!isScoredDay(date, habit, since)) continue;
    recent.push(wasDone(date, habitKey));
  }

  return recent.length === 1 && !recent[0];
}

/**
 * The most recent session note before `beforeDate`. Shown while logging today's
 * training so the last workout is in view when you write this one — the thing a
 * runner actually wants at the moment of entry.
 *
 * Given a session label it looks for the last note written on a day that ran
 * the same session, and only falls back to the most recent note of any kind if
 * there isn't one. Six different training days a week is what forced this: with
 * a plain "most recent", sitting down to write Thursday's stations showed you
 * Wednesday's easy run, which tells you nothing. Comparable numbers only come
 * from comparable sessions.
 */
export function lastTrainingNote(
  beforeDate: string,
  sessionLabel?: string,
): { date: string; note: string } | null {
  const prior = getAllDailyLogs().filter(
    (l) => l.date < beforeDate && l.trainingNote?.trim(),
  );
  if (prior.length === 0) return null;

  const sameSession = sessionLabel
    ? prior.filter((l) =>
        blocksForDate(l.date).some(
          (b) => b.kind === "training" && b.label === sessionLabel,
        ),
      )
    : [];

  const pick = sameSession.length > 0 ? sameSession : prior;
  const last = pick[pick.length - 1];
  return { date: last.date, note: last.trainingNote!.trim() };
}

export interface BackupBundle {
  /**
   * 4 adds `habits`. A schema-3 file carries only days — restore it onto a
   * fresh device and every habit you had defined is missing, so its entries
   * have nothing to render them and simply vanish. Reading 3 still works; it
   * just cannot bring the registry back, because it never held it.
   *
   * 5 adds `prefs`: the theme, whether the notification prompt has been shown,
   * and when the last backup was taken. Small things, and every restore before
   * this dropped all of them on the floor. Older files still read — `importBackup`
   * refuses only on a missing `daily` and ignores what it does not recognise.
   *
   * 6 adds `routine`: the per-weekday schedule overrides. An edited semester
   * timetable is exactly the thing a device migration must not lose.
   *
   * 7 carried `gym`, the built-in lift log. That feature is gone — lifting
   * lives in Bevel now — so 7 files still read, their gym payload simply
   * ignored, and nothing writes one again.
   */
  schema: 3 | 4 | 5 | 6 | 7;
  exportedAt: string;
  /** The registry, retired habits included, so history stays readable. */
  habits?: HabitDef[];
  /** Everything that is a setting rather than a habit or a day. */
  prefs?: Prefs;
  /** Per-weekday schedule overrides, keyed "0".."6". */
  routine?: Record<string, unknown>;
  daily: Record<string, DailyLog>;
}

export function exportBackup(): BackupBundle {
  const daily: Record<string, DailyLog> = {};
  for (const log of getAllDailyLogs()) daily[log.date] = log;
  const exportedAt = new Date().toISOString();
  // Taking a backup is the event worth remembering, so it is recorded here
  // rather than by the button — every path out of the app goes through this.
  const prefs = setPrefs({ lastBackupAt: exportedAt });
  return {
    schema: 7,
    exportedAt,
    habits: getAllHabits(),
    prefs,
    routine: routineOverrides(),
    daily,
  };
}

export function importBackup(
  bundle: unknown,
  { merge = true }: { merge?: boolean } = {},
): { daily: number; migrated: number; habitsAdded: string[] } {
  if (typeof window === "undefined")
    return { daily: 0, migrated: 0, habitsAdded: [] };
  if (!bundle || typeof bundle !== "object") throw new Error("Invalid backup file");
  const b = bundle as Partial<BackupBundle>;
  if (!b.daily || typeof b.daily !== "object") throw new Error("Invalid backup file");

  if (!merge) clearAllLogs();

  // A backup from the old summer-arc app uses different habit ids and fields;
  // written through as-is it would read as every habit missed on every day.
  const legacy = isLegacyBundle(bundle);

  // Plan first, so every day is migrated against one consistent routing and
  // habits the old app had but this one does not are installed rather than
  // discarded. Existing definitions win: restoring must never rewrite the
  // habits you are already tracking.
  const existing = getAllHabits();
  const known = new Set(existing.map((h) => h.id));
  const plan = legacy ? planMigration(bundle, existing.length) : null;
  const habitsAdded: string[] = [];

  if (plan && plan.imported.length > 0) {
    const fresh = plan.imported.filter((h) => !known.has(h.id));
    if (fresh.length > 0) {
      saveHabits([...existing, ...fresh]);
      habitsAdded.push(...fresh.map((h) => h.label));
    }
  } else if (!legacy && Array.isArray(b.habits)) {
    // A schema-4 backup of this app's own. Definitions already here win —
    // restoring must never overwrite how you have since tuned a habit — but
    // anything the file knows about and this device does not comes back, or
    // its days would restore with nothing able to display them.
    const fresh = (b.habits as HabitDef[]).filter(
      (h) => h && typeof h.id === "string" && !known.has(h.id),
    );
    if (fresh.length > 0) {
      saveHabits([...existing, ...fresh]);
      habitsAdded.push(...fresh.map((h) => h.label ?? h.id));
    }
  }

  // Existing wins, exactly as with habits: a device that has already shaped
  // its week keeps it; a fresh device takes the file's.
  if (!legacy && b.routine && typeof b.routine === "object") {
    const hasOwn = ([0, 1, 2, 3, 4, 5, 6] as const).some((d) =>
      routineEdited(d),
    );
    if (!hasOwn) setRoutineAll(b.routine);
  }

  let count = 0;
  let migrated = 0;
  for (const [date, log] of Object.entries(b.daily)) {
    if (!log || typeof log !== "object" || !DAILY_DATE_RE.test(date)) continue;
    if (plan && (legacy || isLegacyLog(log))) {
      write(dailyKey(date), migrateLegacyLog(date, log, plan));
      migrated += 1;
    } else {
      // The key is the truth: stamping it onto the log repairs entries whose
      // own date is missing or disagrees, instead of persisting the poison.
      write(dailyKey(date), { ...(log as DailyLog), date });
    }
    count += 1;
  }
  // Settings a restore used to drop on the floor: the theme, whether the
  // notification prompt has been answered, and when the file itself was taken.
  if (b.prefs && typeof b.prefs === "object") setPrefs(b.prefs);

  return { daily: count, migrated, habitsAdded };
}

export function clearAllLogs(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(DAILY_PREFIX)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) window.localStorage.removeItem(key);
}

/** Flat CSV of every daily log, one row per day. */
export function exportCsv(): string {
  // Columns follow the registry, retired habits included, so a spreadsheet of
  // last month still has a column for the habit you dropped last week.
  const habits = getHabits();
  const cols = [
    "date",
    "run_miles",
    "run_minutes",
    "deep_work_minutes",
    "content_shipped",
    "training_note",
    "note",
    ...habits.map((h) => `habit:${h.label}`),
  ];
  const rows = getAllDailyLogs().map((log) => [
    log.date,
    log.runMiles ?? "",
    log.runMinutes ?? "",
    log.deepWorkMinutes || "",
    log.contentShipped ? "1" : "",
    log.trainingNote ?? "",
    log.note ?? "",
    ...habits.map((h) => (log.habits?.[h.id] ? "1" : "")),
  ]);
  return [cols, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
