"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { getHabits, habitLabel } from "@/lib/habits";
import { buildLogIndex, stateOf } from "@/lib/log-index";
import { SWEEP } from "@/lib/motion";

/**
 * The week as a shape, across all of history.
 *
 * Not a fifth view of completion — a different axis through it. The
 * seismograph is fourteen days per habit with no weekday axis; the month grid
 * is per day with no weekday aggregation; neither can answer "am I soft on
 * Thursdays". And if the week has a soft spot it is structural — a 5am session
 * against a stacked class day — so it repeats fifty-two times a year and is
 * worth knowing.
 *
 * Bars, monochrome, width and height carrying the reading. Nothing tinted.
 *
 * Two rules the denominator has to follow or this lies. It goes through the
 * same three-state grammar as everything else, so an unscheduled day and a day
 * marked no-data are absent rather than missed — the shipped registry is five
 * habits on weekdays, four on Saturday and three on Sunday, so a naive count
 * would draw three fake Sunday misses every week. And a weekday with fewer
 * than four instances says so instead of drawing a number nobody should read.
 */

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const H = 40;
/** Below this many instances a rate is noise, and it says so. */
const MIN_N = 4;

interface Col {
  done: number;
  scheduled: number;
  days: number;
  rate: number | null;
  /** The habit dragging this weekday down, when there is a clear one. */
  worst: { id: string; done: number; scheduled: number } | null;
}

export function WeekdayProfile({
  today,
  version,
}: {
  today: string;
  version: number;
}) {
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(null);

  const cols = useMemo<Col[]>(() => {
    const ix = buildLogIndex();
    const habits = getHabits();
    const blank: Col[] = Array.from({ length: 7 }, () => ({
      done: 0,
      scheduled: 0,
      days: 0,
      rate: null,
      worst: null,
    }));
    if (!ix.first) return blank;

    const end = subDays(parseISO(today), 1);
    const start = parseISO(ix.first);
    if (end < start) return blank;

    const perHabit: Map<string, { done: number; scheduled: number }>[] =
      Array.from({ length: 7 }, () => new Map());

    for (const d of eachDayOfInterval({ start, end })) {
      const date = format(d, "yyyy-MM-dd");
      // Monday-first, matching every other week reading in the app.
      const c = (d.getDay() + 6) % 7;
      let counted = false;
      for (const h of habits) {
        const s = stateOf(ix, h, date, today);
        if (s === "none") continue;
        counted = true;
        blank[c].scheduled += 1;
        if (s === "done") blank[c].done += 1;
        const m = perHabit[c].get(h.id) ?? { done: 0, scheduled: 0 };
        m.scheduled += 1;
        if (s === "done") m.done += 1;
        perHabit[c].set(h.id, m);
      }
      if (counted) blank[c].days += 1;
    }

    return blank.map((col, c) => {
      let worst: Col["worst"] = null;
      for (const [id, m] of perHabit[c]) {
        if (m.scheduled < MIN_N) continue;
        const r = m.done / m.scheduled;
        if (worst == null || r < worst.done / worst.scheduled) {
          worst = { id, done: m.done, scheduled: m.scheduled };
        }
      }
      return {
        ...col,
        rate: col.scheduled === 0 ? null : col.done / col.scheduled,
        worst,
      };
    });
  }, [today, version]);

  // The headline. Fixed height whatever it says, because this page cannot
  // scroll and a line that changes height would jolt everything under it.
  const ready = cols.filter((c) => c.days >= MIN_N && c.rate != null);
  const softest = ready.reduce<{ i: number; rate: number } | null>(
    (acc, c) => {
      const i = cols.indexOf(c);
      return acc == null || (c.rate as number) < acc.rate
        ? { i, rate: c.rate as number }
        : acc;
    },
    null,
  );

  let headline: string;
  if (picked != null) {
    const c = cols[picked];
    if (c.days < MIN_N) {
      headline = `not enough ${FULL[picked]}s yet`;
    } else if (c.worst) {
      headline = `${FULL[picked]} · ${habitLabel(c.worst.id)} ${c.worst.done}/${c.worst.scheduled}`;
    } else {
      headline = `${FULL[picked]} · ${Math.round((c.rate ?? 0) * 100)}%`;
    }
  } else if (softest && ready.length >= 3) {
    headline = `${FULL[softest.i]}s are your softest — ${Math.round(softest.rate * 100)}%`;
  } else {
    headline = "a few more weeks and this reads";
  }

  return (
    <section aria-label="Completion by weekday">
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">By weekday</h3>
        <p className="mono-xs text-ink-4">all time</p>
      </div>

      <div className="mt-2.5 flex items-end gap-1.5" style={{ height: H }}>
        {cols.map((c, i) => {
          const h = c.rate == null ? 0 : Math.max(3, c.rate * H);
          const on = picked === i;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${FULL[i]}, ${c.done} of ${c.scheduled} done`}
              aria-pressed={on}
              onClick={() => setPicked(on ? null : i)}
              className="relative flex flex-1 items-end"
              style={{ height: H }}
            >
              {c.rate == null ? (
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
                    duration: 0.5,
                    delay: Math.min(0.2, i * 0.03),
                    ease: SWEEP,
                  }}
                  className={`w-full rounded-xs ${on ? "bg-ink" : "bg-ink/45"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {DOW.map((d, i) => (
          <span
            key={i}
            aria-hidden
            className={`mono-xs flex-1 text-center ${
              picked === i ? "text-ink-2" : "text-ink-4"
            }`}
          >
            {d}
          </span>
        ))}
      </div>

      {/* One line, always one line. */}
      <p className="mono-xs mt-2 h-4 truncate text-ink-3">{headline}</p>
    </section>
  );
}
