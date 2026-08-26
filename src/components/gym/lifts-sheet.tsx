"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { format, parseISO } from "date-fns";
import { Sheet } from "@/components/ui/sheet";
import { haptic, HAPTIC_RELEASE } from "@/lib/haptics";
import { SWEEP } from "@/lib/motion";
import {
  deleteSession,
  exerciseSummaries,
  exerciseTrend,
  formatElapsed,
  formatLbs,
  getAllSessions,
  sessionSetCount,
  sessionTonnage,
  type GymSession,
} from "@/lib/gym";

/**
 * History and records — the half of Bevel that happens on the couch.
 *
 * A scrolling sheet, so it can afford what the surface cannot: every logged
 * session, and every exercise with its all-time best. Picking an exercise
 * draws its strength trend in the same dots-on-a-line grammar as the pace
 * chart — best estimated 1RM per session, higher is stronger — because the
 * app keeps one chart language and this is a trend question.
 */

const TREND_H = 56;

function E1Trend({ name, version }: { name: string; version: number }) {
  const reduced = useReducedMotion();
  // Version is the invalidation: deleting a session from the list below must
  // redraw the chart, or it keeps plotting the deleted points.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const points = useMemo(() => exerciseTrend(name), [name, version]);
  const [picked, setPicked] = useState<string | null>(null);
  if (points.length === 0) return null;
  const shown = points.find((p) => p.date === picked) ?? points[points.length - 1];

  const lo = Math.min(...points.map((p) => p.e1));
  const hi = Math.max(...points.map((p) => p.e1));
  const span = hi - lo;
  const yOf = (v: number) =>
    span === 0 ? TREND_H / 2 : 6 + ((hi - v) / span) * (TREND_H - 12);
  const xOf = (i: number) =>
    points.length === 1 ? 50 : (i / (points.length - 1)) * 100;

  return (
    <section aria-label={`Estimated 1RM trend for ${name}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">{name}</h3>
        <motion.span
          key={shown.date}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          className="mono-xs tabular-nums text-ink-3"
        >
          {shown.label} · {shown.weight > 0 ? `${shown.weight}×${shown.reps}` : `×${shown.reps}`} · est {shown.e1}
        </motion.span>
      </div>

      <div className="relative mt-2" style={{ height: TREND_H }}>
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${TREND_H}`}
          preserveAspectRatio="none"
        >
          <motion.polyline
            points={points.map((p, i) => `${xOf(i)},${yOf(p.e1)}`).join(" ")}
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
            aria-label={`${p.label}, estimated one rep max ${p.e1}`}
            onClick={() => setPicked(p.date)}
            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${xOf(i)}%`, top: yOf(p.e1) }}
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
          stronger ↑ · est 1RM · last {points.length}
        </span>
      </div>
    </section>
  );
}

function SessionRow({
  s,
  open,
  onToggle,
  onDeleted,
}: {
  s: GymSession;
  open: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}) {
  const [arm, setArm] = useState(false);
  const prs = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.pr).length, 0);

  return (
    <div className="py-3">
      <button type="button" onClick={onToggle} className="block w-full text-left">
        <div className="flex items-baseline gap-2">
          <span className="mono-xs w-[74px] shrink-0 tabular-nums text-ink-3">
            {format(parseISO(s.date), "EEE M/d")}
          </span>
          <span className="truncate text-[15px] text-ink-2">{s.label}</span>
          <span className="mono-xs ml-auto shrink-0 tabular-nums text-ink-3">
            {formatLbs(sessionTonnage(s))} lb
          </span>
        </div>
        <p className="mono-xs mt-1 tabular-nums text-ink-4">
          {sessionSetCount(s)} sets
          {s.endedAt ? ` · ${formatElapsed(s.startedAt, s.endedAt)}` : ""}
          {s.rpe != null ? ` · RPE ${s.rpe}` : ""}
          {prs > 0 ? ` · ${prs} PR` : ""}
          {s.note ? ` · ${s.note}` : ""}
        </p>
      </button>

      {open ? (
        <div className="mt-2 space-y-2 border-l border-line-soft pl-3">
          {s.exercises
            .filter((e) => e.sets.length > 0)
            .map((e) => (
              <p key={e.name} className="mono-xs tabular-nums text-ink-3">
                <span className="text-ink-2">{e.name}</span>{" "}
                {e.sets
                  .map(
                    (x) =>
                      (x.weight > 0 ? `${x.weight}×${x.reps}` : `×${x.reps}`) +
                      (x.pr ? "▲" : ""),
                  )
                  .join(" · ")}
                {e.userNote ? (
                  <span className="text-ink-4"> — {e.userNote}</span>
                ) : null}
              </p>
            ))}
          <button
            type="button"
            onClick={() => {
              if (!arm) {
                setArm(true);
                haptic(6);
                window.setTimeout(() => setArm(false), 2600);
                return;
              }
              deleteSession(s.id);
              haptic(HAPTIC_RELEASE);
              onDeleted();
            }}
            className={`mono-xs -ml-2 min-h-11 px-2 ${arm ? "text-bad" : "text-ink-4"}`}
          >
            {arm ? "tap again to delete this session" : "delete"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function LiftsSheet({
  open,
  onClose,
  today,
  version,
}: {
  open: boolean;
  onClose: () => void;
  today: string;
  /** Bumped after any gym write so the sheet recounts. */
  version: number;
}) {
  const [pickedExercise, setPickedExercise] = useState<string | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(null);

  const { sessions, records } = useMemo(() => {
    const all = getAllSessions()
      .filter((s) => s.endedAt != null && s.date <= today)
      .reverse();
    return { sessions: all.slice(0, 20), records: exerciseSummaries() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, version, open]);

  const shownExercise =
    pickedExercise ?? (records.length > 0 ? records[0].name : null);

  return (
    <Sheet open={open} onClose={onClose} title="History & records" tall>
      {records.length === 0 && sessions.length === 0 ? (
        <p className="mono-xs text-center text-ink-4">
          nothing logged yet — start a session and the record starts itself
        </p>
      ) : (
        <div className="space-y-7">
          {shownExercise ? (
            <E1Trend name={shownExercise} version={version} />
          ) : null}

          {records.length > 0 ? (
            <section>
              <h3 className="kicker">Records</h3>
              <div className="mt-2 divide-y divide-line-soft/60">
                {records.map((r) => (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => {
                      haptic(6);
                      setPickedExercise(r.name);
                    }}
                    aria-pressed={r.name === shownExercise}
                    className="flex min-h-11 w-full items-baseline gap-2 py-2 text-left"
                  >
                    <span
                      className={`truncate text-[15px] ${
                        r.name === shownExercise ? "text-ink" : "text-ink-2"
                      }`}
                    >
                      {r.name}
                    </span>
                    <span className="mono-xs ml-auto shrink-0 tabular-nums text-ink-3">
                      {r.bestWeight > 0
                        ? `${r.bestWeight}×${r.bestReps} · est ${r.bestE1}`
                        : `×${r.bestReps}`}
                    </span>
                    <span className="mono-xs w-[58px] shrink-0 text-right tabular-nums text-ink-4">
                      ×{r.timesDone}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {sessions.length > 0 ? (
            <section>
              <h3 className="kicker">Sessions</h3>
              <div className="mt-1 divide-y divide-line-soft/60">
                {sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    s={s}
                    open={openSession === s.id}
                    onToggle={() =>
                      setOpenSession(openSession === s.id ? null : s.id)
                    }
                    onDeleted={() => setOpenSession(null)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
