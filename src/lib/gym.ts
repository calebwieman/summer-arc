import { format, parseISO, startOfWeek, subWeeks } from "date-fns";
import type { Weekday } from "./schedule";
import { weekdayOf } from "./schedule";

/**
 * The gym log.
 *
 * Bevel's job, done inside Standard: every set of every lift, written down at
 * the rack with two thumbs. The run already gets numbers because numbers are
 * what can be charted; this gives the iron the same treatment. A session is a
 * dated list of exercises, an exercise is a list of committed sets, and a set
 * is weight × reps with an optional RPE — nothing more, because nothing more
 * survives being entered between sets with a barbell waiting.
 *
 * Storage follows the daily-log pattern exactly: one localStorage key per
 * session under a scannable prefix, so a single corrupt write can never take
 * the history with it, and `getAllSessions` is a prefix scan rather than an
 * index that can drift. The active (unfinished) session is a pointer, not a
 * copy — force-quit the PWA mid-workout and the next open resumes it.
 */

/* ------------------------------------------------------------------ types */

export interface GymSet {
  /** Pounds. 0 is legal — bodyweight and machine-metered work (SkiErg cals). */
  weight: number;
  reps: number;
  /** 6–10, halves allowed. Absent = not rated. */
  rpe?: number;
  /** Epoch ms when the set was committed. Drives the rest timer. */
  at?: number;
  /**
   * Stamped at commit when this set's estimated 1RM beat everything that
   * came before it. Stored rather than derived so the flag survives later
   * sessions raising the bar — a PR is a fact about the day it happened.
   */
  pr?: boolean;
}

export interface GymExercise {
  /** The identity key. Free text, matched exactly across sessions. */
  name: string;
  sets: GymSet[];
  /** Per-plan prescription, carried so the logger can show "5×5". */
  target?: { sets: number; reps: number };
  /** The plan's guidance line ("per leg", "reps = meters"), seeded at start. */
  note?: string;
  /** What the lifter wrote about it — "grip gave out set 4". Theirs, not ours. */
  userNote?: string;
}

export interface GymSession {
  /** `${date}·${startedAt}` — unique without a random source. */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** "Lower (heavy)", "Engine", … or "Freestyle" off-plan. */
  label: string;
  startedAt: number;
  /** Absent while the session is live. */
  endedAt?: number;
  exercises: GymExercise[];
  /** Session RPE, 6–10 — the recovery dial, asked once at the end. */
  rpe?: number;
  note?: string;
}

/* ---------------------------------------------------------------- program */

export interface PlannedExercise {
  name: string;
  sets: number;
  reps: number;
  /** Load/format guidance shown under the name, not enforced. */
  note?: string;
}

export interface SessionPlan {
  label: string;
  /** One line of intent, shown on the surface card. */
  focus: string;
  exercises: PlannedExercise[];
}

/**
 * The five morning sessions, keyed by weekday. This mirrors the calendar and
 * `schedule.ts` — the schedule says *when* (Lift, 6:00–7:45) and carries the
 * brief; this says *what*, at set-and-rep resolution, because the logger
 * pre-builds the day's card from it. Weekends are absent on purpose: Saturday
 * is the long run and Sunday is recovery, and an empty plan still lets a
 * freestyle session be logged.
 */
