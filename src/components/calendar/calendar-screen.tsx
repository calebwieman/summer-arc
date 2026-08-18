"use client";

import { useMemo, useState } from "react";
import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { getHabits } from "@/lib/habits";
import { earliestLogDate, scoreDay } from "@/lib/stats";
import { MonthGrid } from "@/components/history/month-grid";

/**
 * A month at a time, on a surface of its own.
 *
 * It used to be one block among four on the history page, where it had no room
 * to say anything about the month it was showing. Given a page it can: three
 * totals for the month above the grid, in the same shape the history page uses
 * for all time, so the two read as the same instrument at two scales.
 */
export function CalendarScreen({
  today,
  version,
  onPick,
}: {
  today: string;
  version: number;
  onPick: (date: string) => void;
}) {
  const [month, setMonth] = useState(today);

  const totals = useMemo(() => {
    const habits = getHabits();
    const since = earliestLogDate();
    const first = startOfMonth(parseISO(month));
    const days = eachDayOfInterval({ start: first, end: endOfMonth(first) })
      .map((d) => format(d, "yyyy-MM-dd"))
      .filter((d) => d <= today);
    const scores = days
      .map((d) => scoreDay(d, habits, since))
      .filter((s) => s.ratio >= 0 && !s.preAdoption);
    const clean = scores.filter((s) => s.done === s.total && s.total > 0).length;
    const mean =
      scores.length === 0
        ? 0
        : scores.reduce((sum, s) => sum + s.ratio, 0) / scores.length;
    return { days: scores.length, mean, clean };
    // `version` is the invalidation signal after an edit.
  }, [month, today, version]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="flex shrink-0 items-start gap-2 pb-4">
        <Stat value={String(totals.days)} label="days" />
        <Stat value={`${Math.round(totals.mean * 100)}%`} label="average" />
        <Stat value={String(totals.clean)} label="clean" />
      </section>

      <MonthGrid
        month={month}
        today={today}
        onMonth={setMonth}
        onPick={onPick}
        version={version}
      />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="font-mono text-[20px] font-bold tabular-nums leading-none text-ink">
        {value}
      </p>
      <p className="mono-xs mt-1.5 text-ink-3">{label}</p>
    </div>
  );
}
