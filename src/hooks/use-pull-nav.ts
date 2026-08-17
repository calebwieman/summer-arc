"use client";

import { useEffect, type RefObject } from "react";

/**
 * Pull-to-navigate for a surface that also scrolls.
 *
 * The stack used one `drag="y"` on a shared ancestor. That works on the day
 * screen and silently fails on the record and history, and the reason is touch
 * arbitration rather than anything in our handlers: Motion marks the drag
 * container `touch-action: pan-x` so vertical touches belong to JS, but those
 * two surfaces are `overflow-y: auto`, and the browser hands a vertical touch
 * to the nearest scrolling box without ever consulting the ancestor. The pane
 * does not even have to overflow — being a scroll box is enough. Mouse drags
 * skip that arbitration entirely, which is why it only reproduced on a phone.
 *
 * So the scrolling surfaces get their own gesture, driven from touch events on
 * the pane itself and only armed at an edge: pulling down when already at the
 * top, or up when already at the bottom. Anywhere else the browser keeps the
 * gesture and the surface just scrolls, which is what a scroll container should
 * do. `preventDefault` on the armed axis is what stops iOS rubber-banding the
 * pane instead of letting the pull read.
 */
export function usePullNav(
  ref: RefObject<HTMLElement | null>,
  opts: {
    enabled: boolean;
    /** Pulled down while already at the top. */
    onPullDown?: () => void;
    /** Pulled up while already at the bottom. */
    onPullUp?: () => void;
    /** Travel in px before a pull counts. */
    threshold?: number;
  },
) {
  const { enabled, onPullDown, onPullUp, threshold = 72 } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startY = 0;
    let dy = 0;
    let armed: 0 | 1 | -1 = 0;
    let tracking = false;
    /** Direction is settled on the first move and held for the gesture. */
    let decided = false;
    /**
     * Which directions this gesture is allowed to navigate, decided once when
     * the finger lands. Re-testing the edge on every move turned an ordinary
     * scroll into a navigation: swipe up through a long page, hit the bottom
     * mid-swipe, and the same gesture that was scrolling suddenly armed and
     * threw you back a surface. Where the finger started is the honest signal.
     */
    let canDown = false;
    let canUp = false;

    const atTop = () => el.scrollTop <= 0;
    // -1 for sub-pixel scroll heights, which otherwise never satisfy equality.
    const atBottom = () =>
      el.scrollTop >= el.scrollHeight - el.clientHeight - 1;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      dy = 0;
      armed = 0;
      decided = false;
      tracking = true;
      canDown = atTop();
      canUp = atBottom();
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      dy = e.touches[0].clientY - startY;

      /*
        Decide once, on the first move that carries any vertical intent.

        iOS commits a touch to scrolling on the *first* touchmove it sees
        unprevented, and will not hand it back however many later moves call
        preventDefault. Waiting for a few pixels of travel before claiming the
        gesture therefore loses it outright on Safari — which Chromium forgives,
        so it passed here and failed on a phone.

        Deciding on the first move also stops the direction flipping mid-drag.
      */
      if (!decided) {
        if (dy === 0) return;
        decided = true;
        if (dy > 0 && canDown && onPullDown) armed = 1;
        else if (dy < 0 && canUp && onPullUp) armed = -1;
        else armed = 0;
      }

      // Claim every move of a gesture that is genuinely a pull at an edge; an
      // ordinary scroll away from the edge is never interfered with.
      if (armed !== 0) e.preventDefault();
    };

    const onEnd = () => {
      if (tracking && armed !== 0 && Math.abs(dy) > threshold) {
        if (armed === 1) onPullDown?.();
        else onPullUp?.();
      }
      tracking = false;
      armed = 0;
      decided = false;
      dy = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    // Non-passive: preventDefault is the whole point of the armed branch.
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [ref, enabled, onPullDown, onPullUp, threshold]);
}
