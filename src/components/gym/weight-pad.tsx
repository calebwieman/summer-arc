"use client";

import { ChevronDown, Check, Delete } from "lucide-react";
import { haptic } from "@/lib/haptics";

/**
 * The gym keyboard.
 *
 * The system keyboard is the single worst part of logging on a phone: it
 * covers half the sheet, offers letters nobody needs, and has no idea that
 * weights move in 2.5-lb steps. This replaces it — the number fields are
 * read-only and this pad is their only input, so iOS never raises its own.
 *
 * The layout is built around what a hand between sets actually does: most
 * entries are "last time's number ± one plate", so the increment row sits
 * on top and is tuned per field (plate steps for weight, ±1 for reps); the
 * digit grid is for the rest; and the two tall keys on the right are the
 * whole flow — `next` hops weight → reps, `log` commits the set and moves
 * on. One thumb, no typing, no keyboard shuffle.
 */

export type PadKey =
  | { t: "digit"; d: string }
  | { t: "bs" }
  | { t: "inc"; by: number }
  | { t: "next" }
  | { t: "log" }
  | { t: "close" };

const W_STEPS = [-10, -5, -2.5, 2.5, 5, 10];
const R_STEPS = [-1, 1];

function Key({
  onPress,
  className = "",
  label,
  children,
}: {
  onPress: () => void;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        haptic(4);
        onPress();
      }}
      className={`flex min-h-12 items-center justify-center rounded-sm border font-mono tabular-nums select-none ${className}`}
    >
      {children}
    </button>
  );
}

export function WeightPad({
  label,
  field,
  value,
  plates,
  canLog,
  onKey,
}: {
  /** "Bench Press · set 3" — what the numbers are about to belong to. */
  label: string;
  field: "w" | "r";
  /** The effective text of the focused field. */
  value: string;
  /** Per-side plate readout for bar lifts, or null. */
  plates: string | null;
  /** Reps are present, so `log` will actually commit. */
  canLog: boolean;
  onKey: (k: PadKey) => void;
}) {
  const steps = field === "w" ? W_STEPS : R_STEPS;
  return (
    /*
      The negative bottom margin swallows the sheet's own trailing padding
      (wrapper pb-2 + the shell's 28px + safe-area). Sticky can only push an
      element up from its flow position, so without this the pad un-docked
      from the screen edge whenever the sheet was scrolled to the bottom --
      which is exactly where the last exercise of every session lives.
    */
    <div
      id="gym-pad"
      tabIndex={-1}
      role="group"
      aria-label={`Keypad -- ${label}`}
      className="sticky -bottom-[calc(env(safe-area-inset-bottom)+28px)] z-20 -mx-5 -mb-[calc(env(safe-area-inset-bottom)+36px)] border-t border-line-mid bg-surface px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 outline-none"
    >
      {/* What is being edited, and what it currently says. */}
      <div className="flex items-baseline gap-2 px-1 pb-2">
        <span className="mono-xs min-w-0 truncate text-ink-3">{label}</span>
        <span
          aria-live="polite"
          className="ml-auto shrink-0 font-mono text-[20px] font-bold tabular-nums leading-none text-ink"
        >
          {value || "0"}
          <span className="mono-xs ml-1 font-normal text-ink-4">
            {field === "w" ? "lb" : "reps"}
          </span>
        </span>
        <button
          type="button"
          aria-label="Hide keypad"
          onClick={() => onKey({ t: "close" })}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-ink-3 hover:text-ink"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* 185 is a number; "45 · 25 /side" is what you rack. */}
      {plates ? (
        <p className="mono-xs px-1 pb-2 tabular-nums text-ink-3">
          bar + {plates}
        </p>
      ) : null}

      <div
        className={`grid gap-1.5 pb-2 ${
          field === "w" ? "grid-cols-6" : "grid-cols-2"
        }`}
      >
        {steps.map((s) => (
          <Key
            key={s}
            label={`${s > 0 ? "add" : "subtract"} ${Math.abs(s)}`}
            onPress={() => onKey({ t: "inc", by: s })}
            className="min-h-11 border-line-soft bg-surface-2 text-[13px] text-ink-2"
          >
            {s > 0 ? `+${s}` : s}
          </Key>
        ))}
      </div>

      <div className="grid grid-cols-4 grid-rows-4 gap-1.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key
            key={d}
            onPress={() => onKey({ t: "digit", d })}
            className="border-line-mid text-[17px] text-ink"
          >
            {d}
          </Key>
        ))}
        <Key
          onPress={() => onKey({ t: "next" })}
          label={field === "w" ? "To reps" : "To weight"}
          className="col-start-4 row-start-1 row-span-2 border-line-mid text-[13px] text-ink-2"
        >
          next
        </Key>
        <Key
          onPress={() => canLog && onKey({ t: "log" })}
          label="Log this set"
          className={`col-start-4 row-start-3 row-span-2 text-[15px] ${
            canLog
              ? "border-accent bg-ink text-accent-fg"
              : "border-line-soft text-ink-4"
          }`}
        >
          <Check className="h-5 w-5" />
        </Key>
        <Key
          onPress={() => field === "w" && onKey({ t: "digit", d: "." })}
          label="Decimal point"
          className={`row-start-4 text-[17px] ${
            field === "w" ? "border-line-mid text-ink" : "border-line-soft text-ink-4"
          }`}
        >
          .
        </Key>
        <Key
          onPress={() => onKey({ t: "digit", d: "0" })}
          className="row-start-4 border-line-mid text-[17px] text-ink"
        >
          0
        </Key>
        <Key
          onPress={() => onKey({ t: "bs" })}
          label="Delete digit"
          className="row-start-4 border-line-mid text-ink-2"
        >
          <Delete className="h-4 w-4" />
        </Key>
      </div>
    </div>
  );
}
