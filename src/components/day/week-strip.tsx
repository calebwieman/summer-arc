"use client";

import { motion, useReducedMotion } from "motion/react";
import { format, parseISO, subDays } from "date-fns";
import { habitsForDate } from "@/lib/schedule";
import { getDailyLog } from "@/lib/storage";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const H = 26;

export interface WeekDay {
  date: string;
  dow: string;
  done: number;
  total: number;
  isToday: boolean;
}

/** Last seven days ending today, done-vs-scheduled per day. */
export function buildWeek(today: string): WeekDay[] {
  const end = parseISO(today);
  const out: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(end, i);
    const date = format(d, "yyyy-MM-dd");
    const keys = habitsForDate(date);
    const log = getDailyLog(date);
    out.push({
      date,
      dow: DOW[d.getDay()],
      done: keys.filter((k) => log?.habits?.[k]).length,
      total: keys.length,
      isToday: date === today,
    });
  }
  return out;
}

/**
 * Seven days of context on the day screen, so the home surface answers "how has
 * the week gone" without a trip to the record. Height-encoded on a baseline —
 * the same grammar as the 14-day trace, not a grid of tinted squares.
 */
export function WeekStrip({ week }: { week: WeekDay[] }) {
  const reduced = useReducedMotion();

  return (
    <div className="px-5">
      <div className="flex items-end justify-between gap-1.5" style={{ height: H }}>
        {week.map((d, i) => {
          const pct = d.total === 0 ? 0 : d.done / d.total;
          return (
            <div key={d.date} className="relative flex flex-1 items-end" style={{ height: H }}>
              <span className="absolute inset-x-0 bottom-0 h-px bg-line-soft" />
              <motion.span
                initial={reduced ? { opacity: 0 } : { scaleY: 0 }}
                animate={reduced ? { opacity: 1 } : { scaleY: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 26,
                  delay: 0.28 + i * 0.035,
                }}
                style={{
                  height: Math.max(2, pct * H),
                  transformOrigin: "bottom",
                }}
                className={`w-full rounded-xs ${
                  d.isToday ? "bg-ink/70" : pct === 1 ? "bg-ink/45" : "bg-ink/25"
                }`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between gap-1.5">
        {week.map((d) => (
          <span
            key={d.date}
            className={`mono-xs flex-1 text-center ${
              d.isToday ? "text-ink-2" : "text-ink-4"
            }`}
          >
            {d.dow}
          </span>
        ))}
      </div>
    </div>
  );
}
