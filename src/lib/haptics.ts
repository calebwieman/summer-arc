/**
 * Best-effort haptics.
 *
 * HONEST LIMITATION: iOS Safari — including installed PWAs — does not implement
 * the Vibration API, and there is no JS haptics API available to a web app on
 * iPhone. The `<input type="checkbox" switch>` trick only fires taptics for a
 * direct user tap on the control, not for programmatic toggles or drag gestures,
 * so it is not usable for a drag-to-commit latch.
 *
 * On iPhone the "weight" of a commit therefore has to be carried entirely by the
 * visual/physical choreography — spring mass, travel, detent, settle. This
 * function is a real enhancement on Android and a silent no-op on iOS rather
 * than a pretend one.
 */
export function haptic(pattern: number | number[] = 14): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(pattern);
  } catch {
    /* never let feedback break an interaction */
  }
}

/** A firm double-thunk for committing. */
export const HAPTIC_COMMIT: number[] = [18, 28, 12];
/** A lighter tick for releasing/undoing. */
export const HAPTIC_RELEASE = 10;
