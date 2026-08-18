/**
 * The spring vocabulary.
 *
 * There used to be twelve springs in this app and seven of them sat inside
 * noise of each other — 300/34, 300/30, 320/32, 320/34, 300/26, 260/30. They
 * were not chosen to do different jobs; they were typed on different days. The
 * result was an app where the page change, the wheel and the seat all moved at
 * the same rate and none of them overshot at all: every one of those three was
 * critically or overdamped, so nothing in the build ever visibly settled.
 *
 * Four springs now, and one rule behind them: **the larger the object, the
 * slower it moves and the less it bounces.** A whole surface is the heaviest
 * thing here and should be the slowest; a chip is the lightest and can snap.
 *
 *   ω   13.9 → 18.3 → 24.8 → 31.6 rad/s   (a clean ~1.34× step)
 *   ζ   0.90 → 0.70 → 0.70 → 0.62         (bouncier as things get smaller)
 *
 * Expressed as visualDuration/bounce rather than stiffness/damping because
 * that is the parameterisation you can actually reason about: visualDuration
 * is roughly how long it takes to look finished, and `bounce` is 1 − ζ. The
 * stiffness/damping equivalents are noted so the numbers stay checkable.
 */

/** Whole screens. The heaviest thing in the app, so the slowest. */
export const SURFACE = {
  type: "spring",
  visualDuration: 0.44,
  bounce: 0.1,
} as const; // ≈ 230/30/1.2 · ω 13.9 · ζ 0.90

/** The focus card taking the seat. Lands with weight rather than stopping. */
export const SEAT = {
  type: "spring",
  visualDuration: 0.34,
  bounce: 0.3,
} as const; // ≈ 300/23/0.9 · ω 18.3 · ζ 0.70 · 4.6% overshoot

/** Rows on the wheel, and the register's marker. Quick, with a real detent. */
export const ROW = {
  type: "spring",
  visualDuration: 0.24,
  bounce: 0.3,
} as const; // ≈ 460/26/0.75 · ω 24.8 · ζ 0.70 · 4.6% overshoot

/** Chips, glyphs, small confirmations. The only things allowed to snap. */
export const TICK = {
  type: "spring",
  visualDuration: 0.18,
  bounce: 0.38,
} as const; // ≈ 700/27/0.7 · ω 31.6 · ζ 0.62 · 8.5% overshoot

/**
 * The register's notch.
 *
 * Deliberately outside the ladder, and the one place a number is picked for a
 * single effect rather than for a family. `haptics.ts` is honest that iOS
 * Safari has no vibration API, so on the actual target device the scrub's
 * detent has no feedback at all unless it is visible. At ζ 0.58 the marker
 * overshoots ~11%, which on the 27px glyph pitch is about three pixels past
 * the letter and back — the amplitude at which the eye reads "notch" rather
 * than "wobble". The marker snapping past and returning *is* the click.
 */
export const NOTCH = {
  type: "spring",
  stiffness: 620,
  damping: 24,
  mass: 0.7,
} as const; // ω 29.8 · ζ 0.576 · 10.9% overshoot · ~230ms

/**
 * Impact easing. Fast leading edge, long absorption — the asymmetry is what
 * makes a recoil read as a hit rather than as a wobble.
 */
export const IMPACT = [0.22, 1, 0.36, 1] as const;

/** Decelerate-only, for sweeps and counts that should never bounce. */
export const SWEEP = [0.16, 1, 0.3, 1] as const;
