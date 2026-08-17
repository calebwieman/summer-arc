"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Archive } from "@/components/review/archive";
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
  const reduced = useReducedMotion();

  // Escape closes; the sheet owns focus while it is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-scrim"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            initial={reduced ? { opacity: 0 } : { y: "100%" }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 320, damping: 34, mass: 0.9 }
            }
            className="fixed inset-x-0 bottom-0 z-50 max-h-[86dvh] overflow-y-auto rounded-t-lg border-t border-line-mid bg-surface px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+28px)]"
          >
            {/* Grab handle — the sheet reads as draggable even though the
                close control is the explicit path. */}
            <div className="mx-auto h-1 w-10 rounded-pill bg-line-mid" />

            <div className="mt-5 flex items-center justify-center">
              <h2 className="kicker">Settings</h2>
              <button
                type="button"
                aria-label="Close settings"
                onClick={onClose}
                className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-pill text-ink-3 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-7 space-y-8">
              <ThemeChoice />
              <Archive />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
