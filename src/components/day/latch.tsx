"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { ChevronsRight } from "lucide-react";
import { iconFor } from "./habit-icons";
import { HAPTIC_COMMIT, HAPTIC_RELEASE, haptic } from "@/lib/haptics";
import { formatClock } from "@/lib/clock";
import type { HabitKey } from "@/lib/types";

const TRACK_H = 60;
const CAR = 52;
const PAD = 4;
const TICKS = 9;

/** Arm point. Past this, releasing commits — the last 28% is optional travel. */
const ARM_AT = 0.72;
/** Drag a committed carriage back below this to release it. */
const RELEASE_BELOW = 0.45;
/** Hold this long on a thrown latch to release it without dragging. */
const UNDO_MS = 520;
/** Movement beyond this cancels a hold — it was a drag, not a press. */
const HOLD_SLOP = 8;

/** Commit is tight and fast. Reject is slower and bouncier — it drops back. */
const S_COMMIT = { type: "spring", stiffness: 640, damping: 40, mass: 1.1 } as const;
const S_REJECT = { type: "spring", stiffness: 380, damping: 26, mass: 1.2 } as const;
/**
 * Reduced motion still moves the carriage — it has to, or the control cannot be
 * operated. It is shortened and critically damped instead of removed, which is
 * a different choreography rather than an off switch.
 */
const S_REDUCED = { type: "spring", stiffness: 900, damping: 60, mass: 0.6 } as const;

interface LatchProps {
  habit: HabitKey;
  /** Icon name from habit-icons. */
  icon: string;
  label: string;
  checked: boolean;
  stampMin?: number;
  onChange: (next: boolean) => void;
  /** Fires on commit so the whole surface can take the shock. */
  onRecoil?: () => void;
}

