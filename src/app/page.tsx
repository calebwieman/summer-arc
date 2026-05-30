"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Minus, Plus } from "lucide-react";
import { HabitRow } from "@/components/today/habit-row";
import { CollapseCard } from "@/components/today/collapse-card";
import { ProgressRing } from "@/components/today/progress-ring";
import { getDailyLog, getHabits, saveDailyLog } from "@/lib/storage";
import { currentStreak, recentSleepMedian } from "@/lib/stats";
import {
  DEFAULT_HABITS,
  formatHeaderDate,
  getTodayString,
  makeEmptyLog,
} from "@/lib/today";
import type { DailyLog, HabitDef } from "@/lib/types";

declare global {
  interface Navigator {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  }
}

export default function HomePage() {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [habits, setHabits] = useState<HabitDef[]>(DEFAULT_HABITS);
  const [streak, setStreak] = useState(0);
  const [sleepSuggestion, setSleepSuggestion] = useState(0);

  useEffect(() => {
    const loadToday = () => {
      const today = getTodayString();
      const habitList = getHabits();
      setHabits(habitList);
      setLog((prev) => {
        if (prev && prev.date === today) return prev;
        const fresh = getDailyLog(today) ?? makeEmptyLog(today, habitList);
        // Apply ?check=habit1,habit2 from URL (Apple Shortcuts entry point).
        const params = new URLSearchParams(window.location.search);
        const checkParam = params.get("check");
        if (checkParam) {
          const requested = checkParam.split(",").map((s) => s.trim());
          const validIds = new Set(habitList.map((h) => h.id));
          const next = { ...fresh, habits: { ...fresh.habits } };
          let changed = false;
          for (const key of requested) {
            if (validIds.has(key) && !next.habits[key]) {
              next.habits[key] = true;
              changed = true;
            }
          }
          if (changed) saveDailyLog(next);
          // Clean URL so reloads don't re-fire.
          window.history.replaceState({}, "", window.location.pathname);
          return next;
        }
        return fresh;
      });
      setStreak(currentStreak());
      setSleepSuggestion(recentSleepMedian());
    };
    loadToday();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        // iOS may not fire blur when the user swipes away — commit any pending text edits.
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }
      loadToday();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", loadToday);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", loadToday);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, []);

  const checkedCount = useMemo(
    () =>
      log ? habits.reduce((n, h) => (log.habits[h.id] ? n + 1 : n), 0) : 0,
    [log, habits],
  );

  // Live app badge — visible without opening the app fully.
  useEffect(() => {
    if (!log) return;
    if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
      if (checkedCount > 0) {
        navigator.setAppBadge?.(checkedCount).catch(() => {});
      } else {
        navigator.clearAppBadge?.().catch(() => {});
      }
    }
  }, [checkedCount, log]);

  if (!log) {
    return <main className="min-h-dvh" aria-hidden />;
  }

  const update = (patch: Partial<DailyLog>) => {
    setLog((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveDailyLog(next);
      return next;
    });
  };

  const toggleHabit = (key: string) => {
    setLog((prev) => {
      if (!prev) return prev;
      const next: DailyLog = {
        ...prev,
        habits: { ...prev.habits, [key]: !prev.habits[key] },
      };
      saveDailyLog(next);
      return next;
    });
  };

  const setPriority = (index: 0 | 1 | 2, value: string) => {
    setLog((prev) => {
      if (!prev) return prev;
      const top3 = [...prev.top3Priorities] as [string, string, string];
      top3[index] = value;
      const next = { ...prev, top3Priorities: top3 };
      saveDailyLog(next);
      return next;
    });
  };

  const adjustColdCalls = (delta: number) => {
    update({ coldCalls: Math.max(0, log.coldCalls + delta) });
  };

  return (
    <motion.main
      key={log.date}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-md px-5 pb-32 pt-10 space-y-10"
    >
      {/* 1. Date header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] uppercase tracking-[0.18em] text-muted">
            Today
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight text-foreground">
            {formatHeaderDate(log.date)}
          </h1>
          {streak > 0 ? (
            <span className="mt-2 inline-flex items-center gap-1 text-[12px] text-accent">
              <Flame className="h-3.5 w-3.5" />
              <span className="tabular-nums font-medium">{streak}</span>
              <span className="text-muted">
                day{streak === 1 ? "" : "s"} streak
              </span>
            </span>
          ) : null}
        </div>
        <ProgressRing count={checkedCount} total={habits.length} />
      </header>

      {/* 2. Top 3 priorities */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Top 3 priorities
        </h2>
        <ol className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-5 text-[13px] text-muted tabular-nums">
                {i + 1}.
              </span>
              <input
                type="text"
                defaultValue={log.top3Priorities[i]}
                placeholder="…"
                onBlur={(e) => setPriority(i as 0 | 1 | 2, e.target.value)}
                className="flex-1 min-h-11 bg-transparent text-[15px] text-foreground placeholder:text-muted/60 outline-none border-b border-border focus:border-accent/60 transition-colors py-2"
              />
            </li>
          ))}
        </ol>
      </section>

      {/* 3. Habit checklist */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted px-5">
          Habits
        </h2>
        {habits.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-5 py-6 text-center">
            <p className="text-[14px] text-muted">
              No habits yet. Add them in{" "}
              <Link href="/settings" className="text-accent underline">
                Settings
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface py-1.5">
            {habits.map(({ id, label }) => (
              <HabitRow
                key={id}
                label={label}
                checked={!!log.habits[id]}
                onToggle={() => toggleHabit(id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Cold calls */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Cold calls
        </h2>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
          <CounterButton
            label="Decrement cold calls"
            disabled={log.coldCalls === 0}
            onPress={() => adjustColdCalls(-1)}
          >
            <Minus className="h-5 w-5" />
          </CounterButton>
          <motion.span
            key={log.coldCalls}
            initial={{ scale: 0.85, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="text-[56px] font-semibold tracking-tight text-foreground tabular-nums leading-none"
          >
            {log.coldCalls}
          </motion.span>
          <CounterButton
            label="Increment cold calls"
            onPress={() => adjustColdCalls(1)}
          >
            <Plus className="h-5 w-5" />
          </CounterButton>
        </div>
      </section>

      {/* 5. Collapsible log cards */}
      <section className="space-y-2.5">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Log
        </h2>

        <CollapseCard
          title="Run"
          summary={
            log.runMiles > 0 ? `${log.runMiles} mi` : undefined
          }
        >
          <div className="space-y-4 pt-3">
            <LabeledNumber
              label="Miles"
              defaultValue={log.runMiles}
              step={0.1}
              onCommit={(v) => update({ runMiles: v })}
            />
            <LabeledTextarea
              label="Notes"
              defaultValue={log.runNotes}
              onCommit={(v) => update({ runNotes: v })}
            />
          </div>
        </CollapseCard>

        <CollapseCard title="AM lift">
          <div className="pt-3">
            <LabeledTextarea
              label="Notes"
              defaultValue={log.amLiftNotes}
              onCommit={(v) => update({ amLiftNotes: v })}
            />
          </div>
        </CollapseCard>

        <CollapseCard title="PM lift">
          <div className="pt-3">
            <LabeledTextarea
              label="Notes"
              defaultValue={log.pmLiftNotes}
              onCommit={(v) => update({ pmLiftNotes: v })}
            />
          </div>
        </CollapseCard>

        <CollapseCard
          title="Plunge"
          summary={
            log.plungeMinutes > 0 ? `${log.plungeMinutes} min` : undefined
          }
        >
          <div className="pt-3">
            <LabeledNumber
              label="Minutes"
              defaultValue={log.plungeMinutes}
              step={0.5}
              onCommit={(v) => update({ plungeMinutes: v })}
            />
          </div>
        </CollapseCard>

        <CollapseCard
          title="Sleep"
          summary={log.sleepHours > 0 ? `${log.sleepHours} hr` : undefined}
        >
          <div className="pt-3 space-y-3">
            <LabeledNumber
              key={`sleep-${log.sleepHours}`}
              label="Hours"
              defaultValue={log.sleepHours}
              step={0.25}
              onCommit={(v) => update({ sleepHours: v })}
            />
            {log.sleepHours === 0 && sleepSuggestion > 0 ? (
              <button
                type="button"
                onClick={() => update({ sleepHours: sleepSuggestion })}
                className="text-[12px] text-muted hover:text-accent transition-colors"
              >
                Use {sleepSuggestion}h
                <span className="text-muted/60">
                  {" "}
                  (your recent median)
                </span>
              </button>
            ) : null}
          </div>
        </CollapseCard>
      </section>

      {/* 6. Today's win */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Today&rsquo;s win
        </h2>
        <textarea
          defaultValue={log.win}
          placeholder="What went right?"
          rows={3}
          onBlur={(e) => update({ win: e.target.value })}
          className="block w-full rounded-2xl border border-border bg-surface p-4 text-[15px] text-foreground placeholder:text-muted/60 outline-none focus:border-accent/60 transition-colors resize-none"
        />
      </section>

      {/* 7. Today's lesson */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Today&rsquo;s lesson
        </h2>
        <textarea
          defaultValue={log.lesson}
          placeholder="What did you learn?"
          rows={3}
          onBlur={(e) => update({ lesson: e.target.value })}
          className="block w-full rounded-2xl border border-border bg-surface p-4 text-[15px] text-foreground placeholder:text-muted/60 outline-none focus:border-accent/60 transition-colors resize-none"
        />
      </section>
    </motion.main>
  );
}

function CounterButton({
  children,
  onPress,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onPress}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:border-accent/60 transition-colors"
    >
      {children}
    </motion.button>
  );
}

function LabeledNumber({
  label,
  defaultValue,
  step,
  onCommit,
}: {
  label: string;
  defaultValue: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        defaultValue={defaultValue || ""}
        placeholder="0"
        onBlur={(e) => {
          const v = parseFloat(e.target.value);
          onCommit(Number.isFinite(v) ? v : 0);
        }}
        className="w-24 min-h-11 rounded-lg bg-background/60 border border-border text-right text-[15px] text-foreground placeholder:text-muted/60 outline-none focus:border-accent/60 transition-colors px-3 py-2 tabular-nums"
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  defaultValue,
  onCommit,
}: {
  label: string;
  defaultValue: string;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[13px] text-muted">{label}</span>
      <textarea
        defaultValue={defaultValue}
        rows={3}
        onBlur={(e) => onCommit(e.target.value)}
        className="block w-full rounded-lg bg-background/60 border border-border p-3 text-[15px] text-foreground placeholder:text-muted/60 outline-none focus:border-accent/60 transition-colors resize-none"
      />
    </label>
  );
}
