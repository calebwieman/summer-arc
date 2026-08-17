"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { earliestLogDate, scoreDay } from "@/lib/stats";
import { getHabits } from "@/lib/habits";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday-first column for a JS weekday. */
function col(day: number): number {
  return (day + 6) % 7;
}

/**
 * A month at a time.
 *
 * Deliberately not a grid of tinted squares — the house language is rules, not
 * boxes, the same reason the week strip is height-encoded. Each day is its
 * numeral over a rule whose width is the share of that day's scheduled habits
 * that were done, so a glance reads as a bar chart wrapped into a calendar
 * rather than as heat.
 */
export function MonthGrid({
  month,
  today,
  onMonth,
  onPick,
  version,
}: {
  /** Any ISO date inside the month being shown. */
  month: string;
  today: string;
  onMonth: (nextIso: string) => void;
  onPick: (date: string) => void;
  /** Bumped by the parent after a write, to force a recount. */
  version: number;
}) {
  const cells = useMemo(() => {
    const habits = getHabits();
    const since = earliestLogDate();
    const first = startOfMonth(parseISO(month));
    const days = eachDayOfInterval({ start: first, end: endOfMonth(first) });
    const lead = col(first.getDay());
    const todayDate = parseISO(today);
    return {
      lead,
      label: format(first, "MMMM yyyy"),
      days: days.map((d) => {
        const date = format(d, "yyyy-MM-dd");
        const future = isAfter(d, todayDate);
        return {
          date,
          dom: d.getDate(),
          future,
          score: future ? null : scoreDay(date, habits, since),
          isToday: date === today,
        };
      }),
    };
    // `version` is the invalidation signal after an edit.
  }, [month, today, version]);

  const step = (delta: number) =>
    onMonth(format(addMonths(parseISO(month), delta), "yyyy-MM-dd"));

  return (
    <section>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => step(-1)}
          className="flex h-11 w-11 items-center justify-center text-ink-3 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="kicker">{cells.label}</h3>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => step(1)}
          className="flex h-11 w-11 items-center justify-center text-ink-3 hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-y-1">
        {DOW.map((d, i) => (
          <span key={i} className="mono-xs text-center text-ink-4">
            {d}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-x-1 gap-y-2">
        {Array.from({ length: cells.lead }).map((_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {cells.days.map((c) => {
          const ratio = c.score && c.score.ratio >= 0 ? c.score.ratio : 0;
          // No demand, or before you started — either way not a failure.
          const noneScheduled =
            !!c.score && (c.score.ratio < 0 || c.score.preAdoption);
          return (
            <button
              key={c.date}
              type="button"
              disabled={c.future}
              onClick={() => onPick(c.date)}
              aria-label={
                c.future
                  ? `${c.date}, in the future`
                  : `${c.date}, ${c.score?.done ?? 0} of ${c.score?.total ?? 0} done`
              }
              className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xs disabled:opacity-25"
            >
              <span
                className={`font-mono text-[12px] tabular-nums leading-none ${
                  c.isToday
                    ? "text-ink"
                    : ratio === 1
                      ? "text-ink-2"
                      : "text-ink-3"
                }`}
              >
                {c.dom}
              </span>
              {/* The rule carries the reading. A day with nothing scheduled
                  gets a dot, never an empty bar — absence of demand is not a
                  failure to meet it. */}
              {c.future ? (
                <span className="h-[2px] w-3 rounded-pill bg-transparent" />
              ) : noneScheduled ? (
                <span className="h-[2px] w-[2px] rounded-pill bg-ink-4" />
              ) : (
                <span className="relative h-[2px] w-3.5 rounded-pill bg-line-mid">
                  <motion.span
                    className={`absolute inset-y-0 left-0 rounded-pill ${
                      ratio === 1 ? "bg-ink" : "bg-ink/55"
                    }`}
                    initial={false}
                    animate={{ width: `${Math.max(ratio * 100, ratio > 0 ? 18 : 0)}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
