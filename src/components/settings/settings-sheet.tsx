"use client";

import { motion } from "motion/react";
import { Archive } from "@/components/review/archive";
import { Sheet } from "@/components/ui/sheet";
import { HabitEditor } from "./habit-editor";
import { useTheme, type ThemePref } from "@/components/theme/theme-provider";
import { haptic } from "@/lib/haptics";

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function ThemeChoice() {
  const { pref, setTheme, ready } = useTheme();

  return (
    <section className="text-center">
      <h3 className="kicker">Appearance</h3>
      <div className="mt-4 flex gap-2">
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
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
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
 * Everything that is configuration rather than today. Kept off the day screen
 * entirely — it is opened perhaps twice a semester — and off the record, which
 * is for reading.
 */
export function SettingsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Settings" tall>
      <div className="space-y-8">
        <HabitEditor />
        <ThemeChoice />
        <Archive />
      </div>
    </Sheet>
  );
}
