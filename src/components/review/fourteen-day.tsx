"use client";

import { motion } from "motion/react";
import type { HabitSeries } from "@/lib/series";
import { HabitGlyph } from "@/components/day/habit-glyph";

/**
 * Fourteen days as a seismograph, not a heatmap.
 *   hit      → deflects UP from the baseline
 *   miss     → deflects DOWN, in --bad
 *   rest day → flat, a dot on the baseline (never a miss)
 *   today    → hollow, still in play
 * Two consecutive misses draw a flag under the run. That is the only failure
 * signal in the app — there is no streak anywhere.
 */

const TRACK_H = 34;
const BASELINE = 21;
const UP = 14;
const DOWN = 9;

function Tick({
  scheduled,
  done,
  isToday,
  preAdoption,
}: {
  scheduled: boolean;
  done: boolean;
  isToday: boolean;
  preAdoption: boolean;
}) {
  // Before the first log there is no data — drawing a miss would be a lie.
  if (!scheduled || (preAdoption && !done)) {
    return (
      <span
        aria-hidden
        className="absolute left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-pill bg-ink-4"
        style={{ top: BASELINE - 1 }}
      />
    );
  }

  if (done) {
    return (
      <span
        aria-hidden
        className="absolute left-1/2 w-[3px] -translate-x-1/2 rounded-pill bg-ink"
        style={{ top: BASELINE - UP, height: UP }}
      />
    );
  }

  if (isToday) {
    return (
      <span
        aria-hidden
        className="absolute left-1/2 w-[3px] -translate-x-1/2 rounded-pill border border-ink-3 bg-transparent"
        style={{ top: BASELINE - UP, height: UP }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="absolute left-1/2 w-[3px] -translate-x-1/2 rounded-pill bg-bad/80"
      style={{ top: BASELINE, height: DOWN }}
    />
  );
}

function Row({ s, index }: { s: HabitSeries; index: number }) {
  const flagged = new Set(s.flagRun);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 30,
        delay: index * 0.045,
      }}
      className="py-3"
    >
      <div className="flex items-baseline gap-2.5">
        <HabitGlyph
          habit={s.key}
          state={s.missedTwice ? "fault" : s.rate >= 0.8 ? "done" : "pending"}
        />
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-ink-2">
          {s.label}
        </span>
        {/* The fraction only. A percentage beside it was both redundant and,
            when the two were computed over different windows, contradictory. */}
        <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums tracking-[0.06em] text-ink-3">
          {s.doneCount}/{s.scheduledCount}
        </span>
      </div>

      <div
        className="relative mt-2 grid"
        style={{
          height: TRACK_H,
          gridTemplateColumns: `repeat(${s.samples.length}, 1fr)`,
        }}
      >
        {/* Baseline */}
        <span
          aria-hidden
          className="absolute inset-x-0 h-px bg-line-soft"
          style={{ top: BASELINE }}
        />
        {s.samples.map((d, i) => (
          <span key={d.date} className="relative">
            <Tick scheduled={d.scheduled} done={d.done} isToday={d.isToday} preAdoption={d.preAdoption} />
            {flagged.has(i) ? (
              <span
                aria-hidden
                className="absolute inset-x-[15%] bg-bad"
                style={{ top: BASELINE + DOWN + 4, height: 2 }}
              />
            ) : null}
          </span>
        ))}
      </div>

      {s.missedTwice ? (
        <p className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-bad">
          missed twice — fix today
        </p>
      ) : null}
    </motion.div>
  );
}

export function FourteenDay({ series }: { series: HabitSeries[] }) {
  const axis = series[0]?.samples ?? [];

  return (
    <div className="pb-10">
      {/* The heading now lives on the surface itself so it can take focus. */}
      <p className="meta text-right">never miss twice</p>

      <div className="mt-5 divide-y divide-line-soft/60">
        {series.map((s, i) => (
          <Row key={s.key} s={s} index={i} />
        ))}
      </div>

      {/* Day-of-week axis */}
      <div
        className="mt-3 grid"
        style={{ gridTemplateColumns: `repeat(${axis.length}, 1fr)` }}
        aria-hidden
      >
        {axis.map((d) => (
          <span
            key={d.date}
            className={`text-center font-mono text-[8.5px] uppercase tracking-[0.1em] ${
              d.isToday ? "text-ink-2" : "text-ink-3"
            }`}
          >
            {d.dow}
          </span>
        ))}
      </div>
    </div>
  );
}
