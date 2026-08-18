"use client";

import { useCallback, useRef } from "react";
import { animate, type MotionValue } from "motion/react";

/**
 * The horizontal axis of the surface grid.
 *
 * Deliberately **not** a second Motion drag axis, and the reasons are specific
 * rather than cautious:
 *
 * 1. Motion's drag lock is global and takes both axes at once. Asking the
 *    surface stack for `drag={true}` means a descendant that is itself a
 *    `drag="x"` element — the latch carriage, dead centre of the seat card and
 *    squarely in the thumb arc — claims the lock first at the same three-pixel
 *    threshold, and the stack's own drag then early-returns before it ever
 *    starts. A vertical swipe beginning on a latch would silently stop opening
 *    the record. No error, no visible cause.
 * 2. `dragElastic` is resolved per side. The stack declares only `top` and
 *    `bottom`, so an x axis would resolve to zero elastic and the surface would
 *    not move a pixel sideways — which looks exactly like a feature that was
 *    never wired up.
 * 3. `dragDirectionLock` costs ten pixels of dead travel on the app's oldest
 *    gesture and resolves a true diagonal to vertical, which is the wrong bias
 *    for a control you reach with a thumb.
 *
 * So this is raw pointer handlers taking no drag lock at all — the same pattern
 * the register scrub has used since it was written, one level up the tree.
 *
 * ## How one finger can only ever produce one outcome
 *
 * Three mechanisms, none of them new:
 *
 * - **Arming.** Anything that owns horizontal touch marks itself
 *   `data-deck="off"`. The test is DOM ancestry, not coordinates, so it
 *   survives every future layout change and needs no coordination between
 *   consumers. Over a disarmed element the deck is inert for the whole life of
 *   the gesture: it does not decide, claim, or move.
 * - **Ordering.** The register decides at ten pixels, this decides at fourteen,
 *   and Motion's drag starts at three. So `claimed` is always cleared by the
 *   drag before either of the other two sets it.
 * - **The claim.** When this takes a gesture it writes the same `claimed` ref
 *   the register already writes, and the stack's drag-end already returns early
 *   on it. The vertical commit is suppressed through a mechanism that has
 *   shipped and been debugged.
 */

/** Finger travel that commits a column change. Matches the vertical's. */
export const COL_COMMIT = 72;

/** Pixels of movement before the axis is decided, once, for the gesture. */
const DECIDE_AT = 14;

/**
 * How far off horizontal a gesture may be and still count as horizontal.
 * 1.4 is a ±35.5° cone, deliberately narrower than the register's ±59°: the
 * vertical is the app's oldest gesture and an ambiguous thumb diagonal should
 * resolve to the behaviour that already exists.
 */
const CONE = 1.4;

export interface DeckOptions {
  /** Drives the surface sideways under the finger. */
  x: MotionValue<number>;
  /** True when there is a page in that direction; false at an end. */
  hasNeighbour: (dir: -1 | 1) => boolean;
  /** Commit a column change. `dir` is -1 for a leftward finger, +1 rightward. */
  onCommit: (dir: -1 | 1) => void;
  /** Shared with the register and the stack drag — see the note above. */
  claimed: React.RefObject<boolean>;
  /** Raised while this owns the gesture. */
  onLive: (active: boolean) => void;
  /** False while a sheet is open, or under reduced motion. */
  enabled: boolean;
}

export function useDeck({
  x,
  hasNeighbour,
  onCommit,
  claimed,
  onLive,
  enabled,
}: DeckOptions) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const verdict = useRef<null | "h" | "pass">(null);
  const armed = useRef(false);
  /** A horizontal commit must not also fire the button it started on. */
  const swallowClick = useRef(false);

  const reset = useCallback(() => {
    origin.current = null;
    verdict.current = null;
    armed.current = false;
  }, []);

  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      // Capture phase: a descendant calling stopPropagation would otherwise
      // disarm the deck for its whole subtree, silently and with no error.
      const el = e.target as HTMLElement | null;
      armed.current =
        enabled && !el?.closest('[data-deck="off"]');
      origin.current = { x: e.clientX, y: e.clientY };
      verdict.current = null;
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const o = origin.current;
      if (!o || !armed.current) return;
      const dx = e.clientX - o.x;
      const dy = e.clientY - o.y;

      if (verdict.current == null) {
        if (Math.hypot(dx, dy) < DECIDE_AT) return;
        verdict.current =
          Math.abs(dx) > Math.abs(dy) * CONE ? "h" : "pass";
        if (verdict.current === "h") {
          claimed.current = true;
          onLive(true);
        }
      }
      if (verdict.current !== "h") return;

      // The same two elastics the vertical uses, applied by hand rather than
      // through `dragElastic` — which is how trap (2) above stays unreachable.
      const dir = (dx < 0 ? -1 : 1) as -1 | 1;
      x.set(dx * (hasNeighbour(dir) ? 0.22 : 0.06));
    },
    [x, hasNeighbour, claimed, onLive],
  );

  const finish = useCallback(
    (e: React.PointerEvent) => {
      const o = origin.current;
      const owned = verdict.current === "h";
      if (owned && o) {
        const dx = e.clientX - o.x;
        const dir = (dx < 0 ? -1 : 1) as -1 | 1;
        if (Math.abs(dx) > COL_COMMIT && hasNeighbour(dir)) onCommit(dir);
        swallowClick.current = true;
        onLive(false);
      }
      animate(x, 0, { type: "spring", stiffness: 700, damping: 44, mass: 0.8 });
      reset();
    },
    [x, hasNeighbour, onCommit, onLive, reset],
  );

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    // A commit that began on a year-trace mark or a month cell would otherwise
    // fire that button on release. The register solved this with `scrubbed`;
    // this is the same idea, generalised to the whole surface.
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return {
    onPointerDownCapture,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
    onClickCapture,
  };
}
