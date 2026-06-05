"use client";

import { useEffect, useState } from "react";
import { addDays, format, isAfter, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, ClipboardCopy, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { HabitBar } from "@/components/review/habit-bar";
import { getWeeklyReview, saveWeeklyReview } from "@/lib/storage";
import {
  formatWeekRange,
  isWeekLocked,
  makeEmptyReview,
  mostRecentCompletedWeekStart,
  summarizeWeek,
  thisWeekStart,
  weekToMarkdown,
  type WeekSummary,
} from "@/lib/review";
import type { WeeklyReview } from "@/lib/types";

export default function ReviewPage() {
  const [mounted, setMounted] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => new Date());
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    setWeekStart(mostRecentCompletedWeekStart(new Date()));

    const onVisibility = () => {
      if (
        document.visibilityState !== "visible" &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const key = format(weekStart, "yyyy-MM-dd");
    setReview(getWeeklyReview(key) ?? makeEmptyReview(key));
    setSummary(summarizeWeek(weekStart));
  }, [mounted, weekStart]);

  if (!mounted || !review || !summary) {
    return <main className="min-h-dvh" aria-hidden />;
  }

  const today = new Date();
  const currentWeekStart = thisWeekStart(today);
  const canGoForward = isAfter(currentWeekStart, weekStart);
  const locked = isWeekLocked(weekStart, today);

  const updateReview = (patch: Partial<WeeklyReview>) => {
    setReview((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveWeeklyReview(next);
      return next;
    });
  };

  const copyMarkdown = async () => {
    try {
      const md = weekToMarkdown(weekStart);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-md px-5 pt-10 pb-32 space-y-8"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] uppercase tracking-[0.18em] text-muted">
            Review
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight text-foreground">
            Weekly review
          </h1>
        </div>
        <button
          type="button"
          onClick={copyMarkdown}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 min-h-9 text-[12px] text-foreground hover:border-accent/60 transition-colors"
          aria-label="Copy week as Markdown"
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Markdown"}
        </button>
      </header>

      <section className="flex items-center justify-between">
        <WeekArrow
          direction="prev"
          onClick={() => setWeekStart((d) => subDays(d, 7))}
        />
        <div className="text-center">
          <p className="text-[13px] uppercase tracking-[0.18em] text-muted">
            Week of
          </p>
          <p
            key={format(weekStart, "yyyy-MM-dd")}
            className="text-[15px] font-medium tracking-tight text-foreground mt-0.5 tabular-nums"
          >
            {formatWeekRange(weekStart)}
          </p>
        </div>
        <WeekArrow
          direction="next"
          onClick={() => setWeekStart((d) => addDays(d, 7))}
          disabled={!canGoForward}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Summary
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Miles"
            value={summary.miles}
            suffix="mi"
            delta={round1(summary.miles - summary.prev.miles)}
          />
          <StatCard
            label="Cold calls"
            value={summary.coldCallsTotal}
            sub={`${summary.coldCallsPerWeekday}/weekday`}
            delta={summary.coldCallsTotal - summary.prev.coldCallsTotal}
          />
          <StatCard
            label="Avg sleep"
            value={summary.avgSleepHours}
            suffix="hr"
            delta={round1(summary.avgSleepHours - summary.prev.avgSleepHours)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Habit completion
        </h2>
        {summary.habits.length === 0 ? (
          <p className="text-[13px] text-muted">
            No habits configured. Add some in Settings.
          </p>
        ) : (
          <div className="rounded-2xl border border-border bg-surface px-5 py-4 space-y-2">
            {summary.habits.map((habit) => {
              const total = summary.habitScheduled[habit.id] || 0;
              const count = summary.habitCompletion[habit.id] ?? 0;
              const prevCount = summary.prev.habitCompletion[habit.id] ?? 0;
              return (
                <HabitBar
                  key={habit.id}
                  label={habit.label}
                  count={count}
                  total={Math.max(total, habit.weeklyTarget ?? 0)}
                  delta={count - prevCount}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
            Reflection
          </h2>
          {locked ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Lock className="h-3 w-3" /> locked
            </span>
          ) : null}
        </div>

        <ReflectionField
          label="Biggest win"
          placeholder="What went best this week?"
          defaultValue={review.biggestWin}
          locked={locked}
          onCommit={(v) => updateReview({ biggestWin: v })}
        />
        <ReflectionField
          label="Biggest lesson"
          placeholder="What did you learn?"
          defaultValue={review.biggestLesson}
          locked={locked}
          onCommit={(v) => updateReview({ biggestLesson: v })}
        />
        <ReflectionField
          label="One thing to change next week"
          placeholder="What will you do differently?"
          defaultValue={review.changeNextWeek}
          locked={locked}
          onCommit={(v) => updateReview({ changeNextWeek: v })}
        />
      </section>
    </motion.main>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function WeekArrow({
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
      aria-label={direction === "prev" ? "Previous week" : "Next week"}
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

function StatCard({
  label,
  value,
  suffix,
  sub,
  delta,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  sub?: string;
  delta?: number;
}) {
  const isLong = typeof value === "string" && value.length > 6;
  return (
    <div className="rounded-xl border border-border bg-surface p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
          {label}
        </span>
        {delta !== undefined && delta !== 0 ? (
          <span
            className={`text-[10px] tabular-nums ${
              delta > 0 ? "text-accent" : "text-muted"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        ) : null}
      </div>
      <span
        className={`font-semibold tracking-tight text-foreground tabular-nums leading-none ${
          isLong ? "text-[16px]" : "text-[22px]"
        }`}
      >
        {value}
        {suffix ? (
          <span className="text-[12px] font-normal text-muted ml-0.5">
            {suffix}
          </span>
        ) : null}
      </span>
      {sub ? (
        <span className="text-[11px] text-muted tabular-nums">{sub}</span>
      ) : null}
    </div>
  );
}

function ReflectionField({
  label,
  placeholder,
  defaultValue,
  locked,
  onCommit,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
  locked: boolean;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[12px] text-muted">{label}</span>
      <textarea
        key={defaultValue}
        defaultValue={defaultValue}
        readOnly={locked}
        placeholder={locked && !defaultValue ? "—" : placeholder}
        rows={3}
        onBlur={locked ? undefined : (e) => onCommit(e.target.value)}
        className={`block w-full rounded-2xl border border-border p-4 text-[15px] text-foreground placeholder:text-muted/60 outline-none transition-colors resize-none ${
          locked
            ? "bg-surface/50 cursor-not-allowed"
            : "bg-surface focus:border-accent/60"
        }`}
      />
    </label>
  );
}
