"use client";

import { useMemo } from "react";
import { addDays, format, isAfter, parseISO, startOfWeek, subDays } from "date-fns";
import { getDailyLog, getHabits } from "@/lib/storage";
import { countScheduledChecked } from "@/lib/stats";
import { getTodayString, habitsForDate } from "@/lib/today";

interface YearlyHeatmapProps {
  onSelectDay: (date: string) => void;
}

const WEEKS_BACK = 26;

function colorForRatio(ratio: number): string {
  if (ratio <= 0) return "bg-border";
  if (ratio < 0.45) return "bg-accent/25";
  if (ratio < 0.85) return "bg-accent/55";
  return "bg-accent";
}

export function YearlyHeatmap({ onSelectDay }: YearlyHeatmapProps) {
  const habits = useMemo(() => getHabits(), []);

  const weeks = useMemo(() => {
    const today = parseISO(getTodayString());
    const endWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const start = subDays(endWeekStart, WEEKS_BACK * 7);
    const cols: { date: string; ratio: number; rest: boolean; future: boolean }[][] =
      [];
    for (let w = 0; w < WEEKS_BACK + 1; w++) {
      const col: typeof cols[number] = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d);
        const dateStr = format(day, "yyyy-MM-dd");
        const future = isAfter(day, today);
        if (future) {
          col.push({ date: dateStr, ratio: 0, rest: false, future: true });
          continue;
        }
        const log = getDailyLog(dateStr);
        const scheduled = habitsForDate(habits, dateStr).length;
        const count = log ? countScheduledChecked(log, habits) : 0;
        const ratio = scheduled === 0 ? 0 : count / scheduled;
        col.push({
          date: dateStr,
          ratio,
          rest: !!log?.restDay,
          future: false,
        });
      }
      cols.push(col);
    }
    return cols;
  }, [habits]);

  return (
    <div className="flex gap-[2px] w-full">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex-1 min-w-0 flex flex-col gap-[2px]">
          {week.map((cell) => (
            <button
              key={cell.date}
              type="button"
              onClick={() => !cell.future && onSelectDay(cell.date)}
              disabled={cell.future}
              aria-label={cell.date}
              title={cell.date}
              className={`aspect-square w-full rounded-[2px] transition-opacity ${
                cell.future
                  ? "bg-border/40"
                  : cell.rest
                    ? "bg-accent/30 ring-1 ring-accent/40"
                    : colorForRatio(cell.ratio)
              } ${cell.future ? "" : "hover:opacity-80"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
