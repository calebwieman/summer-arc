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
import { Bed } from "lucide-react";
import { getDailyLog, getHabits } from "@/lib/storage";
import { countScheduledChecked } from "@/lib/stats";
import { getTodayString, habitsForDate } from "@/lib/today";

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
          const scheduled = habitsForDate(habits, dateStr);
          const count = log ? countScheduledChecked(log, habits) : 0;
          const disabled = !inMonth || isFuture;
          const restDay = !!log?.restDay;

          return (
            <motion.button
              key={dateStr}
              type="button"
              onClick={() => !disabled && onSelectDay(dateStr)}
              disabled={disabled}
              whileTap={disabled ? undefined : { scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              aria-label={
                restDay
                  ? `${format(day, "MMMM d")}, rest day`
                  : `${format(day, "MMMM d")}, ${count} habits completed`
              }
              className={`relative aspect-square flex items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors ${
                disabled
                  ? "opacity-25 cursor-default border border-transparent text-muted"
                  : restDay
                    ? "border border-dashed border-accent/40 text-muted"
                    : `${bgForCount(count, scheduled.length)} ${textForCount(
                        count,
                        scheduled.length,
                      )} ${isToday ? "ring-1 ring-foreground/40" : ""}`
              } ${!disabled && isToday ? "ring-1 ring-foreground/40" : ""}`}
            >
              {format(day, "d")}
              {restDay ? (
                <Bed
                  className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-accent/70"
                  aria-hidden
                />
              ) : null}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
