"use client";

import { useMemo } from "react";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
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

  return (
    <section>
      <h3 className="kicker text-center">The year</h3>
      <div className="mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex" style={{ gap: GAP }}>
          {cols.map((week, i) => (
            <div key={i} className="flex flex-col" style={{ gap: GAP }}>
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
            </div>
          ))}
        </div>
      </div>
      <p className="mono-xs mt-2 text-center text-ink-4">
        {days} days · tap to open
      </p>
    </section>
  );
}