export const WEEK_PLAN: Partial<Record<Weekday, SessionPlan>> = {
  1: {
    label: "Lower (heavy)",
    focus: "squat heavy, hinge hard — the week starts under a bar",
    exercises: [
      { name: "Back Squat", sets: 5, reps: 5, note: "top set near RPE 8" },
      { name: "Romanian Deadlift", sets: 4, reps: 8 },
      { name: "Bulgarian Split Squat", sets: 3, reps: 8, note: "per leg" },
      { name: "Leg Press", sets: 3, reps: 12 },
      { name: "Standing Calf Raise", sets: 4, reps: 12 },
      { name: "Hanging Leg Raise", sets: 3, reps: 12, note: "bodyweight — log 0" },
    ],
  },
  2: {
    label: "Upper push",
    focus: "press volume — bench leads, shoulders finish",
    exercises: [
      { name: "Bench Press", sets: 5, reps: 5, note: "top set near RPE 8" },
      { name: "Incline DB Press", sets: 4, reps: 8 },
      { name: "Seated DB Press", sets: 4, reps: 8 },
      { name: "Weighted Dip", sets: 3, reps: 8, note: "added lb only — 0 if bodyweight" },
      { name: "Lateral Raise", sets: 4, reps: 15 },
      { name: "Triceps Pushdown", sets: 3, reps: 12 },
    ],
  },
  3: {
    label: "Engine",
    focus: "HYROX sim — stations at effort, jog the transitions",
    exercises: [
      { name: "Sled Push", sets: 4, reps: 25, note: "reps = meters · log the sled load" },
      { name: "Sled Pull", sets: 4, reps: 25, note: "reps = meters" },
      { name: "SkiErg", sets: 4, reps: 15, note: "reps = calories · weight 0" },
      { name: "Wall Balls", sets: 4, reps: 20, note: "14 lb to the line" },
      { name: "Farmer Carry", sets: 4, reps: 40, note: "reps = meters · per-hand load" },
      { name: "Burpee Broad Jump", sets: 3, reps: 10, note: "weight 0" },
    ],
  },
  4: {
    label: "Upper pull",
    focus: "back width and thickness — earn the pull-ups",
    exercises: [
      { name: "Weighted Pull-Up", sets: 5, reps: 5, note: "added lb only — 0 if bodyweight" },
      { name: "Barbell Row", sets: 4, reps: 8 },
      { name: "Lat Pulldown", sets: 3, reps: 10 },
      { name: "Face Pull", sets: 4, reps: 15 },
      { name: "EZ-Bar Curl", sets: 4, reps: 10 },
      { name: "Hammer Curl", sets: 3, reps: 12 },
    ],
  },
  5: {
    label: "Full body",
    focus: "pull from the floor, press overhead — the week's receipts",
    exercises: [
      { name: "Deadlift", sets: 5, reps: 3, note: "heavy triples, clean form" },
      { name: "Front Squat", sets: 4, reps: 6 },
      { name: "Push Press", sets: 4, reps: 6 },
      { name: "Chin-Up", sets: 3, reps: 8, note: "AMRAP the last set" },
      { name: "DB Row", sets: 3, reps: 10 },
      { name: "Ab Wheel", sets: 3, reps: 12, note: "weight 0" },
    ],
  },
};

/** Today's plan, or null on a run day. */
export function planForDate(date: string): SessionPlan | null {
  return WEEK_PLAN[weekdayOf(date)] ?? null;
}

/* ---------------------------------------------------------------- storage */

const SESSION_PREFIX = "standard:gym:session:";
const ACTIVE_KEY = "standard:gym:active:v1";
const CUSTOM_KEY = "standard:gym:exercises:v1";
/** Fired after any write so open surfaces re-read without prop drilling. */
export const GYM_CHANGED = "standard:gym-changed";

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

function notify(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(GYM_CHANGED));
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isGymSet(v: unknown): v is GymSet {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.weight === "number" &&
    Number.isFinite(o.weight) &&
    typeof o.reps === "number" &&
    Number.isFinite(o.reps)
  );
}

function isGymExercise(v: unknown): v is GymExercise {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.name === "string" && Array.isArray(o.sets) && o.sets.every(isGymSet)
  );
}

/**
 * Shape check for anything read back from storage or a backup file.
 *
 * Element-deep, like `isRoutineBlock` — the top-level fields alone are not
 * the guard's job. This is the single gate for every read *and* the backup
 * import, so one malformed session (a hand-edited file, a truncated write)
 * reads back as null and is skipped, instead of being persisted and then
 * throwing from `sessionTonnage` on every render until storage is cleared.
 */
