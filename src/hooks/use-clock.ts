"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { minutesNow, readClockOverride, todayISO } from "@/lib/clock";

export interface Clock {
  /** ISO date on screen. */
  date: string;
  /**
   * Minutes since midnight at a coarse cadence. Drives layout/phase so the
   * tree does not re-render at 60fps; spring layout animations smooth the step.
   */
  nowMin: number;
  /** Continuous minutes since midnight. Drives the now-line only. */
  nowMV: MotionValue<number>;
  /** True when pinned via ?t= / ?d= for preview. */
  pinned: boolean;
  /** False until the client has read the URL — avoids hydration mismatch. */
  ready: boolean;
}

/** Coarse tick: 1s normally, 30s under reduced motion (battery + calm). */
const TICK_MS = 1000;
const TICK_MS_REDUCED = 30000;

export function useClock(): Clock {
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(() => todayISO());
  const [nowMin, setNowMin] = useState(() => 0);
  const pinnedRef = useRef<number | null>(null);
  /** ?d= alone must survive the tick, or date-only preview never works. */
  const datePinnedRef = useRef(false);
  const [pinned, setPinned] = useState(false);
  const nowMV = useMotionValue(0);

  // Read the override once on mount, then seed the clock.
  useEffect(() => {
    const o = readClockOverride(window.location.search);
    if (o.date) {
      datePinnedRef.current = true;
      setDate(o.date);
    }
    if (o.minutes != null) {
      pinnedRef.current = o.minutes;
      setPinned(true);
      setNowMin(o.minutes);
      nowMV.set(o.minutes);
    } else {
      const m = minutesNow();
      setNowMin(m);
      nowMV.set(m);
    }
    setReady(true);
  }, [nowMV]);

  // Coarse tick for layout. Stops while hidden, resyncs on resume so a phone
  // unlocked at 04:45 is never showing a stale block.
  useEffect(() => {
    if (!ready || pinnedRef.current != null || datePinnedRef.current) return;

    const sync = () => {
      setNowMin(minutesNow());
      const today = todayISO();
      // Roll over at midnight without a reload.
      setDate((prev) => (prev === today ? prev : today));
    };

    let id: number | undefined;
    const start = () => {
      stop();
      sync();
      id = window.setInterval(sync, reduced ? TICK_MS_REDUCED : TICK_MS);
    };
    const stop = () => {
      if (id != null) window.clearInterval(id);
      id = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", start);
    window.addEventListener("focus", start);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", start);
      window.removeEventListener("focus", start);
    };
  }, [ready, reduced]);

  // Continuous value for the now-line. Skipped entirely when pinned or reduced
  // — under reduced motion the coarse tick feeds it instead.
  useAnimationFrame(() => {
    if (pinnedRef.current != null || reduced) return;
    nowMV.set(minutesNow());
  });

  useEffect(() => {
    if (reduced && pinnedRef.current == null) nowMV.set(nowMin);
  }, [reduced, nowMin, nowMV]);

  return { date, nowMin, nowMV, pinned, ready };
}
