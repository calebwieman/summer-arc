"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

/**
 * The bottom sheet shell.
 *
 * Pulled out of the settings sheet once three more surfaces needed the same
 * scrim, spring, grab handle, escape-to-close and safe-area padding. Sheets are
 * how this app adds surfaces without adding routes — the day screen stays a
 * single screen, and anything that is a detour rather than a destination
 * arrives over the top of it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  /** Taller default for surfaces that hold a list. */
  tall = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  tall?: boolean;
}) {
  const reduced = useReducedMotion();

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
            aria-label={`Close ${title.toLowerCase()}`}
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
            aria-label={title}
            initial={reduced ? { opacity: 0 } : { y: "100%" }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 320, damping: 34, mass: 0.9 }
            }
            className={`fixed inset-x-0 bottom-0 z-50 overflow-y-auto rounded-t-lg border-t border-line-mid bg-surface px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+28px)] ${
              tall ? "max-h-[92dvh]" : "max-h-[86dvh]"
            }`}
          >
            {/* Grab handle — the sheet reads as draggable even though the
                close control is the explicit path. */}
            <div className="mx-auto h-1 w-10 rounded-pill bg-line-mid" />

            <div className="relative mt-5 flex items-center justify-center">
              <h2 className="kicker">{title}</h2>
              <button
                type="button"
                aria-label={`Close ${title.toLowerCase()}`}
                onClick={onClose}
                className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-pill text-ink-3 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-7">{children}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