export function isGymSession(v: unknown): v is GymSession {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.date === "string" &&
    DATE_RE.test(o.date) &&
    typeof o.label === "string" &&
    typeof o.startedAt === "number" &&
    Number.isFinite(o.startedAt) &&
    Array.isArray(o.exercises) &&
    o.exercises.every(isGymExercise)
  );
}

export function getSession(id: string): GymSession | null {
  const s = read<GymSession>(SESSION_PREFIX + id);
  return s && isGymSession(s) ? s : null;
}

/** Every session ever logged, ascending by start time. */
export function getAllSessions(): GymSession[] {
  if (typeof window === "undefined") return [];
  const out: GymSession[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(SESSION_PREFIX)) continue;
    const s = read<GymSession>(key);
    if (s && isGymSession(s)) out.push(s);
  }
  return out.sort((a, b) => a.startedAt - b.startedAt);
}

export function saveSession(s: GymSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_PREFIX + s.id, JSON.stringify(s));
  notify();
}

export function deleteSession(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_PREFIX + id);
  if (activeSessionId() === id) setActiveSession(null);
  notify();
}

/** The unfinished session's id, if the pointer still points at a real one. */
export function activeSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(ACTIVE_KEY);
  if (!id) return null;
  const s = getSession(id);
  // A finished or vanished session must not hold the pointer hostage.
  if (!s || s.endedAt != null) {
    window.localStorage.removeItem(ACTIVE_KEY);
    return null;
  }
  return id;
}

export function setActiveSession(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
}

/** Open a fresh session — from the day's plan, or empty for a freestyle. */
export function startSession(date: string, plan: SessionPlan | null): GymSession {
  const startedAt = Date.now();
  const s: GymSession = {
    id: `${date}·${startedAt}`,
    date,
    label: plan?.label ?? "Freestyle",
    startedAt,
    exercises: (plan?.exercises ?? []).map((e) => ({
      name: e.name,
      sets: [],
      target: { sets: e.sets, reps: e.reps },
      note: e.note,
    })),
  };
  saveSession(s);
  setActiveSession(s.id);
  return s;
}

