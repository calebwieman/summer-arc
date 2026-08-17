import type { DayBlock, DayModel } from "./day";

/**
 * Focus + context sizing for the spine. Heights are deliberately continuous in
 * time so an upcoming block swells smoothly as it approaches instead of
 * snapping between tiers.
 */

/** A block that has already ended — a dimmed hairline record. */
export const H_PAST = 34;
/** Floor for something far out in the day. */
export const H_UPCOMING_MIN = 40;
/** Ceiling for the thing about to start. */
export const H_UPCOMING_MAX = 104;
/** Minutes out at which a block starts visibly growing. */
export const APPROACH_HORIZON = 150;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Smoothstep — eases in and out, so growth has no visible corner. */
function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** How close to starting, 0 (far) → 1 (starting now). */
export function approach(untilStart: number): number {
  return smoothstep(1 - clamp01(untilStart / APPROACH_HORIZON));
}

export function upcomingHeight(untilStart: number): number {
  return H_UPCOMING_MIN + (H_UPCOMING_MAX - H_UPCOMING_MIN) * approach(untilStart);
}

/**
 * Target height for a non-expanded block. The expanded (focused) block is
 * intentionally not sized here — it lays out naturally from its content so it
 * can hold a latch, a field, and the now-line without being clipped.
 */
export function collapsedHeight(b: DayBlock): number {
  return b.phase === "past" ? H_PAST : upcomingHeight(b.untilStart);
}

/**
 * Which block renders expanded. In a gap (or before the day starts) the next
 * block takes focus so the screen always has a subject; once the day is over
 * nothing is expanded and the closing summary takes over.
 */
export function expandedIndex(day: DayModel): number {
  if (day.state === "after" && day.graceIndex < 0) return -1;
  return day.focusIndex;
}

/** Total height of the collapsed context, for scroll/fit reasoning. */
export function contextHeight(day: DayModel): number {
  const expanded = expandedIndex(day);
  return day.blocks.reduce(
    (sum, b, i) => (i === expanded ? sum : sum + collapsedHeight(b)),
    0,
  );
}
