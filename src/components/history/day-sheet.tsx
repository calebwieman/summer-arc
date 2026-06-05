"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bed, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { DayForm } from "@/components/today/day-form";
import { getHabits, saveDailyLog } from "@/lib/storage";
import { makeEmptyLog } from "@/lib/today";
import type { DailyLog } from "@/lib/types";

interface DaySheetProps {
  date: string | null;
  log: DailyLog | null;
  onClose: () => void;
  /** Called whenever the day is mutated so callers can refresh aggregates. */
  onChange?: (log: DailyLog) => void;
}

export function DaySheet({ date, log: initial, onClose, onChange }: DaySheetProps) {
  const open = date !== null;
  const habits = useMemo(() => getHabits(), []);
  const [log, setLog] = useState<DailyLog | null>(initial);

  useEffect(() => {
    if (date && !initial) {
      setLog(makeEmptyLog(date, habits));
    } else {
      setLog(initial);
    }
  }, [date, initial, habits]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const update = (patch: Partial<DailyLog>) => {
    setLog((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveDailyLog(next);
      onChange?.(next);
      return next;
    });
  };

  const toggleRestDay = () => {
    if (!log) return;
    if (log.restDay) {
      update({ restDay: false });
      return;
    }
    if (
      !window.confirm(
        "Mark this day as a rest day? Streak treats it as a pass instead of a miss.",
      )
    )
      return;
    update({ restDay: true });
  };

  return (
    <AnimatePresence>
      {open && date && log ? (
        <motion.div
          key="sheet-root"
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className="relative w-full max-w-md max-h-[90vh] bg-background border-t border-border rounded-t-3xl overflow-hidden flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-border bg-surface/60">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                  {format(parseISO(date), "EEEE")}
                </p>
                <h2 className="text-[18px] font-semibold tracking-tight text-foreground mt-0.5">
                  {format(parseISO(date), "MMMM d, yyyy")}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleRestDay}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] border transition-colors ${
                    log.restDay
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  <Bed className="h-3 w-3" />
                  {log.restDay ? "Rest" : "Rest day"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-6">
              <DayForm
                log={log}
                habits={habits}
                hideSleepSuggestion
                onChange={update}
              />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
