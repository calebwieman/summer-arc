"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { SWEEP } from "@/lib/motion";
import { getHabits } from "@/lib/habits";
import { earliestLogDate, scoreDay } from "@/lib/stats";

const ROWS = 7;
const CELL = 4;
const GAP = 2;

/**
 * The year behind you, one mark per day.
 *
 * Monochrome on purpose: the whole app spends its colour budget on --warn and
 * --bad, and a green-to-dark heatmap would make this the loudest surface in it.
 * Completion rides opacity and height instead, which still separates a full day
 * from a half one at this size.
 */
export function YearTrace({
  today,
  days = 364,
  version,
  onPick,
}: {
  today: string;
  days?: number;
  version: number;
  onPick: (date: string) => void;
}) {
  const cols = useMemo(() => {
    const habits = getHabits();
    const since = earliestLogDate();
    const end = parseISO(today);
    // Start on the Monday on or before the window start, so rows are weekdays.
    const rawStart = subDays(end, days);
    const start = subDays(rawStart, (rawStart.getDay() + 6) % 7);
    const all = eachDayOfInterval({ start, end }).map((d) => {
      const date = format(d, "yyyy-MM-dd");
      const s = scoreDay(date, habits, since);
      // Nothing scheduled and nothing-yet-started both read as no-data.
      return {
        date,
        ratio: s.preAdoption ? -1 : s.ratio,
        isToday: date === today,
      };
    });
    const out: (typeof all)[] = [];
    for (let i = 0; i < all.length; i += ROWS) out.push(all.slice(i, i + ROWS));
    return out;
  }, [today, days, version]);

  const reduced = useReducedMotion();

  return (
    <section>
      <h3 className="kicker text-center">The year</h3>
      <div // touch-pan-x: overflow-x:auto computes overflow-y to auto too, which
        // would make this a vertical scroll box and swallow the stack swipe.
        className="mt-3 touch-pan-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex" style={{ gap: GAP }}>
          {cols.map((week, i) => (
            /*
              The year draws itself, left to right, in about a third of a
              second. Staggered by *column*, never by cell — 364 springs would
              be 364 rAF subscriptions for marks four pixels across, where
              nobody could tell a spring from a tween anyway. Fifty-two tweens
              at six milliseconds apart is the whole effect for almost none of
              the cost.
            */
            <motion.div
              key={i}
              initial={reduced ? false : { opacity: 0, scaleY: 0.4 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{
                duration: 0.5,
                delay: Math.min(0.4, i * 0.006),
                ease: SWEEP,
              }}
              className="flex origin-center flex-col"
              style={{ gap: GAP }}
            >
              {week.map((d) => {
                const none = d.ratio < 0;
                const full = d.ratio >= 1;
                return (
                  <button
                    key={d.date}
                    type="button"
                    title={d.date}
                    aria-label={d.date}
                    onClick={() => onPick(d.date)}
                    className="rounded-[1px]"
                    style={{
                      width: CELL,
                      height: CELL,
                      background: none
                        ? "var(--line-soft)"
                        : full
                          ? "var(--ink)"
                          : "var(--ink)",
                      opacity: none ? 1 : full ? 1 : 0.18 + d.ratio * 0.55,
                      outline: d.isToday ? "1px solid var(--accent)" : undefined,
                      outlineOffset: 1,
                    }}
                  />
                );
              })}
            </motion.div>
          ))}
        </div>
      </div>
      <p className="mono-xs mt-2 text-center text-ink-4">
        {days} days · tap to open
      </p>
    </section>
  );
}
