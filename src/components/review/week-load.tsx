"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { format, parseISO, subDays } from "date-fns";
import { blocksForDate, toMinutes } from "@/lib/schedule";
import { getHabits } from "@/lib/habits";
import { buildLogIndex } from "@/lib/log-index";
import { SWEEP } from "@/lib/motion";

/**
 * The week as training load, not as completion.
 *
 * Everything else in this app counts events: the week strip, the seismograph,
 * the month grid and the year trace all draw whether a thing was done. That
 * makes a fifteen-minute shakeout and a two-hour long run the same mark. For a
 * build week the quantity that actually matters is minutes, and nothing has
 * ever drawn them.
 *
 * Seven bars, one per day, height proportional to the minutes the template
 * *planned*. A session that was thrown is inked solid; one that was not is left
 * as an outline, so the shortfall is the unfilled part of a bar you can see. A
 * rest day is a dot on the baseline rather than an empty column, because rest
 * is a thing the plan asked for and not a hole in it.
 *
 * The headline is deliberately "planned minutes completed" and not "minutes
 * trained": cutting the long run to forty still counts a hundred and twenty
 * here, and the app does not get to pretend it knows otherwise.
 */

const H = 44;

interface Bar {
  date: string;
  dow: string;
  label: string | null;
  planned: number;
  done: boolean;
  isToday: boolean;
}

export function WeekLoad({
  today,
  version,
}: {
  today: string;
  /** Bumped after any write, so the bars recount. */
  version: number;
}) {
  const reduced = useReducedMotion();

  const { bars, done, planned } = useMemo(() => {
    const ix = buildLogIndex();
    // Whichever habit owns training, however the registry has been edited.
    const training = getHabits().find((h) => h.anchor?.kind === "training");
    const end = parseISO(today);
    const out: Bar[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(end, i);
      const date = format(d, "yyyy-MM-dd");
      const block = blocksForDate(date).find((b) => b.kind === "training");
      const thrown =
        training != null &&
        ix.byDate.get(date)?.habits?.[training.id] === true;
      out.push({
        date,
        dow: format(d, "EEEEE"),
        label: block?.label ?? null,
        planned: block ? toMinutes(block.end) - toMinutes(block.start) : 0,
        done: thrown,
        isToday: date === today,
      });
    }
    return {
      bars: out,
      done: out.reduce((n, b) => n + (b.done ? b.planned : 0), 0),
      planned: out.reduce((n, b) => n + b.planned, 0),
    };
  }, [today, version]);

  const peak = Math.max(1, ...bars.map((b) => b.planned));

  return (
    <section aria-label="Training load this week">
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">Load</h3>
        <p className="mono-xs tabular-nums text-ink-3">
          <span className="text-ink-2">{done}</span>/{planned} min
        </p>
      </div>

      <div className="mt-2 flex items-end gap-1.5" style={{ height: H }}>
        {bars.map((b, i) => {
          const h = b.planned === 0 ? 0 : Math.max(6, (b.planned / peak) * H);
          return (
            <div
              key={b.date}
              className="relative flex flex-1 items-end"
              style={{ height: H }}
              title={
                b.label
                  ? `${b.label} · ${b.planned}m${b.done ? " · done" : ""}`
                  : "rest"
              }
            >
              {b.planned === 0 ? (
                // Rest. A dot on the baseline, never an empty column — the plan
                // asked for this day off and the drawing should say so.
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
                  className={`w-full rounded-xs ${
                    b.done
                      ? "bg-ink"
                      : b.isToday
                        ? "border border-ink-3 bg-transparent"
                        : "border border-line-mid bg-transparent"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {bars.map((b) => (
          <span
            key={b.date}
            aria-hidden
            className={`mono-xs flex-1 text-center ${
              b.isToday ? "text-ink-2" : "text-ink-4"
            }`}
          >
            {b.dow}
          </span>
        ))}
      </div>
    </section>
  );
}
