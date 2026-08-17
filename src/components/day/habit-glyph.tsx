"use client";

import { motion } from "motion/react";
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
  state,
}: {
  habit: HabitKey;
  /** Register letter, from the habit's own definition. */
  code: string;
  state: GlyphState;
}) {
  return (
    <motion.span
      layoutId={`habit-${habit}`}
      transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
      className="flex shrink-0 flex-col items-center gap-[3px]"
    >
      <span
        className={`font-mono text-[12px] leading-none tracking-[0.04em] ${LETTER[state]}`}
      >
        {code}
      </span>
      <span className={`h-[1.5px] w-[11px] rounded-pill ${RULE[state]}`} />
    </motion.span>
  );
}
