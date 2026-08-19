"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { runHistory, type RunPoint, type WeekBar } from "@/lib/run-stats";
import { SWEEP } from "@/lib/motion";

/**
 * The run log, drawn.
 *
 * Everything here is one series on one hue, which is the house palette anyway —
 * columns for the magnitude question (how much), dots on a line for the trend
 * question (how fast). Two scales means two charts; a second y-axis is how
 * charts lie. The marks reuse WeekLoad's grammar — 10px rounded-pill columns,
 * a baseline dot for a zero — so the app keeps one chart language.
 *
 * There is no hover on a phone, so the tooltip is a readout line: tapping any
 * mark writes its numbers into the caption beside the title, and the latest
 * mark is the caption at rest. One value is always legible without touching
 * anything, and none of them are painted on the chart to collide.
 */

const COL_H = 56;
const PACE_H = 48;

function Caption({ text }: { text: string }) {
  return (
    <motion.span
      key={text}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      className="mono-xs tabular-nums text-ink-3"
    >
      {text}
    </motion.span>
  );
}

function WeeklyMiles({
  weeks,
  reduced,
}: {
  weeks: WeekBar[];
  reduced: boolean | null;
}) {
  const [picked, setPicked] = useState<WeekBar | null>(null);
  const peak = Math.max(1, ...weeks.map((w) => w.miles));
  const shown = picked ?? weeks[weeks.length - 1];

  return (
    <section aria-label="Weekly mileage, last eight weeks">
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">Mileage</h3>
        <Caption text={`wk ${shown.label} · ${shown.miles} mi`} />
      </div>

      <div className="mt-2 flex items-end gap-1.5" style={{ height: COL_H }}>
        {weeks.map((w, i) => {
          const h = w.miles === 0 ? 0 : Math.max(5, (w.miles / peak) * COL_H);
          return (
            <button
              key={w.start}
              type="button"
              aria-label={`week of ${w.label}, ${w.miles} miles`}
              onClick={() => setPicked(w)}
              className="relative flex flex-1 flex-col items-stretch justify-end"
              style={{ height: COL_H }}
            >
              {w.miles === 0 ? (
                // A rest week is a fact, not a gap — the same baseline dot the
                // load chart uses for a rest day.
                <span
                  aria-hidden
                  className="mx-auto mb-[1px] h-[3px] w-[3px] rounded-pill bg-ink-4"
                />
              ) : (
                <motion.span
                  aria-hidden
                  initial={reduced ? false : { height: 0 }}
                  animate={{ height: h }}
                  transition={{
                    duration: 0.45,
                    delay: Math.min(0.2, i * 0.03),
                    ease: SWEEP,
                  }}
                  className={`mx-auto w-[10px] rounded-pill ${
                    w === shown ? "bg-ink" : "bg-ink/45"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex gap-1.5 border-t border-line-soft pt-1">
        {weeks.map((w) => (
          <span
            key={w.start}
            aria-hidden
            className={`mono-xs flex-1 text-center ${
              w.isCurrent ? "text-ink-2" : "text-ink-4"
            }`}
          >
            {w.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function PaceTrend({
  runs,
  reduced,
}: {
  runs: RunPoint[];
  reduced: boolean | null;
}) {
  const paced = runs.filter((r) => r.paceMin != null);
  const [picked, setPicked] = useState<RunPoint | null>(null);
  if (paced.length === 0) return null;
  const shown = picked ?? paced[paced.length - 1];

  // Faster at the top, the way every watch draws it. A degenerate range (every
  // run the same pace) sits mid-track rather than dividing by zero.
  const lo = Math.min(...paced.map((r) => r.paceMin as number));
  const hi = Math.max(...paced.map((r) => r.paceMin as number));
  const span = hi - lo;
  const yOf = (p: number) =>
    span === 0 ? PACE_H / 2 : 6 + ((p - lo) / span) * (PACE_H - 12);
  const xOf = (i: number) =>
    paced.length === 1 ? 50 : (i / (paced.length - 1)) * 100;

  return (
    <section aria-label="Pace per run" className="drop-when-short">
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">Pace</h3>
        <Caption
          text={`${shown.label} · ${shown.miles} mi · ${shown.pace}/mi`}
        />
      </div>

      <div className="relative mt-2" style={{ height: PACE_H }}>
        {/* The connecting line, non-scaling so it stays a hairline. */}
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${PACE_H}`}
          preserveAspectRatio="none"
        >
          <motion.polyline
            points={paced
              .map((r, i) => `${xOf(i)},${yOf(r.paceMin as number)}`)
              .join(" ")}
            fill="none"
            stroke="var(--line-mid)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: SWEEP }}
          />
        </svg>
        {/* Dots as HTML, so a stretched viewBox cannot squash them. */}
        {paced.map((r, i) => (
          <button
            key={r.date}
            type="button"
            aria-label={`${r.label}, ${r.miles} miles at ${r.pace} per mile`}
            onClick={() => setPicked(r)}
            className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{
              left: `${xOf(i)}%`,
              top: yOf(r.paceMin as number),
            }}
          >
            <span
              aria-hidden
              className={`rounded-pill ${
                r === shown ? "h-[7px] w-[7px] bg-ink" : "h-[5px] w-[5px] bg-ink/55"
              }`}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 border-t border-line-soft pt-1 text-right">
        <span className="mono-xs text-ink-4">faster ↑ · last {paced.length}</span>
      </div>
    </section>
  );
}

export function RunTrends({
  today,
  version,
}: {
  today: string;
  /** Bumped after any write, so the charts recount. */
  version: number;
}) {
  const reduced = useReducedMotion();
  const { runs, weeks } = useMemo(
    () => runHistory(today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, version],
  );

  if (runs.length === 0) {
    return (
      <p className="mono-xs text-center text-ink-4">
        no runs logged yet — tap R on the day and give it miles
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <WeeklyMiles weeks={weeks} reduced={reduced} />
      <PaceTrend runs={runs} reduced={reduced} />
    </div>
  );
}
