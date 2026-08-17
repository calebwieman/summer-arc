"use client";

import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
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

  return (
    <div className="space-y-3">
      <Label>Deep work logged</Label>
      <div className="flex items-baseline gap-2">
        <motion.span
          key={value}
          initial={reduced ? false : { y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={TAP}
          className="font-mono text-[30px] font-bold tabular-nums leading-none tracking-[-0.02em] text-ink"
        >
          {value}
        </motion.span>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
          min
        </span>
        {value > 0 ? (
          <button
            type="button"
            aria-label="Clear logged minutes"
            onClick={() => {
              haptic(6);
              onChange(0);
            }}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-pill text-ink-3 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {[15, 30, 60].map((n) => (
          <Chip key={n} onPress={() => add(n)}>
            +{n}
          </Chip>
        ))}
        {/* Only offered when the host block is plausibly a work session. On
            weekends this field falls back to Wind Down, where "full block · 45"
            would be an offer to log 45 minutes of winding down as deep work. */}
        {blockMinutes >= 60 ? (
          <Chip onPress={() => { haptic(10); onChange(blockMinutes); }}>
            full block · {blockMinutes}
          </Chip>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onPress}
      whileTap={{ scale: 0.94 }}
      transition={TAP}
      className="min-h-11 rounded-pill border border-line-mid px-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-2 hover:border-accent hover:text-ink"
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
        className={`min-h-12 w-full rounded-sm border px-4 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
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
