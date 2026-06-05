"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { CalendarGrid } from "@/components/history/calendar-grid";
import { DaySheet } from "@/components/history/day-sheet";
import { DaySearch } from "@/components/history/day-search";
import { StatsCard } from "@/components/history/stats-card";
import { YearlyHeatmap } from "@/components/history/yearly-heatmap";
import { getDailyLog } from "@/lib/storage";
import {
  bestStreak,
  currentStreak,
  monthStats,
  type MonthStats,
} from "@/lib/stats";
import { getTodayString } from "@/lib/today";
import type { DailyLog } from "@/lib/types";

export default function HistoryPage() {
  const [mounted, setMounted] = useState(false);
  const [monthDate, setMonthDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [streaks, setStreaks] = useState({ current: 0, best: 0 });
  const [stats, setStats] = useState<MonthStats>({
    miles: 0,
    coldCalls: 0,
    habitCheckins: 0,
  });

  useEffect(() => {
    setMounted(true);
    setMonthDate(startOfMonth(new Date()));
    // Handle ?d=YYYY-MM-DD deep link (used by Today "Edit yesterday").
    const params = new URLSearchParams(window.location.search);
    const d = params.get("d");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setSelectedDate(d);
      setSelectedLog(getDailyLog(d));
      setMonthDate(startOfMonth(parseISO(d)));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const refresh = () => {
      setStreaks({ current: currentStreak(), best: bestStreak() });
      setStats(monthStats(monthDate));
    };
    refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [mounted, monthDate, refreshTick]);

  const handleSelectDay = (date: string) => {
    setSelectedDate(date);
    setSelectedLog(getDailyLog(date));
  };

  const handleClose = () => {
    setSelectedDate(null);
    setSelectedLog(null);
  };

  const handleDayChange = () => {
    setRefreshTick((t) => t + 1);
  };

  const today = new Date();
  const isCurrentMonth = isSameMonth(monthDate, today);
  const calendarKey = useMemo(
    () => `${format(monthDate, "yyyy-MM")}-${refreshTick}`,
    [monthDate, refreshTick],
  );
  const heatmapKey = useMemo(() => `heatmap-${refreshTick}`, [refreshTick]);

  if (!mounted) {
    return <main className="min-h-dvh" aria-hidden />;
  }

  return (
    <>
      <motion.main
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mx-auto max-w-md px-5 pt-10 pb-32 space-y-8"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] uppercase tracking-[0.18em] text-muted">
              History
            </p>
            <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight text-foreground">
              {format(monthDate, "MMMM yyyy")}
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <DaySearch onSelectDay={handleSelectDay} />
            {!isCurrentMonth ? (
              <motion.button
                type="button"
                onClick={() => setMonthDate(startOfMonth(new Date()))}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 min-h-9 text-[12px] text-foreground hover:border-accent/60 transition-colors"
              >
                Today
              </motion.button>
            ) : null}
          </div>
        </header>

        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatsCard
              label="Current streak"
              value={streaks.current}
              suffix={streaks.current === 1 ? "day" : "days"}
            />
            <StatsCard
              label="Best streak"
              value={streaks.best}
              suffix={streaks.best === 1 ? "day" : "days"}
            />
            <StatsCard label="Miles" value={stats.miles} suffix="mi" />
            <StatsCard label="Cold calls" value={stats.coldCalls} />
          </div>
          <p className="text-[13px] text-muted">
            <span className="text-foreground tabular-nums">
              {stats.habitCheckins}
            </span>{" "}
            habit check-ins this month
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
            Last 26 weeks
          </h2>
          <YearlyHeatmap key={heatmapKey} onSelectDay={handleSelectDay} />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <MonthArrow
              direction="prev"
              onClick={() => setMonthDate((d) => subMonths(d, 1))}
            />
            <span className="text-[13px] uppercase tracking-[0.18em] text-muted">
              {format(monthDate, "MMMM")}
            </span>
            <MonthArrow
              direction="next"
              onClick={() => setMonthDate((d) => addMonths(d, 1))}
              disabled={isCurrentMonth}
            />
          </div>

          <CalendarGrid
            key={calendarKey}
            monthDate={monthDate}
            onSelectDay={handleSelectDay}
          />

          <Legend />
        </section>
      </motion.main>

      <DaySheet
        date={selectedDate}
        log={selectedLog}
        onClose={handleClose}
        onChange={handleDayChange}
      />
    </>
  );
}

function MonthArrow({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-label={direction === "prev" ? "Previous month" : "Next month"}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-25 disabled:cursor-not-allowed hover:border-accent/60 transition-colors"
    >
      {direction === "prev" ? (
        <ChevronLeft className="h-4 w-4" />
      ) : (
        <ChevronRight className="h-4 w-4" />
      )}
    </motion.button>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted">
      <span>Less</span>
      <div className="flex gap-1">
        <span className="h-3 w-3 rounded-sm border border-border" />
        <span className="h-3 w-3 rounded-sm bg-accent/20 border border-accent/30" />
        <span className="h-3 w-3 rounded-sm bg-accent/50 border border-accent/60" />
        <span className="h-3 w-3 rounded-sm bg-accent" />
      </div>
      <span>More</span>
    </div>
  );
}
