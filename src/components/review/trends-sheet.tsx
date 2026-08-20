"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sheet } from "@/components/ui/sheet";
import { RunTrends } from "@/components/sessions/run-trends";
import { formatClock } from "@/lib/clock";
import { SWEEP } from "@/lib/motion";
import {
  contentSeries,
  deepWeeks,
  formatHours,
  stampSeries,
  type StampPoint,
  type WeekMinutes,
} from "@/lib/trend-stats";

/**
 * Every chart in one place, in a sheet — the one surface in the app that is
 * allowed to scroll, which is what lets "visualize everything" be literal
 * without fighting the fixed-height pages. Same grammar throughout: one hue,
 * 10px rounded-pill columns, dots on hairlines, a tap writing its numbers into
 * the caption instead of a tooltip.
 */

const COL_H = 46;
const DRIFT_H = 56;

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

/** Weekly deep-work minutes — the same column chart the mileage uses. */
function DeepWork({ weeks }: { weeks: WeekMinutes[] }) {
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const peak = Math.max(1, ...weeks.map((w) => w.minutes));
  const any = weeks.some((w) => w.minutes > 0);
  const shown =
    weeks.find((w) => w.start === picked) ?? weeks[weeks.length - 1];

  if (!any) {
    return (
      <section>
        <h3 className="kicker">Deep work</h3>
        <p className="mono-xs mt-2 text-ink-4">
          nothing logged yet — the block has a minutes field
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Deep work per week">
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">Deep work</h3>
        <Caption text={`wk ${shown.label} · ${formatHours(shown.minutes)}`} />
      </div>
      <div className="mt-2 flex items-end gap-1.5" style={{ height: COL_H }}>
        {weeks.map((w, i) => {
          const h = w.minutes === 0 ? 0 : Math.max(5, (w.minutes / peak) * COL_H);
          return (
            <button
              key={w.start}
              type="button"
              aria-label={`week of ${w.label}, ${formatHours(w.minutes)} of deep work`}
              onClick={() => setPicked(w.start)}
              className="relative flex flex-1 flex-col items-stretch justify-end"
              style={{ height: COL_H }}
            >
              {w.minutes === 0 ? (
                <span
                  aria-hidden
                  className="mx-auto mb-[1px] h-[3px] w-[3px] rounded-pill bg-ink-4"
                />
              ) : (
                <motion.span
                  aria-hidden
                  initial={reduced ? false : { height: 0 }}
                  animate={{ height: h }}
                  transition={{ duration: 0.45, delay: Math.min(0.2, i * 0.03), ease: SWEEP }}
                  className={`mx-auto w-[10px] rounded-pill ${
                    w.start === shown.start ? "bg-ink" : "bg-ink/45"
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

/**
 * When the day actually started. Earlier is up, the way "better" reads on
 * every other chart here, and the 4:45 target is a hairline to drift against.
 */
function WakeDrift({ points }: { points: StampPoint[] }) {
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);

  if (points.length < 2) {
    return (
      <section>
        <h3 className="kicker">Wake drift</h3>
        <p className="mono-xs mt-2 text-ink-4">
          throws of the wake latch land here — two mornings makes a line
        </p>
      </section>
    );
  }

  const shown = points.find((p) => p.date === picked) ?? points[points.length - 1];
  const target = 4 * 60 + 45;
  const lo = Math.min(target, ...points.map((p) => p.minute));
  const hi = Math.max(target, ...points.map((p) => p.minute));
  const span = Math.max(1, hi - lo);
  const yOf = (m: number) => 6 + ((m - lo) / span) * (DRIFT_H - 12);
  const xOf = (i: number) =>
    points.length === 1 ? 50 : (i / (points.length - 1)) * 100;

  return (
    <section aria-label="Wake time per day">
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">Wake drift</h3>
        <Caption text={`${shown.label} · up ${formatClock(shown.minute)}`} />
      </div>
      <div className="relative mt-2" style={{ height: DRIFT_H }}>
        {/* The 4:45 line — what drift is measured against. */}
        <span
          aria-hidden
          className="absolute inset-x-0 border-t border-dashed border-line-mid"
          style={{ top: yOf(target) }}
        />
        <span
          aria-hidden
          className="mono-xs absolute right-0 text-ink-4"
          style={{ top: yOf(target) - 14 }}
        >
          4:45a
        </span>
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${DRIFT_H}`}
          preserveAspectRatio="none"
        >
          <motion.polyline
            points={points.map((p, i) => `${xOf(i)},${yOf(p.minute)}`).join(" ")}
            fill="none"
            stroke="var(--line-mid)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: SWEEP }}
          />
        </svg>
        {points.map((p, i) => (
          <button
            key={p.date}
            type="button"
            aria-label={`${p.label}, up at ${formatClock(p.minute)}`}
            onClick={() => setPicked(p.date)}
            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${xOf(i)}%`, top: yOf(p.minute) }}
          >
            <span
              aria-hidden
              className={`rounded-pill ${
                p.date === shown.date
                  ? "h-[7px] w-[7px] bg-ink"
                  : "h-[5px] w-[5px] bg-ink/55"
              }`}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 border-t border-line-soft pt-1 text-right">
        <span className="mono-xs text-ink-4">
          earlier ↑ · last {points.length}
        </span>
      </div>
    </section>
  );
}

/** Shipped or not, day by day — the seismograph grammar, one row. */
function Content({ days }: { days: ReturnType<typeof contentSeries> }) {
  const shipped = days.filter((d) => d.shipped).length;
  return (
    <section aria-label="Content shipped, last two weeks">
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">Content</h3>
        <Caption text={`${shipped} shipped / ${days.length}d`} />
      </div>
      <div
        className="relative mt-2 grid"
        style={{ height: 26, gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 h-px bg-line-soft"
          style={{ top: 18 }}
        />
        {days.map((d) => (
          <span key={d.date} className="relative">
            {d.shipped ? (
              <span
                aria-hidden
                className="absolute left-1/2 w-[3px] -translate-x-1/2 rounded-pill bg-ink"
                style={{ top: 4, height: 14 }}
              />
            ) : (
              <span
                aria-hidden
                className={`absolute left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-pill ${
                  d.isToday ? "bg-ink-3" : "bg-ink-4/60"
                }`}
                style={{ top: 16 }}
              />
            )}
          </span>
        ))}
      </div>
      <div
        className="mt-1 grid"
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
        aria-hidden
      >
        {days.map((d) => (
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
    </section>
  );
}

export function TrendsSheet({
  open,
  onClose,
  today,
  version,
}: {
  open: boolean;
  onClose: () => void;
  today: string;
  version: number;
}) {
  const reduced = useReducedMotion();
  void reduced;
  const data = useMemo(
    () =>
      open
        ? {
            deep: deepWeeks(today),
            wake: stampSeries(today, "wake"),
            content: contentSeries(today),
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, today, version],
  );

  return (
    <Sheet open={open} onClose={onClose} title="Trends" tall>
      {data ? (
        <div className="space-y-7 pb-4">
          <RunTrends today={today} version={version} full />
          <DeepWork weeks={data.deep} />
          <WakeDrift points={data.wake} />
          <Content days={data.content} />
        </div>
      ) : null}
    </Sheet>
  );
}
