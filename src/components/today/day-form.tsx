"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { HabitRow } from "@/components/today/habit-row";
import { CollapseCard } from "@/components/today/collapse-card";
import { MoodRow } from "@/components/today/mood-row";
import { PhotoCard } from "@/components/today/photo-card";
import { habitsForDate } from "@/lib/today";
import type { DailyLog, HabitDef } from "@/lib/types";

export interface DayFormProps {
  log: DailyLog;
  habits: HabitDef[];
  /** Per-habit streaks keyed by habit id. Omit for past-day forms. */
  habitStreaks?: Record<string, number>;
  /** Recent sleep median (h). Only used when sleep is unset. */
  sleepSuggestion?: number;
  /** When true, hide the sleep suggestion button. */
  hideSleepSuggestion?: boolean;
  onChange: (patch: Partial<DailyLog>) => void;
}

export function DayForm({
  log,
  habits,
  habitStreaks,
  sleepSuggestion,
  hideSleepSuggestion,
  onChange,
}: DayFormProps) {
  const visibleHabits = useMemo(
    () => habitsForDate(habits, log.date),
    [habits, log.date],
  );

  const toggleHabit = (key: string) => {
    onChange({ habits: { ...log.habits, [key]: !log.habits[key] } });
  };

  const adjustColdCalls = (delta: number) => {
    onChange({ coldCalls: Math.max(0, (log.coldCalls || 0) + delta) });
  };

  return (
    <div className="space-y-10">
      {/* Habits */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted px-5">
          Habits
        </h2>
        {visibleHabits.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-5 py-6 text-center">
            <p className="text-[14px] text-muted">
              No habits scheduled for this day.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface py-1.5">
            {visibleHabits.map(({ id, label }) => (
              <HabitRow
                key={id}
                label={label}
                checked={!!log.habits[id]}
                streak={habitStreaks?.[id] ?? 0}
                onToggle={() => toggleHabit(id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Mood */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Energy
        </h2>
        <MoodRow
          value={log.mood}
          onChange={(v) => onChange({ mood: v })}
        />
      </section>

      {/* Cold calls */}
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

      {/* Photo */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Photo
        </h2>
        <PhotoCard
          photoDataUrl={log.photoDataUrl}
          onChange={(v) => onChange({ photoDataUrl: v })}
        />
      </section>

      {/* Log cards */}
      <section className="space-y-2.5">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Log
        </h2>

        <CollapseCard
          title="Run"
          summary={log.runMiles > 0 ? `${log.runMiles} mi` : undefined}
        >
          <div className="space-y-4 pt-3">
            <LabeledNumber
              key={`miles-${log.date}-${log.runMiles}`}
              label="Miles"
              defaultValue={log.runMiles}
              step={0.1}
              onCommit={(v) => onChange({ runMiles: v })}
            />
            <LabeledTextarea
              key={`runNotes-${log.date}`}
              label="Notes"
              defaultValue={log.runNotes}
              onCommit={(v) => onChange({ runNotes: v })}
            />
          </div>
        </CollapseCard>

        <CollapseCard title="AM lift">
          <div className="pt-3">
            <LabeledTextarea
              key={`amLift-${log.date}`}
              label="Notes"
              defaultValue={log.amLiftNotes}
              onCommit={(v) => onChange({ amLiftNotes: v })}
            />
          </div>
        </CollapseCard>

        <CollapseCard title="PM lift">
          <div className="pt-3">
            <LabeledTextarea
              key={`pmLift-${log.date}`}
              label="Notes"
              defaultValue={log.pmLiftNotes}
              onCommit={(v) => onChange({ pmLiftNotes: v })}
            />
          </div>
        </CollapseCard>

        <CollapseCard
          title="Plunge"
          summary={log.plungeMinutes > 0 ? `${log.plungeMinutes} min` : undefined}
        >
          <div className="pt-3">
            <LabeledNumber
              key={`plunge-${log.date}-${log.plungeMinutes}`}
              label="Minutes"
              defaultValue={log.plungeMinutes}
              step={0.5}
              onCommit={(v) => onChange({ plungeMinutes: v })}
            />
          </div>
        </CollapseCard>

        <CollapseCard
          title="Sleep"
          summary={log.sleepHours > 0 ? `${log.sleepHours} hr` : undefined}
        >
          <div className="pt-3 space-y-3">
            <LabeledNumber
              key={`sleep-${log.date}-${log.sleepHours}`}
              label="Hours"
              defaultValue={log.sleepHours}
              step={0.25}
              onCommit={(v) => onChange({ sleepHours: v })}
            />
            {!hideSleepSuggestion &&
            log.sleepHours === 0 &&
            (sleepSuggestion ?? 0) > 0 ? (
              <button
                type="button"
                onClick={() => onChange({ sleepHours: sleepSuggestion })}
                className="text-[12px] text-muted hover:text-accent transition-colors"
              >
                Use {sleepSuggestion}h
                <span className="text-muted/60"> (your recent median)</span>
              </button>
            ) : null}
          </div>
        </CollapseCard>

        <CollapseCard
          title="Bible"
          summary={log.bibleReading?.trim() || undefined}
        >
          <div className="pt-3">
            <LabeledTextarea
              key={`bible-${log.date}`}
              label="Reading"
              defaultValue={log.bibleReading ?? ""}
              onCommit={(v) => onChange({ bibleReading: v })}
            />
          </div>
        </CollapseCard>
      </section>

      {/* Win */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Today&rsquo;s win
        </h2>
        <textarea
          key={`win-${log.date}`}
          defaultValue={log.win}
          placeholder="What went right?"
          rows={3}
          onBlur={(e) => onChange({ win: e.target.value })}
          className="block w-full rounded-2xl border border-border bg-surface p-4 text-[15px] text-foreground placeholder:text-muted/60 outline-none focus:border-accent/60 transition-colors resize-none"
        />
      </section>

      {/* Lesson */}
      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Today&rsquo;s lesson
        </h2>
        <textarea
          key={`lesson-${log.date}`}
          defaultValue={log.lesson}
          placeholder="What did you learn?"
          rows={3}
          onBlur={(e) => onChange({ lesson: e.target.value })}
          className="block w-full rounded-2xl border border-border bg-surface p-4 text-[15px] text-foreground placeholder:text-muted/60 outline-none focus:border-accent/60 transition-colors resize-none"
        />
      </section>
    </div>
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