/** Names the user has added beyond the program, kept so they stay offered. */
export function getCustomExercises(): string[] {
  const v = read<unknown>(CUSTOM_KEY);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function addCustomExercise(name: string): void {
  if (typeof window === "undefined") return;
  const t = name.trim();
  if (!t) return;
  const have = getCustomExercises();
  if (have.some((n) => n.toLowerCase() === t.toLowerCase())) return;
  window.localStorage.setItem(CUSTOM_KEY, JSON.stringify([...have, t]));
}

/**
 * Every exercise name this device knows: the program's, the user's own, and
 * anything that has ever appeared in a logged session — so a freestyle day
 * offers the whole vocabulary, not just today's plan.
 */
export function knownExercises(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (n: string) => {
    const k = n.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(n);
  };
  for (const plan of Object.values(WEEK_PLAN)) {
    for (const e of plan.exercises) push(e.name);
  }
  for (const n of getCustomExercises()) push(n);
  for (const s of getAllSessions()) for (const e of s.exercises) push(e.name);
  return out;
}

/* ------------------------------------------------------------------ stats */

/**
 * Epley estimated 1RM. The standard the whole strength internet quotes, and
 * fine for its one job here: making a 185×8 comparable to a 205×5. Above
 * twelve reps the estimate is fiction, so it degrades to the lift itself —
 * a set of twenty wall balls is work, not a max attempt.
 */
export function epley(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  if (reps > 12) return weight;
  return weight * (1 + reps / 30);
}

/** Pounds moved: Σ weight × reps over committed sets. */
export function sessionTonnage(s: GymSession): number {
  let t = 0;
  for (const e of s.exercises) for (const set of e.sets) t += set.weight * set.reps;
  return Math.round(t);
}

export function sessionSetCount(s: GymSession): number {
  let n = 0;
  for (const e of s.exercises) n += e.sets.length;
  return n;
}

/** "12,450" — tonnage is the one number here big enough to need commas. */
export function formatLbs(n: number): string {
  return n.toLocaleString("en-US");
}

/** Elapsed "47m" / "1h 32m" between two epoch stamps. */
export function formatElapsed(fromMs: number, toMs: number): string {
  const m = Math.max(0, Math.round((toMs - fromMs) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/** Finished sessions only — the record is what was completed. */
function finished(): GymSession[] {
  return getAllSessions().filter((s) => s.endedAt != null);
}

/**
 * The best estimated 1RM for an exercise across every finished session that
 * started before `beforeMs`. This is what a set at the rack is judged against
 * — the bar as it stood when the session began, so two PRs in one session
 * both read as PRs against history rather than the second erasing the first.
 */
export function bestBefore(
  name: string,
  beforeMs: number,
): { e1: number; weight: number; reps: number } | null {
  const k = name.toLowerCase();
  let best: { e1: number; weight: number; reps: number } | null = null;
  for (const s of finished()) {
    if (s.startedAt >= beforeMs) continue;
    for (const e of s.exercises) {
      if (e.name.toLowerCase() !== k) continue;
      for (const set of e.sets) {
        const e1 = epley(set.weight, set.reps);
        if (e1 > 0 && (!best || e1 > best.e1)) {
          best = { e1, weight: set.weight, reps: set.reps };
        }
      }
    }
  }
  return best;
}

/**
 * The ghost: what this exercise looked like the last time it was done, in
 * set order. Prefills the logger so a normal day is confirm-taps rather than
 * typing — the single thing that makes phone logging faster than paper.
 */
export function lastSets(name: string, beforeMs: number): GymSet[] | null {
  const k = name.toLowerCase();
  const sessions = finished();
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (s.startedAt >= beforeMs) continue;
    for (const e of s.exercises) {
      if (e.name.toLowerCase() === k && e.sets.length > 0) return e.sets;
    }
  }
  return null;
}

export interface ExercisePoint {
  date: string;
  /** "Tue 8/25" */
  label: string;
  /** Best estimated 1RM that day. */
  e1: number;
  /** The set behind it, for the caption. */
  weight: number;
  reps: number;
}

/** Best e1RM per finished session, ascending — the strength trend line. */
export function exerciseTrend(name: string, maxPoints = 12): ExercisePoint[] {
  const k = name.toLowerCase();
  const out: ExercisePoint[] = [];
  for (const s of finished()) {
    let best: ExercisePoint | null = null;
    for (const e of s.exercises) {
      if (e.name.toLowerCase() !== k) continue;
      for (const set of e.sets) {
        const e1 = epley(set.weight, set.reps);
        if (e1 > 0 && (!best || e1 > best.e1)) {
          best = {
            date: s.date,
            label: format(parseISO(s.date), "EEE M/d"),
            e1: Math.round(e1),
            weight: set.weight,
            reps: set.reps,
          };
        }
      }
    }
    if (best) out.push(best);
  }
  return out.slice(-maxPoints);
}

export interface ExerciseSummary {
  name: string;
  /** All-time best estimated 1RM, rounded. */
  bestE1: number;
  bestWeight: number;
  bestReps: number;
  /** ISO date last performed. */
  lastDate: string;
  timesDone: number;
}

/** Every exercise ever logged, best-first — the records board. */
export function exerciseSummaries(): ExerciseSummary[] {
  const byName = new Map<string, ExerciseSummary>();
  for (const s of finished()) {
    for (const e of s.exercises) {
      if (e.sets.length === 0) continue;
      const key = e.name.toLowerCase();
      let sum = byName.get(key);
      if (!sum) {
        sum = {
          name: e.name,
          bestE1: 0,
          bestWeight: 0,
          bestReps: 0,
          lastDate: s.date,
          timesDone: 0,
        };
        byName.set(key, sum);
      }
      sum.timesDone += 1;
      if (s.date > sum.lastDate) sum.lastDate = s.date;
      for (const set of e.sets) {
        const e1 = epley(set.weight, set.reps);
        if (e1 > sum.bestE1) {
          sum.bestE1 = Math.round(e1);
          sum.bestWeight = set.weight;
          sum.bestReps = set.reps;
        }
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.bestE1 - a.bestE1);
}

export interface WeekTonnage {
  /** ISO date of the Monday. */
  start: string;
  /** "8/24" */
  label: string;
  lbs: number;
  isCurrent: boolean;
}

/**
 * Tonnage per Monday-anchored week — the same window and anchoring as the
 * mileage bars, so the two load charts in the app agree about what a week is.
 */
export function weeklyTonnage(today: string, weeksBack = 8): WeekTonnage[] {
  const mondayOf = (d: string) =>
    format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const byWeek = new Map<string, number>();
  for (const s of finished()) {
    if (s.date > today) continue;
    const wk = mondayOf(s.date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + sessionTonnage(s));
  }
  const currentMonday = mondayOf(today);
  const weeks: WeekTonnage[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const start = format(subWeeks(parseISO(currentMonday), i), "yyyy-MM-dd");
    weeks.push({
      start,
      label: format(parseISO(start), "M/d"),
      lbs: Math.round(byWeek.get(start) ?? 0),
      isCurrent: start === currentMonday,
    });
  }
  return weeks;
}

export interface PrLine {
  date: string;
  exercise: string;
  weight: number;
  reps: number;
  e1: number;
}

/** The most recent PR sets, newest first — the surface's trophy shelf. */
export function recentPRs(limit = 3): PrLine[] {
  const out: PrLine[] = [];
  for (const s of finished()) {
    for (const e of s.exercises) {
      for (const set of e.sets) {
        if (!set.pr) continue;
        out.push({
          date: s.date,
          exercise: e.name,
          weight: set.weight,
          reps: set.reps,
          e1: Math.round(epley(set.weight, set.reps)),
        });
      }
    }
  }
  return out.reverse().slice(0, limit);
}

export interface RecoverySignal {
  /** This week's tonnage vs last week's, as a signed percent. Null early. */
  tonnagePct: number | null;
  /** Mean session RPE across the last 7 days of finished sessions. */
  avgRpe: number | null;
  /** One line of judgement, already worded. */
  line: string | null;
  /** True when the line is a warning rather than a note. */
  warn: boolean;
}

/**
 * The recovery dial. He asked to be smoked and to watch recovery closely —
 * so the app does the watching: a >20% week-over-week tonnage jump is the
 * classic overreach threshold, and a rolling session-RPE at the ceiling means
 * nothing left in reserve. Neither stops anything; they just get named.
 */
export function recoverySignal(today: string): RecoverySignal {
  const weeks = weeklyTonnage(today, 3);
  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const tonnagePct =
    prev && prev.lbs > 0 ? Math.round(((cur.lbs - prev.lbs) / prev.lbs) * 100) : null;

  const cutoff = parseISO(today).getTime() - 7 * 86400000;
  const rated = finished().filter((s) => s.rpe != null && s.startedAt >= cutoff);
  const avgRpe =
    rated.length > 0
      ? Math.round((rated.reduce((a, s) => a + (s.rpe as number), 0) / rated.length) * 10) / 10
      : null;

  let line: string | null = null;
  let warn = false;
  if (tonnagePct != null && tonnagePct > 20) {
    line = `tonnage +${tonnagePct}% vs last week — big jump, sleep like it matters`;
    warn = true;
  } else if (avgRpe != null && avgRpe >= 9) {
    line = `avg session RPE ${avgRpe} this week — nothing in reserve, back off before it backs you off`;
    warn = true;
  } else if (tonnagePct != null || avgRpe != null) {
    const parts: string[] = [];
    if (tonnagePct != null)
      parts.push(`tonnage ${tonnagePct >= 0 ? "+" : ""}${tonnagePct}% wk/wk`);
    if (avgRpe != null) parts.push(`avg RPE ${avgRpe}`);
    line = parts.join(" · ");
  }
  return { tonnagePct, avgRpe, line, warn };
}
