"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { haptic } from "@/lib/haptics";
import { SWEEP, TICK } from "@/lib/motion";
import {
  GYM_CHANGED,
  activeSessionId,
  formatLbs,
  getAllSessions,
  getSession,
  planForDate,
  recentPRs,
  recoverySignal,
  sessionSetCount,
  sessionTonnage,
  startSession,
  weeklyTonnage,
  type WeekTonnage,
} from "@/lib/gym";
import { SessionSheet } from "./session-sheet";
import { LiftsSheet } from "./lifts-sheet";

/**
 * The gym, as a surface.
 *
 * One swipe right of the record, and the same contract as every other page:
 * it cannot scroll, so it carries only what is read at a glance — what today's
 * session is, the one button that starts it, how heavy the weeks have been,
 * and whether recovery is being outrun. The actual logging happens in a sheet,
 * because a workout is a detour you take *over* the app, not a place you
 * navigate to; and the full history lives behind one tap for the same reason
 * the record keeps its trends behind one.
 */

function TonnageBars({
  weeks,
  reduced,
}: {
  weeks: WeekTonnage[];
  reduced: boolean | null;
}) {
  const COL_H = 46;
  const [picked, setPicked] = useState<string | null>(null);
  const peak = Math.max(1, ...weeks.map((w) => w.lbs));
  const shown = weeks.find((w) => w.start === picked) ?? weeks[weeks.length - 1];

  return (
    <section aria-label="Weekly tonnage, last eight weeks">
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">Tonnage</h3>
        <motion.span
          key={shown.start + shown.lbs}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          className="mono-xs tabular-nums text-ink-3"
        >
          wk {shown.label} · {formatLbs(shown.lbs)} lb
        </motion.span>
      </div>

      <div className="mt-2 flex items-end gap-1.5" style={{ height: COL_H }}>
        {weeks.map((w, i) => {
          const h = w.lbs === 0 ? 0 : Math.max(5, (w.lbs / peak) * COL_H);
          return (
            <button
              key={w.start}
              type="button"
              aria-label={`week of ${w.label}, ${formatLbs(w.lbs)} pounds`}
              onClick={() => setPicked(w.start)}
              className="relative flex flex-1 flex-col items-stretch justify-end"
              style={{ height: COL_H }}
            >
              {w.lbs === 0 ? (
                // A rest week is a fact, not a gap — same baseline dot as the
                // mileage and load charts, so the app keeps one chart language.
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

export function GymScreen({
  today,
  version,
  onTrained,
}: {
  today: string;
  /** Bumped by the host after any write elsewhere in the app. */
  version: number;
  /** Fired once when a session is saved — marks the T habit and the note. */
  onTrained: (summary: string) => void;
}) {
  const reduced = useReducedMotion();
  /** Local bump: the logger writes through on every set. */
  const [gymVersion, setGymVersion] = useState(0);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const bump = () => setGymVersion((v) => v + 1);
    window.addEventListener(GYM_CHANGED, bump);
    return () => window.removeEventListener(GYM_CHANGED, bump);
  }, []);

  const plan = useMemo(() => planForDate(today), [today]);
  const activeId = useMemo(
    () => activeSessionId(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gymVersion, version, today],
  );
  const active = activeId ? getSession(activeId) : null;

  const { weeks, signal, prs, lastDone } = useMemo(() => {
    const all = getAllSessions().filter((s) => s.endedAt != null);
    return {
      weeks: weeklyTonnage(today),
      signal: recoverySignal(today),
      prs: recentPRs(3),
      lastDone: all[all.length - 1] ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, gymVersion, version]);

  const start = () => {
    haptic(10);
    const s = active ?? startSession(today, plan);
    setLoggingId(s.id);
  };

  const doneToday = !active && lastDone?.date === today;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      {/* Today's session — the card the whole surface exists for. */}
      <section className="shrink-0 rounded-md border border-line-mid p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="kicker">{plan ? "today" : "no lift today"}</h3>
          {lastDone ? (
            <span className="mono-xs tabular-nums text-ink-4">
              last · {formatLbs(sessionTonnage(lastDone))} lb
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[17px] font-light tracking-[-0.01em] text-ink">
          {plan?.label ?? (today && new Date(`${today}T12:00:00`).getDay() === 6
            ? "long run day"
            : "recovery day")}
        </p>
        <p className="mono-xs mt-1 text-ink-3">
          {plan?.focus ?? "the gym is still open — a freestyle session logs the same"}
        </p>
        {plan ? (
          <p className="mono-xs mt-2 truncate text-ink-4">
            {plan.exercises.map((e) => e.name).join(" · ")}
          </p>
        ) : null}
        <motion.button
          type="button"
          onClick={start}
          whileTap={{ scale: 0.97 }}
          transition={TICK}
          className={`mono-xs mt-4 flex min-h-12 w-full items-center justify-center rounded-sm border transition-colors ${
            active
              ? "border-accent bg-ink/[0.10] text-ink"
              : doneToday
                ? "border-line-mid text-ink-3 hover:border-accent hover:text-ink"
                : "border-accent bg-ink text-accent-fg"
          }`}
        >
          {active
            ? `resume — ${sessionSetCount(active)} sets in`
            : doneToday
              ? "logged today · lift again"
              : plan
                ? "start session"
                : "start a freestyle session"}
        </motion.button>
      </section>

      <TonnageBars weeks={weeks} reduced={reduced} />

      {/* The recovery dial — he asked to be smoked *and* watched. */}
      {signal.line ? (
        <p
          className={`mono-xs shrink-0 ${signal.warn ? "text-warn" : "text-ink-3"}`}
        >
          {signal.warn ? "watch · " : ""}
          {signal.line}
        </p>
      ) : null}

      {/* The trophy shelf. Sacrificed first on a short viewport. */}
      {prs.length > 0 ? (
        <section className="drop-when-short">
          <h3 className="kicker">Recent PRs</h3>
          <div className="mt-2 space-y-1.5">
            {prs.map((p) => (
              <p
                key={`${p.date}·${p.exercise}·${p.weight}×${p.reps}`}
                className="mono-xs flex items-baseline gap-2 text-ink-3"
              >
                <span className="truncate text-ink-2">{p.exercise}</span>
                <span className="ml-auto shrink-0 tabular-nums">
                  {p.weight > 0 ? `${p.weight}×${p.reps}` : `×${p.reps}`}
                  {p.e1 > 0 ? ` · est ${p.e1}` : ""}
                </span>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => {
          haptic(8);
          setHistoryOpen(true);
        }}
        className="mono-xs mt-auto min-h-11 shrink-0 text-center text-ink-3 hover:text-ink"
      >
        history &amp; records →
      </button>

      <SessionSheet
        sessionId={loggingId}
        onClose={() => setLoggingId(null)}
        onFinished={(summary) => {
          setLoggingId(null);
          onTrained(summary);
        }}
      />
      <LiftsSheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        today={today}
        version={gymVersion + version}
      />
    </div>
  );
}
