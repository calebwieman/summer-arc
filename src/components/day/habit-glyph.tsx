"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { ROW, TICK } from "@/lib/motion";
import { iconFor } from "./habit-icons";
import type { HabitKey } from "@/lib/types";

export type GlyphState =
  | "done"
  | "pending"
  | "overdue"
  | "unscheduled"
  | "fault";

const LETTER: Record<GlyphState, string> = {
  done: "text-ink",
  pending: "text-ink-3",
  // Its block has been and gone and it is still unthrown — this is the one
  // worth tapping, so it is the one that catches the eye.
  overdue: "text-warn",
  unscheduled: "text-ink-4 line-through decoration-1",
  fault: "text-bad",
};

/** State rides an underline rule — the house language is rules, not boxes. */
const RULE: Record<GlyphState, string> = {
  done: "bg-ink",
  pending: "bg-line-mid",
  overdue: "bg-warn",
  unscheduled: "bg-transparent",
  fault: "bg-bad",
};

/**
 * The five register glyphs are the shared element of the whole screen: in the
 * day view they sit in the footer, in the record they lead each row. One
 * `layoutId` per habit, only ever one mounted at a time, so motion can fly them
 * between the two surfaces.
 */
export function HabitGlyph({
  habit,
  code,
  icon,
  state,
  seated = false,
}: {
  habit: HabitKey;
  /** Register letter, from the habit's own definition. */
  code: string;
  /**
   * Icon name; when given it replaces the letter. The register shows icons —
   * six letters told you nothing at a glance — while the record keeps letters,
   * which line up as a column the way six different silhouettes never will.
   */
  icon?: string;
  state: GlyphState;
  /** Its block is the one in the seat — the letter the wheel is parked on. */
  seated?: boolean;
}) {
  const Icon = icon ? iconFor(icon) : null;
  const reduced = useReducedMotion();
  const done = state === "done";

  /*
    Fired from an effect rather than declared as an `animate` target, because
    a keyframe array is a fresh array on every render and Motion restarts a
    keyframe animation when its target changes. The day screen re-renders once
    a second off the clock, so the punch would have played once a second for
    every done habit on screen. This way it plays exactly when the state does.
  */
  const scaleX = useMotionValue(done ? 1 : 0.72);
  const wasDone = useRef(done);
  useEffect(() => {
    if (done === wasDone.current) return;
    wasDone.current = done;
    if (reduced) {
      scaleX.set(done ? 1 : 0.72);
      return;
    }
    if (done) {
      animate(scaleX, [0.72, 1.35, 1], {
        duration: 0.42,
        times: [0, 0.34, 1],
        ease: [0.22, 1, 0.36, 1],
      });
    } else {
      animate(scaleX, 0.72, TICK);
    }
  }, [done, reduced, scaleX]);

  return (
    <motion.span
      /*
        The glyph flies between the register and the record's rows, and that
        flight is one of the two best moments in the app — but only when Motion
        can animate the transform. Under reduced motion it drops that half of a
        layout animation, leaving a jump-cut with no crossfade, which is worse
        than not sharing the element at all. So there it simply isn't shared.
      */
      layoutId={reduced ? undefined : `habit-${habit}`}
      transition={ROW}
      className="relative flex shrink-0 flex-col items-center gap-[3px]"
    >
      {Icon ? (
        <Icon
          // Same colour grammar as the letter; the strikethrough for an
          // unscheduled day cannot apply to a path, so dimming carries it.
          className={`h-[19px] w-[19px] transition-colors duration-200 ${
            seated ? "text-ink" : LETTER[state]
          } ${state === "unscheduled" ? "opacity-45" : ""}`}
          strokeWidth={1.75}
        />
      ) : (
        <span
          // The seated letter comes up to full ink whatever its state, because
          // "where the wheel is" has to beat "how this habit is doing" for the
          // half second you are looking for it.
          className={`font-mono text-[12px] leading-none tracking-[0.04em] transition-colors duration-200 ${
            seated ? "text-ink" : LETTER[state]
          }`}
        >
          {code}
        </span>
      )}
      {/*
        The rule is the app's own grammar for state — "rules, not boxes" — so
        it should be the thing that moves when state changes. At rest it is
        short and grows to full width when the habit is done; on the throw
        itself it punches out past its own width and settles back. Three pixels
        on an eleven-pixel rule, composited, free: the app saying "that landed"
        in its own language instead of swapping a colour.
      */}
      <motion.span
        style={{ scaleX }}
        className={`h-[1.5px] origin-center rounded-pill transition-colors duration-200 ${
          Icon ? "w-[15px]" : "w-[11px]"
        } ${RULE[state]}`}
      />
    </motion.span>
  );
}
