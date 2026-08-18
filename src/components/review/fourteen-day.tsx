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
 * Two consecutive misses draw a flag under the run.
 *
 * The page is locked and cannot scroll, so the rows have to fit whatever the
 * habit count happens to be. Past five habits it switches to a tighter row —
 * shorter track, and the streak moves up onto the fraction line rather than
 * taking one of its own. Restoring a summer-arc backup brings eight across, so
 * this is the normal case, not the edge one.
 */

const FULL = { track: 34, baseline: 21, up: 14, down: 9 };
const TIGHT = { track: 24, baseline: 15, up: 10, down: 6 };
type Dims = typeof FULL;

function Tick({
  scheduled,
  done,
  isToday,
  preAdoption,
  d,
}: {
  scheduled: boolean;
  done: boolean;
  isToday: boolean;
  preAdoption: boolean;
  d: Dims;
}) {
  // Before the first log there is no data — drawing a miss would be a lie.
  if (!scheduled || (preAdoption && !done)) {
    return (
      <span
        aria-hidden
        className="absolute left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-pill bg-ink-4"
        style={{ top: d.baseline - 1 }}
      />
    );
  }

  if (done) {
    return (
      <span
        aria-hidden
        className="absolute left-1/2 w-[3px] -translate-x-1/2 rounded-pill bg-ink"
        style={{ top: d.baseline - d.up, height: d.up }}
      />
    );
  }

  if (isToday) {
    return (
      <span
        aria-hidden
        className="absolute left-1/2 w-[3px] -translate-x-1/2 rounded-pill border border-ink-3 bg-transparent"
        style={{ top: d.baseline - d.up, height: d.up }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="absolute left-1/2 w-[3px] -translate-x-1/2 rounded-pill bg-bad/80"
      style={{ top: d.baseline, height: d.down }}
    />
  );
}

function Row({
  s,
  index,
  compact,
  caption,
}: {
  s: HabitSeries;
  index: number;
  compact: boolean;
  /** At most one row on the page carries the on-the-line line. */
  caption: boolean;
}) {
  const flagged = new Set(s.flagRun);
  const d = compact ? TIGHT : FULL;

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
      className={compact ? "py-1.5" : "roomy-when-tall py-3"}
    >
      <div className="flex items-baseline gap-2.5">
        <HabitGlyph
          habit={s.key}
          code={s.code}
          /*
            The glyph carries both warnings, which is what lets the captions be
            rationed. With eight habits restored the page has no room for eight
            lines of prose, and eight of them would not be a signal anyway.
          */
          state={
            s.missedTwice
              ? "fault"
              : s.onTheLine
                ? "overdue"
                : s.rate >= 0.8
                  ? "done"
                  : "pending"
          }
        />
        <span className="mono-xs truncate text-ink-2">{s.label}</span>
        {/* Beside the label, not beside the fraction. Right-aligning it put
            "0/7" next to "10/13" — two fractions, different meanings, one
            column. The arrow says run-of, and best is dropped here; the
            seismograph is the reading when there are this many rows. */}
        {compact && s.streak > 0 ? (
          <span className="mono-xs shrink-0 text-ink-4">↑{s.streak}</span>
        ) : null}
        <span className="mono-sm ml-auto shrink-0 tabular-nums text-ink-3">
          {s.doneCount}/{s.scheduledCount}
        </span>
      </div>

      {compact ? null : (
        <div className="mono-xs mt-1 flex items-baseline gap-3 text-ink-3">
          <span className={s.streak > 0 ? "text-ink-2" : undefined}>
            streak {s.streak}
          </span>
          {s.best > 0 ? <span>best {s.best}</span> : null}
        </div>
      )}

      <div
        className={`relative grid ${compact ? "mt-1" : "mt-2"}`}
        style={{
          height: d.track,
          gridTemplateColumns: `repeat(${s.samples.length}, 1fr)`,
        }}
      >
        {/* Baseline */}
        <span
          aria-hidden
          className="absolute inset-x-0 h-px bg-line-soft"
          style={{ top: d.baseline }}
        />
        {s.samples.map((sample, i) => (
          <span key={sample.date} className="relative">
            <Tick
              scheduled={sample.scheduled}
              done={sample.done}
              isToday={sample.isToday}
              preAdoption={sample.preAdoption}
              d={d}
            />
            {flagged.has(i) ? (
              <span
                aria-hidden
                className="absolute inset-x-[15%] bg-bad"
                style={{ top: d.baseline + d.down + 3, height: 2 }}
              />
            ) : null}
          </span>
        ))}
      </div>

      {/*
        One caption slot, and at most one line in it. The app's only failure
        signal used to fire after the second miss — a day too late to act on the
        rule the whole thing is named for. The window where "never miss twice"
        is actionable is exactly one day wide, and this is the app finally
        speaking inside it.
      */}
      {compact ? null : s.missedTwice ? (
        <p className="mono-xs mt-1.5 text-bad">missed twice — fix today</p>
      ) : caption ? (
        <p className="mono-xs mt-1.5 text-warn">on the line — not twice</p>
      ) : null}
    </motion.div>
  );
}

export function FourteenDay({ series }: { series: HabitSeries[] }) {
  const axis = series[0]?.samples ?? [];
  const compact = series.length > 5;
  /*
    One on-the-line caption, not one per row. The signal is "the next miss
    makes two" and it is only actionable on the habit whose block comes first,
    so the first in register order gets the line and the rest carry it on their
    glyph. Eight captions is a wall of text, and a wall of text is not a signal.
  */
  const lineIndex = series.findIndex((s) => s.onTheLine && !s.missedTwice);

  return (
    <div className="min-h-0 overflow-hidden">
      <div className="divide-y divide-line-soft/60">
        {series.map((s, i) => (
          <Row
            key={s.key}
            s={s}
            index={i}
            compact={compact}
            caption={i === lineIndex}
          />
        ))}
      </div>

      <div
        className="mt-2 grid"
        style={{ gridTemplateColumns: `repeat(${axis.length}, 1fr)` }}
        aria-hidden
      >
        {axis.map((d) => (
          <span
            key={d.date}
            className={`mono-xs text-center ${
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
