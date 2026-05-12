"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect } from "react";
import { format, parseISO } from "date-fns";
import { HABIT_ORDER } from "@/lib/today";
import type { DailyLog } from "@/lib/types";

interface DaySheetProps {
  date: string | null;
  log: DailyLog | null;
  onClose: () => void;
}

export function DaySheet({ date, log, onClose }: DaySheetProps) {
  const open = date !== null;

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

  return (
    <AnimatePresence>
      {open && date ? (
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
            className="relative w-full max-w-md max-h-[85vh] bg-surface border-t border-border rounded-t-3xl overflow-hidden flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                  {format(parseISO(date), "EEEE")}
                </p>
                <h2 className="text-[18px] font-semibold tracking-tight text-foreground mt-0.5">
                  {format(parseISO(date), "MMMM d, yyyy")}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 space-y-6">
              {!log ? (
                <p className="text-[14px] text-muted">No log for this day.</p>
              ) : (
                <>
                  <Section title="Habits">
                    <ul className="space-y-2">
                      {HABIT_ORDER.map(({ key, label }) => {
                        const checked = log.habits[key];
                        return (
                          <li
                            key={key}
                            className="flex items-center gap-3 text-[14px]"
                          >
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                checked
                                  ? "bg-accent"
                                  : "border-2 border-border"
                              }`}
                            >
                              {checked ? (
                                <Check
                                  className="h-3 w-3 text-[#0a0a0a]"
                                  strokeWidth={3}
                                />
                              ) : null}
                            </span>
                            <span
                              className={
                                checked ? "text-foreground" : "text-muted"
                              }
                            >
                              {label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </Section>

                  {log.top3Priorities.some((p) => p.trim()) ? (
                    <Section title="Top 3 priorities">
                      <ol className="space-y-1.5 text-[14px] text-foreground">
                        {log.top3Priorities.map((p, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted tabular-nums">
                              {i + 1}.
                            </span>
                            <span className={p.trim() ? "" : "text-muted/60"}>
                              {p.trim() || "—"}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </Section>
                  ) : null}

                  <Section title="Numbers">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[14px]">
                      <Stat label="Cold calls" value={log.coldCalls} />
                      <Stat
                        label="Run miles"
                        value={log.runMiles}
                        suffix="mi"
                      />
                      <Stat
                        label="Plunge"
                        value={log.plungeMinutes}
                        suffix="min"
                      />
                      <Stat
                        label="Sleep"
                        value={log.sleepHours}
                        suffix="hr"
                      />
                    </dl>
                  </Section>

                  {log.runNotes || log.amLiftNotes || log.pmLiftNotes ? (
                    <Section title="Notes">
                      <div className="space-y-3 text-[14px]">
                        {log.runNotes ? (
                          <Note label="Run" value={log.runNotes} />
                        ) : null}
                        {log.amLiftNotes ? (
                          <Note label="AM lift" value={log.amLiftNotes} />
                        ) : null}
                        {log.pmLiftNotes ? (
                          <Note label="PM lift" value={log.pmLiftNotes} />
                        ) : null}
                      </div>
                    </Section>
                  ) : null}

                  {log.win ? (
                    <Section title="Win">
                      <p className="text-[14px] text-foreground whitespace-pre-wrap">
                        {log.win}
                      </p>
                    </Section>
                  ) : null}

                  {log.lesson ? (
                    <Section title="Lesson">
                      <p className="text-[14px] text-foreground whitespace-pre-wrap">
                        {log.lesson}
                      </p>
                    </Section>
                  ) : null}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted mb-2.5">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground tabular-nums text-right">
        {value || 0}
        {suffix && value ? (
          <span className="text-muted text-[12px] ml-0.5">{suffix}</span>
        ) : null}
      </dd>
    </>
  );
}

function Note({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted mb-1">
        {label}
      </p>
      <p className="text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}
