"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { motion } from "framer-motion";
import { getDailyLog, getHabits } from "@/lib/storage";
import { countCheckedHabits } from "@/lib/stats";
import { getTodayString } from "@/lib/today";

interface CalendarGridProps {
  monthDate: Date;
  onSelectDay: (date: string) => void;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function bgForCount(count: number, total: number): string {
  if (count === 0 || total === 0) return "bg-transparent border border-border";
  const ratio = count / total;
  if (ratio < 0.45) return "bg-accent/20 border border-accent/30";
  if (ratio < 0.85) return "bg-accent/50 border border-accent/60";
  return "bg-accent border border-accent";
}

function textForCount(count: number, total: number): string {
  if (count === 0) return "text-muted";
  if (total > 0 && count / total >= 0.85) return "text-[#0a0a0a]";
  return "text-foreground";
}

export function CalendarGrid({ monthDate, onSelectDay }: CalendarGridProps) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = parseISO(getTodayString());
  const habits = getHabits();
  const habitCount = habits.length;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 px-0.5">
        {WEEKDAY_LABELS.map((d, i) => (
          <div
            key={i}
            className="text-center text-[11px] uppercase tracking-[0.12em] text-muted"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthDate);
          const isFuture = isAfter(day, today);
          const isToday = dateStr === getTodayString();
          const log = inMonth && !isFuture ? getDailyLog(dateStr) : null;
          const count = log ? countCheckedHabits(log, habits) : 0;
          const disabled = !inMonth || isFuture;

          return (
            <motion.button
              key={dateStr}
              type="button"
              onClick={() => !disabled && onSelectDay(dateStr)}
              disabled={disabled}
              whileTap={disabled ? undefined : { scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              aria-label={`${format(day, "MMMM d")}, ${count} habits completed`}
              className={`aspect-square flex items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors ${
                disabled
                  ? "opacity-25 cursor-default border border-transparent text-muted"
                  : `${bgForCount(count, habitCount)} ${textForCount(
                      count,
                      habitCount,
                    )} ${isToday ? "ring-1 ring-foreground/40" : ""}`
              }`}
            >
              {format(day, "d")}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
