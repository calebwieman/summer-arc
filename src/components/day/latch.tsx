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

/** THROW: arm point, well short of the old 72% — a flick past a third does it. */
const THROW_ARM = 0.35;
/** THROW: past this speed, release commits from wherever the carriage sits. */
const THROW_VELOCITY = 650;
/** THROW: drag a committed carriage back below this to release it. */
const RELEASE_BELOW = 0.45;

/** HOLD: press this long to commit. Short enough not to feel like a penalty. */
const HOLD_MS = 380;
/** Releasing is deliberately slower than committing, in every mode. */
const HOLD_RELEASE_MS = 560;
/** Movement beyond this is a swipe, not a press — hand it back to navigation. */
const HOLD_SLOP = 10;

const S_COMMIT = { type: "spring", stiffness: 640, damping: 40, mass: 1.1 } as const;
const S_REJECT = { type: "spring", stiffness: 380, damping: 26, mass: 1.2 } as const;
/**
 * Reduced motion still moves the carriage — it has to, or the control cannot be
 * operated. Shortened and critically damped, not removed.
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

/**
 * Slide it across. One gesture, no preference, no thinking about it.
 *
 * Hold and tap were offered as alternatives for a while; a control that could
 * be any of three things is a control you have to think about, and the clunk
 * was never in this gesture anyway. Press-and-hold survives only as the way to
 * release a thrown latch.
 */
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
  const holdRun = useRef<{ stop: () => void } | null>(null);
  const holdOrigin = useRef<{ x: number; y: number } | null>(null);
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
  // skipped for changes this component drove itself.
  useEffect(() => {
    if (dragging) return;
    const target = checked ? travelRef.current : 0;
    if (selfDriven.current) {
      selfDriven.current = false;
      return;
    }
    // Only count as mounted once the track has been measured — otherwise the
    // zero-width first pass consumes the snap and a thrown latch animates in
    // from the wrong end.
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
  useMotionValueEvent(progress, "change", (p) => setArmed(p >= THROW_ARM));

  const fill = useTransform(progress, [0, 1], [0, 0.13]);
  const labelFade = useTransform(progress, [0, 0.5], [1, 0]);
  const glyphDim = useTransform(progress, [0, 1], [0.55, 1]);
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

  /** Abandon an in-flight press and send the carriage back where it belongs. */
  const cancelHold = useCallback(() => {
    holdOrigin.current = null;
    if (!holdRun.current) return;
    holdRun.current.stop();
    holdRun.current = null;
    animate(x, checked ? travelRef.current : 0, reduced ? S_REDUCED : S_REJECT);
  }, [checked, reduced, x]);

  /**
   * Press-and-hold. The carriage travels under your thumb for the duration, so
   * the progress indicator and the mechanism are the same object, and letting
   * go early visibly drops it back. Linear, because it is a timer being read.
   *
   * Available in every mode as the way to release a committed latch — tap mode
   * additionally offers its one-tap undo for a few seconds.
   */
  const beginHold = (e: React.PointerEvent) => {
    // Only ever to release. Committing is the slide, and nothing else.
    if (!checked) return;
    holdOrigin.current = { x: e.clientX, y: e.clientY };
    const target = checked ? 0 : travelRef.current;
    const ms = checked ? HOLD_RELEASE_MS : HOLD_MS;
    holdRun.current = animate(x, target, {
      duration: ms / 1000,
      ease: "linear",
      onComplete: () => {
        holdRun.current = null;
        holdOrigin.current = null;
        commit(!checked);
      },
    });
  };

  // Any real movement means a swipe, not a press. Releasing the gesture here is
  // what keeps surface navigation working from on top of the control.
  const onPointerMove = (e: React.PointerEvent) => {
    const o = holdOrigin.current;
    if (!o) return;
    if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > HOLD_SLOP) cancelHold();
  };

  const onDragEnd = (_e: unknown, info: { velocity: { x: number } }) => {
    setDragging(false);
    const p = travelRef.current > 0 ? x.get() / travelRef.current : 0;
    if (checked) {
      commit(p > RELEASE_BELOW);
      return;
    }
    // A committed flick counts even if the carriage never got all the way.
    commit(p >= THROW_ARM || info.velocity.x > THROW_VELOCITY);
  };

  return (
    <div
      ref={trackRef}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      data-deck="off"
      onKeyDown={(e) => {
        // e.repeat: holding Space auto-repeats and would toggle once per repeat.
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          commit(!checked);
        }
      }}
      onClick={(e) => {
        // detail === 0 is VoiceOver / Switch Control / Full Keyboard Access
        // synthesising an activation; without this the control cannot be
        // operated by assistive technology at all.
        if (e.detail === 0) commit(!checked);
      }}
      onPointerDown={beginHold}
      onPointerMove={onPointerMove}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      className="relative w-full select-none overflow-hidden rounded-md border border-line-soft bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      /*
        touch-action: none, and it says what was already happening.

        touch-action intersects along the ancestor chain and the drag ancestor
        is pan-x, so pan-y here resolved to nothing and every touch already
        arrived as pointer events. That is why both gestures work from this one
        60px element. none behaves identically and is the honest declaration.
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
          // there just peeks out from behind it.
          style={{ opacity: receiptFade, right: CAR + PAD + 12 }}
          className="pointer-events-none absolute inset-y-0 left-6 flex items-center gap-2 overflow-hidden"
        >
          <span className="mono-xs truncate text-ink-2">{label}</span>
          {stampMin != null ? (
            <span className="mono-sm shrink-0 tabular-nums text-ink-3">
              {formatClock(stampMin)}
            </span>
          ) : null}
        </motion.span>
      ) : null}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: travel }}
        dragElastic={0.04}
        dragMomentum={false}
        dragDirectionLock
        onDragStart={() => {
          cancelHold();
          setDragging(true);
        }}
        onDragEnd={onDragEnd}
        onTap={() => {
          if (checked || dragging) return;
          // A poke wobbles. Keyframes need a tween — a spring across three
          // keyframes resolves origin === target and plays nothing.
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