export function Latch({
  habit,
  icon,
  label,
  checked,
  stampMin,
  onChange,
  onRecoil,
}: LatchProps) {
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const travelRef = useRef(0);
  const [travel, setTravel] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [armed, setArmed] = useState(false);
  const x = useMotionValue(0);
  const undoProgress = useMotionValue(0);
  const holdTimer = useRef<number | null>(null);
  const holdOrigin = useRef<{ x: number; y: number } | null>(null);
  /** Set when this component drove the change, so parking doesn't re-animate. */
  const selfDriven = useRef(false);
  const mounted = useRef(false);
  const Glyph = iconFor(icon);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const t = Math.max(0, el.offsetWidth - CAR - PAD * 2);
      travelRef.current = t;
      setTravel(t);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Park the carriage to match state. Skipped while a finger is on it, and
  // skipped for changes this component just animated itself — otherwise the
  // reject spring was cancelled and replayed as a commit spring every time.
  useEffect(() => {
    if (dragging) return;
    const target = checked ? travelRef.current : 0;
    if (selfDriven.current) {
      selfDriven.current = false;
      return;
    }
    // First paint, or a width change: snap, never replay the throw. Only count
    // as mounted once the track has actually been measured — otherwise the
    // zero-width first pass consumes the snap and the real positioning tries
    // to animate, leaving an already-thrown latch parked at the wrong end.
    if (!mounted.current || travelRef.current === 0) {
      if (travelRef.current > 0) mounted.current = true;
      x.set(target);
      return;
    }
    const c = animate(x, target, reduced ? S_REDUCED : S_COMMIT);
    return () => c.stop();
  }, [checked, travel, dragging, x, reduced]);

  const progress = useTransform(x, (v) =>
    travelRef.current > 0 ? Math.min(1, Math.max(0, v / travelRef.current)) : 0,
  );
  useMotionValueEvent(progress, "change", (p) => setArmed(p >= ARM_AT));

  const fill = useTransform(progress, [0, 1], [0, 0.13]);
  const labelFade = useTransform(progress, [0, 0.5], [1, 0]);
  const glyphDim = useTransform(progress, [0, 1], [0.55, 1]);
  const undoWipe = useTransform(undoProgress, (p) => `${(1 - p) * 100}%`);
  /** Only readable once the carriage has cleared the left of the track. */
  const receiptFade = useTransform(progress, [0.45, 0.8], [0, 1]);

  const commit = useCallback(
    (next: boolean) => {
      const target = next ? travelRef.current : 0;
      selfDriven.current = next !== checked;
      animate(x, target, reduced ? S_REDUCED : next ? S_COMMIT : S_REJECT);
      if (next === checked) return;
      haptic(next ? HAPTIC_COMMIT : HAPTIC_RELEASE);
      if (next) onRecoil?.();
      onChange(next);
    },
    [checked, onChange, onRecoil, reduced, x],
  );

  const clearHold = useCallback(() => {
    holdOrigin.current = null;
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    animate(undoProgress, 0, { duration: 0.14 });
  }, [undoProgress]);

  // Press-and-hold to release. Linear, because it is a timer being read.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!checked) return;
    holdOrigin.current = { x: e.clientX, y: e.clientY };
    animate(undoProgress, 1, { duration: UNDO_MS / 1000, ease: "linear" });
    holdTimer.current = window.setTimeout(() => {
      undoProgress.set(0);
      holdOrigin.current = null;
      commit(false);
    }, UNDO_MS);
  };

  // Any real movement means the user is dragging — most importantly the
  // vertical pull that opens the record, which must never silently un-commit.
  const onPointerMove = (e: React.PointerEvent) => {
    const o = holdOrigin.current;
    if (!o) return;
    if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > HOLD_SLOP) clearHold();
  };

  const onDragEnd = () => {
    setDragging(false);
    const p = travelRef.current > 0 ? x.get() / travelRef.current : 0;
    // Committed carriages can be thrown back; uncommitted ones must pass the arm point.
    commit(checked ? p > RELEASE_BELOW : p >= ARM_AT);
  };

  return (
    <div
      ref={trackRef}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        // e.repeat: holding Space auto-repeats and would toggle once per repeat,
        // landing on whichever state the key-up happened to leave.
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          commit(!checked);
        }
      }}
      onClick={(e) => {
        // VoiceOver / Switch Control / Full Keyboard Access activate by
        // dispatching a synthetic click, which has detail === 0. A real finger
        // tap has detail >= 1 and must stay inert (it gets the nudge instead),
        // so this is the assistive path only — without it the control cannot be
        // operated by assistive technology at all.
        if (e.detail === 0) commit(!checked);
      }}
      // The carriage drags sideways; the surface grid must not arm over it.
      data-deck="off"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearHold}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
      className="relative w-full select-none overflow-hidden rounded-md border border-line-soft bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      /*
        touch-action: none, and it says what was already happening.

        This read `pan-y` for a long time, which looks like "allow vertical
        scrolling through me" — but touch-action intersects along the ancestor
        chain, and the drag ancestor is `pan-x`. pan-y ∩ pan-x is empty, so the
        browser was already handling nothing and every touch was arriving as
        pointer events. That is precisely why both gestures work from this one
        60px-tall element: the carriage drags sideways *and* a vertical swipe
        from here still reaches the surface stack.

        It worked for a reason nobody had written down, and the next person to
        tidy `pan-y` into `pan-x` would have broken one of the two. `none`
        behaves identically and is the honest declaration.
      */
      style={{ height: TRACK_H, touchAction: "none" }}
    >
      <motion.div aria-hidden className="absolute inset-0 bg-ink" style={{ opacity: fill }} />

      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center">
        {Array.from({ length: TICKS }).map((_, i) => (
          <span
            key={i}
            className="absolute h-[5px] w-px bg-line-mid/60"
            style={{ left: `${((i + 1) / (TICKS + 1)) * 100}%` }}
          />
        ))}
      </div>

      <motion.span
        aria-hidden
        style={{ left: PAD + CAR + 16, opacity: labelFade }}
        className="mono-xs pointer-events-none absolute inset-y-0 flex items-center gap-2 text-ink-2"
      >
        {checked ? null : (
          <>
            {label}
            {/* Without this the track reads as a label, not a mechanism. */}
            <ChevronsRight className="h-3.5 w-3.5 text-ink-4" strokeWidth={2.5} />
          </>
        )}
      </motion.span>

      {checked ? (
        <motion.span
          aria-hidden
          // Left, not right: the carriage parks on the right, and a timestamp
          // there just peeks out from behind it. Opacity rides the travel so
          // it clears out of the way when the bolt is thrown back. The right
          // bound keeps the text clear of the parked carriage.
          style={{ opacity: receiptFade, right: CAR + PAD + 12 }}
          className="pointer-events-none absolute inset-y-0 left-6 flex items-center gap-2 overflow-hidden"
        >
          {/* The label stays after the throw. It used to disappear, leaving
              only a stamp — readable enough on the day screen, where the block
              names the habit, but a backfilled day stacks four latches with no
              stamps at all and every one of them just read "set". */}
          <span className="mono-xs truncate text-ink-2">{label}</span>
          {stampMin != null ? (
            <span className="mono-sm shrink-0 tabular-nums text-ink-3">
              {formatClock(stampMin)}
            </span>
          ) : null}
        </motion.span>
      ) : null}

      {checked ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 bg-bg/70"
          style={{ left: undoWipe }}
        />
      ) : null}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: travel }}
        dragElastic={0.04}
        dragMomentum={false}
        dragDirectionLock
        onDragStart={() => {
          clearHold();
          setDragging(true);
        }}
        onDragEnd={onDragEnd}
        onTap={() => {
          if (checked || dragging) return;
          // A poke wobbles. Keyframes need a tween — a spring with three
          // keyframes resolves origin===target and plays nothing at all.
          animate(x, [0, 9, 0], { duration: 0.34, ease: [0.34, 1.56, 0.64, 1] });
        }}
        // motion adds tabindex=0 to draggable elements; left alone that puts an
        // unnamed focusable div inside the switch, so tab lands twice.
        tabIndex={-1}
        aria-hidden
        style={{ x, width: CAR, height: CAR, top: PAD, left: PAD }}
        className={`absolute flex touch-none items-center justify-center rounded-sm bg-surface transition-colors ${
          armed || checked ? "border border-accent" : "border border-line-mid"
        }`}
      >
        <motion.span style={{ opacity: glyphDim }}>
          <Glyph className="h-[19px] w-[19px] text-ink" />
        </motion.span>
      </motion.div>
    </div>
  );
}
