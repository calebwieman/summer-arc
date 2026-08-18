"use client";

import { motion } from "motion/react";
import { Archive } from "@/components/review/archive";
import { useTheme, type ThemePref } from "@/components/theme/theme-provider";
import { haptic } from "@/lib/haptics";
import { TICK } from "@/lib/motion";

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function Appearance() {
  const { pref, setTheme, ready } = useTheme();
  return (
    <section>
      <h3 className="kicker">Appearance</h3>
      <div className="mt-3 flex gap-2">
        {OPTIONS.map((o) => {
          const active = ready && pref === o.value;
          return (
            <motion.button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                haptic(8);
                setTheme(o.value);
              }}
              whileTap={{ scale: 0.97 }}
              transition={TICK}
              className={`min-h-11 flex-1 rounded-sm border font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                active
                  ? "border-accent bg-ink/[0.10] text-ink"
                  : "border-line-mid text-ink-3 hover:text-ink-2"
              }`}
            >
              {o.label}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The machine behind the instrument: how it looks, and how it survives.
 *
 * Two swipes left from the day, and deliberately the furthest thing from it —
 * this is opened perhaps twice a semester, and everything on it is either a
 * one-off choice or an insurance policy.
 */
export function SystemScreen() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-7">
      <Appearance />
      <Archive />
      {/* Which build is actually running, readable from the phone. It is the
          only way to tell whether a deploy has landed. */}
      <p className="mono-xs mt-auto shrink-0 text-center text-ink-4">
        build {process.env.NEXT_PUBLIC_BUILD_SHA} ·{" "}
        {process.env.NEXT_PUBLIC_BUILD_AT} UTC
      </p>
    </div>
  );
}
