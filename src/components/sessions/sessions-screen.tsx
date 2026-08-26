"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { differenceInCalendarDays, eachDayOfInterval, format, parseISO } from "date-fns";
import { getHabits } from "@/lib/habits";
import { buildLogIndex, stateOf, type LogIndex } from "@/lib/log-index";
import { trainingBlockOn, trainingLabels } from "@/lib/schedule";
import { SWEEP } from "@/lib/motion";
import { weekDays } from "@/lib/week";
import { RunTrends } from "./run-trends";

/**
 * Training, session by session.
 *
 * Every aggregate in this app collapses six different training days into one
 * boolean called Training, so "training 11/13" can be true while the Long Run
 * has been missed four Saturdays running. `lastTrainingNote` already does this
 * per-session join for a single result, and its own comment explains why —
 * comparable numbers only come from comparable sessions. Nothing has ever shown
 * the aggregate.
 *
 * Five rows, and the row count is a constant rather than a function of the
 * habit registry: the sessions come from the weekly template, which has exactly
 * five distinct training labels. That is what lets this page live on a surface
 * that cannot scroll and never need a fallback.
 *
 * Four facts per session, and no more: what it is, how long since the last one,
 * how often it actually happens, and what you wrote the last time.
 */

interface Row {
  label: string;
  done: number;
  scheduled: number;
  rate: number | null;
  sinceDays: number | null;
  note: string | null;
  noteDate: string | null;
}

function build(today: string): { rows: Row[]; weekDone: number; weekPlanned: number } {
  const ix: LogIndex = buildLogIndex();
  const habits = getHabits();
  const training = habits.find((h) => h.anchor?.kind === "training");
  const labels = trainingLabels();
  const rows: Row[] = labels.map((label) => ({
    label,
    done: 0,
    scheduled: 0,
    rate: null,
    sinceDays: null,
    note: null,
    noteDate: null,
  }));
  const byLabel = new Map(rows.map((r) => [r.label, r]));

  if (training && ix.first) {
    const end = parseISO(today);
    const start = parseISO(ix.first);
    if (start <= end) {
      for (const d of eachDayOfInterval({ start, end })) {
        const date = format(d, "yyyy-MM-dd");
        const block = trainingBlockOn(date);
        if (!block) continue;
        const row = byLabel.get(block.label);
        if (!row) continue;

        const s = stateOf(ix, training, date, today);
        if (s !== "none") {
          row.scheduled += 1;
          if (s === "done") row.done += 1;
        }
        if (s === "done") {
          // Ascending walk, so the last write wins and is the most recent.
          row.sinceDays = differenceInCalendarDays(end, d);
        }
        const note = ix.byDate.get(date)?.trainingNote?.trim();
        if (note) {
          row.note = note;
          row.noteDate = date;
        }
      }
    }
  }

  for (const r of rows) r.rate = r.scheduled === 0 ? null : r.done / r.scheduled;

  // This week, Monday-anchored — the same week the mileage bars below draw.
  // It was a rolling seven days for a while, which put two definitions of
  // "week" on one screen a hundred pixels apart.
  let weekDone = 0;
  let weekPlanned = 0;
  for (const date of weekDays(today)) {
    if (!trainingBlockOn(date)) continue;
    weekPlanned += 1;
    if (training && ix.byDate.get(date)?.habits?.[training.id] === true) {
      weekDone += 1;
    }
  }

  return { rows, weekDone, weekPlanned };
}

function since(n: number | null): string {
  if (n == null) return "never";
  if (n === 0) return "today";
  if (n === 1) return "yesterday";
  return `${n}d ago`;
}

export function SessionsScreen({
  today,
  version,
  onOpen,
  onGym,
}: {
  today: string;
  version: number;
  /** Open the full thread of notes for one session type. */
  onOpen: (label: string) => void;
  /** Jump the grid to the gym — a tap path for anyone who lands here looking for it. */
  onGym: () => void;
}) {
  const reduced = useReducedMotion();
  const { rows, weekDone, weekPlanned } = useMemo(
    () => build(today),
    [today, version],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mono-xs shrink-0 text-ink-3">
        this week ·{" "}
        <span className="text-ink-2 tabular-nums">
          {weekDone}/{weekPlanned}
        </span>{" "}
        sessions
      </p>

      <div className="mt-4 divide-y divide-line-soft/60">
        {rows.slice(0, 6).map((r, i) => (
          <motion.button
            key={r.label}
            type="button"
            onClick={() => onOpen(r.label)}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04, ease: SWEEP }}
            className="block w-full py-3 text-left"
            aria-label={`${r.label}, ${r.done} of ${r.scheduled} done, last ${since(r.sinceDays)}`}
          >
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[15px] text-ink-2">{r.label}</span>
              <span className="mono-xs ml-auto shrink-0 tabular-nums text-ink-3">
                {r.scheduled > 0 ? `${r.done}/${r.scheduled}` : "—"}
              </span>
              <span className="mono-xs w-[64px] shrink-0 text-right text-ink-4">
                {since(r.sinceDays)}
              </span>
            </div>

            {/* The rate as a rule, the house language for a proportion. */}
            <span className="relative mt-2 block h-[2px] w-full rounded-pill bg-line-soft">
              <motion.span
                aria-hidden
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${(r.rate ?? 0) * 100}%` }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.04, ease: SWEEP }}
                className="absolute inset-y-0 left-0 rounded-pill bg-ink/70"
              />
            </span>

            <span className="mono-xs mt-2 block h-4 truncate text-ink-3">
              {r.note ?? "no note yet"}
            </span>
          </motion.button>
        ))}
        {rows.length > 6 ? (
          <p className="mono-xs py-2 text-center text-ink-4">
            +{rows.length - 6} more session types
          </p>
        ) : null}
      </div>

      {/* The numbers the R sheet collects, drawn. Anchored to the foot so the
          session rows keep their rhythm; on a short viewport the pace half
          drops before anything else compresses. */}
      <div className="mt-auto shrink-0 pt-3 pb-1">
        <RunTrends today={today} version={version} />
      </div>
      <button
        type="button"
        onClick={onGym}
        className="mono-xs min-h-11 shrink-0 text-center text-ink-3 hover:text-ink"
      >
        the gym — log a lift →
      </button>
    </div>
  );
}
