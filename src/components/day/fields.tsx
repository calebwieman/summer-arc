"use client";

import { motion, useReducedMotion } from "motion/react";
import { haptic } from "@/lib/haptics";

const TAP = { type: "spring", stiffness: 520, damping: 32 } as const;

function Label({ children }: { children: React.ReactNode }) {
  return <span className="meta block">{children}</span>;
}

/**
 * Minutes logger. Deliberately not a number spinner — quick-add chips plus a
 * one-tap "log the whole block", which is what actually happens when a Deep
 * Work block ends.
 */
export function MinutesField({
  value,
  blockMinutes,
  onChange,
}: {
  value: number;
  blockMinutes: number;
  onChange: (next: number) => void;
}) {
  const reduced = useReducedMotion();
  const add = (n: number) => {
    haptic(8);
    onChange(Math.max(0, value + n));
  };

  const showSecondRow = blockMinutes >= 60 || value > 0;

  return (
    <div className="space-y-2.5">
      <Label>Deep work logged</Label>
      {/* The quick-adds ride the readout row rather than sitting under it. The
          readout is three characters wide at most and left the rest of the line
          empty, while the chips below overran the card's content width by a
          dozen pixels and wrapped "full block" onto a row of its own — which
          cost ~56px of height the fixed-height column could not spare. */}
      <div className="flex items-center gap-2">
        <motion.span
          key={value}
          initial={reduced ? false : { y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={TAP}
          className="font-mono text-[26px] font-bold tabular-nums leading-none tracking-[-0.02em] text-ink"
        >
          {value}
        </motion.span>
        <span className="mono-xs text-ink-3">min</span>
        <div className="ml-auto flex gap-1.5">
          {[15, 30, 60].map((n) => (
            <Chip key={n} onPress={() => add(n)}>
              +{n}
            </Chip>
          ))}
        </div>
      </div>
      {showSecondRow ? (
        <div className="flex gap-1.5">
          {/* Only offered when the host block is plausibly a work session. On
              weekends this field falls back to Wind Down, where "full block · 45"
              would be an offer to log 45 minutes of winding down as deep work. */}
          {blockMinutes >= 60 ? (
            <Chip onPress={() => { haptic(10); onChange(blockMinutes); }}>
              full block · {blockMinutes}
            </Chip>
          ) : null}
          {value > 0 ? (
            <Chip
              label="Clear logged minutes"
              onPress={() => {
                haptic(6);
                onChange(0);
              }}
            >
              clear
            </Chip>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  children,
  onPress,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  /** Accessible name, when the visible text is not self-explanatory. */
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onPress}
      whileTap={{ scale: 0.94 }}
      transition={TAP}
      // px-3, not px-4: at the card's content width the four chips totalled
      // ~313px against ~299px available, so "full block" wrapped to a second
      // row and cost the layout 56px it did not have.
      className="mono-xs min-h-11 rounded-pill border border-line-mid px-3 text-ink-2 hover:border-accent hover:text-ink"
    >
      {children}
    </motion.button>
  );
}

/** 16px minimum — anything smaller makes iOS zoom the viewport on focus. */
const INPUT_CLS =
  "w-full rounded-sm border border-line-soft bg-surface-2 px-3 py-3 text-[16px] text-ink placeholder:text-ink-3 outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus:border-line-mid";

/**
 * Controlled, and committed on every keystroke.
 *
 * This was `defaultValue` + `onBlur`, which meant anything typed and not yet
 * blurred was destroyed the moment the surrounding block re-keyed — the clock
 * ticks every second, so a block boundary while typing silently ate the note.
 * Writing through on change costs one localStorage write per keystroke and
 * makes loss structurally impossible.
 */
export function NoteField({
  value,
  onChange,
  label,
  placeholder,
  rows = 1,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder: string;
  rows?: number;
}) {
  const common = {
    value,
    placeholder,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(e.target.value),
  };

  return (
    <label className="block space-y-2">
      <Label>{label}</Label>
      {rows > 1 ? (
        <textarea {...common} rows={rows} className={`${INPUT_CLS} resize-none`} />
      ) : (
        <input {...common} type="text" enterKeyHint="done" className={INPUT_CLS} />
      )}
    </label>
  );
}

/** Shipped / not shipped. A two-state stamp rather than a checkbox. */
export function ShippedField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Content</Label>
      <motion.button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => {
          haptic(value ? 8 : [16, 24, 10]);
          onChange(!value);
        }}
        whileTap={{ scale: 0.97 }}
        transition={TAP}
        className={`mono-xs min-h-12 w-full rounded-sm border px-4 transition-colors ${
          value
            ? "border-accent bg-ink/[0.10] text-ink"
            : "border-line-soft text-ink-3"
        }`}
      >
        {value ? "shipped" : "not shipped"}
      </motion.button>
    </div>
  );
}
