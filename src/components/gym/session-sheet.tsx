"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { haptic, HAPTIC_COMMIT, HAPTIC_RELEASE } from "@/lib/haptics";
import { TICK } from "@/lib/motion";
import { formatClock } from "@/lib/clock";
import {
  addCustomExercise,
  bestBefore,
  deleteSession,
  epley,
  formatLbs,
  getSession,
  knownExercises,
  lastSets,
  saveSession,
  sessionSetCount,
  sessionTonnage,
  setActiveSession,
  type GymSession,
  type GymSet,
} from "@/lib/gym";

/**
 * The logger — the thing that has to beat Bevel at the rack.
 *
 * A sheet rather than a surface, because the surfaces cannot scroll and a
 * session is six exercises deep; and because a workout is taken *over* the
 * app, not navigated to. Everything here is tuned for two thumbs between
 * sets: every field arrives prefilled with last time's numbers (a normal day
 * is confirm-taps, not typing), the rest timer runs off wall-clock stamps so
 * locking the phone cannot stop it, and every commit writes straight through
 * to localStorage so force-quitting mid-workout loses nothing — reopening
 * the app resumes the session exactly where it stood.
 */

/** 16px minimum — anything smaller makes iOS zoom the viewport on focus. */
const NUM_CLS =
  "w-full rounded-sm border border-line-soft bg-surface-2 px-2 py-2.5 text-center font-mono text-[16px] tabular-nums text-ink placeholder:text-ink-4 outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus:border-line-mid";

/** RPE cycles rather than picks — one thumb, five states, no popover. */
const RPE_CYCLE: (number | undefined)[] = [undefined, 7, 8, 9, 10];

function nextRpe(cur: number | undefined): number | undefined {
  const i = RPE_CYCLE.findIndex((v) => v === cur);
  return RPE_CYCLE[(i + 1) % RPE_CYCLE.length];
}

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Minute-of-day stamp for a committed set: 402 → "6:42a". */
function stampOf(at?: number): string | null {
  if (!at) return null;
  const d = new Date(at);
  return formatClock(d.getHours() * 60 + d.getMinutes());
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** One key per visible row, so pending edits survive other rows committing. */
type Pend = Record<string, { w?: string; r?: string; rpe?: number }>;

export function SessionSheet({
  sessionId,
  onClose,
  onFinished,
}: {
  sessionId: string | null;
  onClose: () => void;
  /** Fired once, after a save — carries the one-line summary for the note. */
  onFinished: (summary: string) => void;
}) {
  const [session, setSession] = useState<GymSession | null>(null);
  const [pend, setPend] = useState<Pend>({});
  /** Rows offered beyond the plan's prescription, per exercise index. */
  const [extra, setExtra] = useState<Record<number, number>>({});
  const [mode, setMode] = useState<"log" | "review">("log");
  const [reviewRpe, setReviewRpe] = useState<number | undefined>(undefined);
  const [reviewNote, setReviewNote] = useState("");
  const [armDiscard, setArmDiscard] = useState(false);
  const [adding, setAdding] = useState("");
  /** Ticks once a second for the two timers; state so the sheet re-renders. */
  const [nowMs, setNowMs] = useState(() => Date.now());
  const armTimer = useRef<number | null>(null);

  // Load fresh state every time the sheet opens on a session.
  useEffect(() => {
    if (!sessionId) return;
    setSession(getSession(sessionId));
    setPend({});
    setExtra({});
    setMode("log");
    setReviewRpe(undefined);
    setReviewNote("");
    setArmDiscard(false);
    setAdding("");
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sessionId]);

  useEffect(
    () => () => {
      if (armTimer.current) window.clearTimeout(armTimer.current);
    },
    [],
  );

  /*
    The judging bar per exercise, fixed at session start. Computed against
    history *before* this session so a second PR in one morning still reads
    as a PR — and memoised on the session id, because it scans every stored
    session and has no business running on each keystroke.
  */
  const bests = useMemo(() => {
    if (!session) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const e of session.exercises) {
      m.set(e.name.toLowerCase(), bestBefore(e.name, session.startedAt)?.e1 ?? 0);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.exercises.length]);

  /** Last time's sets per exercise — the ghost the fields prefill from. */
  const ghosts = useMemo(() => {
    if (!session) return new Map<string, GymSet[]>();
    const m = new Map<string, GymSet[]>();
    for (const e of session.exercises) {
      const g = lastSets(e.name, session.startedAt);
      if (g) m.set(e.name.toLowerCase(), g);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.exercises.length]);

  const suggestions = useMemo(() => {
    if (!session) return [];
    const have = new Set(session.exercises.map((e) => e.name.toLowerCase()));
    return knownExercises().filter((n) => !have.has(n.toLowerCase())).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.exercises.length]);

  if (!sessionId) return null;

  const write = (next: GymSession) => {
    saveSession(next);
    setSession(next);
  };

  /** The most recent commit anywhere in the session — the rest timer's zero. */
  const lastAt = session
    ? Math.max(0, ...session.exercises.flatMap((e) => e.sets.map((s) => s.at ?? 0)))
    : 0;

  const commit = (ei: number, row: number) => {
    if (!session) return;
    const ex = session.exercises[ei];
    const key = `${ei}:${row}`;
    const p = pend[key];
    const ghost = ghosts.get(ex.name.toLowerCase());
    const fallback = ghost?.[row] ?? ex.sets[ex.sets.length - 1] ?? ghost?.[ghost.length - 1];
    const weight = p?.w != null ? parseNum(p.w) : (fallback?.weight ?? null);
    const reps = p?.r != null ? parseNum(p.r) : (fallback?.reps ?? null);
    if (reps == null || reps <= 0 || weight == null) {
      haptic(6);
      return;
    }

    const e1 = epley(weight, reps);
    const bar = bests.get(ex.name.toLowerCase()) ?? 0;
    const sessionBest = Math.max(0, ...ex.sets.map((s) => epley(s.weight, s.reps)));
    // A PR needs history to beat: the first-ever exposure sets the bar, it
    // does not clear it.
    const pr = bar > 0 && e1 > bar && e1 > sessionBest;

    const set: GymSet = { weight, reps, at: Date.now() };
    if (p?.rpe != null) set.rpe = p.rpe;
    if (pr) set.pr = true;

    const exercises = session.exercises.map((e, i) =>
      i === ei ? { ...e, sets: [...e.sets, set] } : e,
    );
    write({ ...session, exercises });
    setPend((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
    haptic(pr ? HAPTIC_COMMIT : 10);
  };

  /** Tap a stamped row: the set comes back out, its numbers ready to re-edit. */
  const uncommit = (ei: number, j: number) => {
    if (!session) return;
    const ex = session.exercises[ei];
    const removed = ex.sets[j];
    if (!removed) return;
    /*
      The values are seeded into the row that will actually render as the
      first *input* row after the removal — pre-removal length − 1 — not into
      row `j`. Removing a middle set shifts every later committed set down,
      so row `j` is still a committed row and a pend entry keyed there would
      render nowhere: the set's numbers would silently vanish at the rack.
      For the last set the two indices coincide, so peeling back the set you
      just logged behaves exactly as before; pulling an earlier one cascades
      each removed set into the next visible entry row instead.
    */
    const firstInput = ex.sets.length - 1;
    const exercises = session.exercises.map((e, i) =>
      i === ei ? { ...e, sets: e.sets.filter((_, k) => k !== j) } : e,
    );
    write({ ...session, exercises });
    setPend((prev) => ({
      ...prev,
      [`${ei}:${firstInput}`]: {
        w: String(removed.weight),
        r: String(removed.reps),
        rpe: removed.rpe,
      },
    }));
    haptic(HAPTIC_RELEASE);
  };

  const addExercise = (name: string) => {
    if (!session) return;
    const t = name.trim();
    if (!t) return;
    if (session.exercises.some((e) => e.name.toLowerCase() === t.toLowerCase())) {
      setAdding("");
      return;
    }
    addCustomExercise(t);
    write({ ...session, exercises: [...session.exercises, { name: t, sets: [] }] });
    setAdding("");
    haptic(8);
  };

  const saveAndClose = () => {
    if (!session) return;
    const done: GymSession = {
      ...session,
      endedAt: Date.now(),
      rpe: reviewRpe,
      note: reviewNote.trim() || undefined,
    };
    saveSession(done);
    setActiveSession(null);
    haptic(HAPTIC_COMMIT);
    const sets = sessionSetCount(done);
    const tons = sessionTonnage(done);
    const prCount = done.exercises.reduce(
      (a, e) => a + e.sets.filter((s) => s.pr).length,
      0,
    );
    onFinished(
      `${done.label} — ${sets} sets · ${formatLbs(tons)} lb` +
        (prCount > 0 ? ` · ${prCount} PR` : "") +
        (reviewRpe != null ? ` · RPE ${reviewRpe}` : ""),
    );
  };

  const discard = () => {
    if (!session) return;
    if (!armDiscard) {
      setArmDiscard(true);
      haptic(6);
      if (armTimer.current) window.clearTimeout(armTimer.current);
      armTimer.current = window.setTimeout(() => setArmDiscard(false), 2600);
      return;
    }
    deleteSession(session.id);
    haptic(HAPTIC_RELEASE);
    onClose();
  };

  const totalSets = session ? sessionSetCount(session) : 0;

  return (
    <Sheet
      open={session != null}
      onClose={onClose}
      title={session?.label ?? "Session"}
      tall
    >
      {session ? (
        <div>
          {/* The two clocks. Sticky, because they are why the phone is out. */}
          <div className="sticky top-0 z-10 -mx-5 flex items-baseline justify-between border-b border-line-soft bg-surface px-5 pb-2">
            <span className="mono-xs tabular-nums text-ink-3">
              {mmss(nowMs - session.startedAt)} in · {totalSets} sets ·{" "}
              {formatLbs(sessionTonnage(session))} lb
            </span>
            <span className="mono-xs tabular-nums text-ink-2">
              {lastAt > 0 ? `rest ${mmss(nowMs - lastAt)}` : "first set"}
            </span>
          </div>

          {mode === "log" ? (
            <div className="mt-4 space-y-6 pb-2">
              {session.exercises.map((ex, ei) => {
                const ghost = ghosts.get(ex.name.toLowerCase());
                // A row holding an in-flight edit must stay mounted even when
                // an uncommit shrinks the count — losing an input mid-typing
                // is the one thing a logger can never do.
                const pendRows = Object.keys(pend).reduce((a, k) => {
                  const [pi, pj] = k.split(":");
                  return Number(pi) === ei ? Math.max(a, Number(pj) + 1) : a;
                }, 0);
                const rows = Math.max(
                  ex.sets.length + 1,
                  pendRows,
                  (ex.target?.sets ?? Math.max(ex.sets.length, ghost?.length ?? 0)) +
                    (extra[ei] ?? 0),
                );
                return (
                  <section key={ex.name}>
                    <div className="flex items-baseline gap-2">
                      <h3 className="truncate text-[15px] text-ink">{ex.name}</h3>
                      <span className="mono-xs ml-auto shrink-0 text-ink-4">
                        {ex.target ? `${ex.target.sets}×${ex.target.reps}` : ""}
                      </span>
                    </div>
                    {ex.note ? (
                      <p className="mono-xs mt-0.5 text-ink-4">{ex.note}</p>
                    ) : null}
                    {ghost ? (
                      <p className="mono-xs mt-0.5 tabular-nums text-ink-4">
                        last ·{" "}
                        {ghost
                          .map((g) => (g.weight > 0 ? `${g.weight}×${g.reps}` : `×${g.reps}`))
                          .join(" · ")}
                      </p>
                    ) : null}

                    <div className="mt-2 space-y-1.5">
                      {Array.from({ length: rows }, (_, j) => {
                        const committed = ex.sets[j];
                        if (committed) {
                          const e1 = Math.round(epley(committed.weight, committed.reps));
                          return (
                            <button
                              key={j}
                              type="button"
                              onClick={() => uncommit(ei, j)}
                              aria-label={`Set ${j + 1}, ${committed.weight} by ${committed.reps} — tap to edit`}
                              className="flex min-h-11 w-full items-center gap-2 rounded-sm border border-line-soft bg-ink/[0.04] px-3 text-left"
                            >
                              <span className="mono-xs w-5 shrink-0 text-ink-4">
                                {j + 1}
                              </span>
                              <span className="font-mono text-[15px] tabular-nums text-ink">
                                {committed.weight > 0
                                  ? `${committed.weight} × ${committed.reps}`
                                  : `× ${committed.reps}`}
                              </span>
                              {committed.rpe != null ? (
                                <span className="mono-xs text-ink-3">
                                  @{committed.rpe}
                                </span>
                              ) : null}
                              {committed.pr ? (
                                <motion.span
                                  initial={{ scale: 0.6, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={TICK}
                                  className="mono-xs rounded-pill border border-accent px-1.5 text-ink"
                                >
                                  PR{e1 > 0 ? ` · est ${e1}` : ""}
                                </motion.span>
                              ) : null}
                              <span className="mono-xs ml-auto shrink-0 tabular-nums text-ink-4">
                                {stampOf(committed.at) ?? ""}
                              </span>
                            </button>
                          );
                        }

                        const key = `${ei}:${j}`;
                        const p = pend[key];
                        const fb =
                          ghost?.[j] ??
                          ex.sets[ex.sets.length - 1] ??
                          ghost?.[ghost.length - 1];
                        const wVal = p?.w ?? (fb ? String(fb.weight) : "");
                        const rVal = p?.r ?? (fb ? String(fb.reps) : "");
                        const isNext = j === ex.sets.length;
                        return (
                          <div key={j} className="flex items-center gap-2">
                            <span className="mono-xs w-5 shrink-0 text-ink-4">
                              {j + 1}
                            </span>
                            <label className="w-[86px]">
                              <span className="sr-only">
                                Set {j + 1} weight in pounds
                              </span>
                              <input
                                inputMode="decimal"
                                enterKeyHint="next"
                                placeholder="lb"
                                value={wVal}
                                onChange={(e) =>
                                  setPend((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], w: e.target.value },
                                  }))
                                }
                                className={NUM_CLS}
                              />
                            </label>
                            <span className="mono-xs shrink-0 text-ink-4">×</span>
                            <label className="w-[64px]">
                              <span className="sr-only">Set {j + 1} reps</span>
                              <input
                                inputMode="numeric"
                                enterKeyHint="done"
                                placeholder="reps"
                                value={rVal}
                                onChange={(e) =>
                                  setPend((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], r: e.target.value },
                                  }))
                                }
                                className={NUM_CLS}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setPend((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    rpe: nextRpe(prev[key]?.rpe),
                                  },
                                }))
                              }
                              aria-label={`Set ${j + 1} RPE, currently ${p?.rpe ?? "unset"}`}
                              className={`mono-xs min-h-11 w-[46px] shrink-0 rounded-pill border tabular-nums ${
                                p?.rpe != null
                                  ? "border-line-mid text-ink-2"
                                  : "border-line-soft text-ink-4"
                              }`}
                            >
                              {p?.rpe != null ? `@${p.rpe}` : "rpe"}
                            </button>
                            <motion.button
                              type="button"
                              onClick={() => commit(ei, j)}
                              whileTap={{ scale: 0.92 }}
                              transition={TICK}
                              aria-label={`Commit set ${j + 1}`}
                              className={`ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border ${
                                isNext
                                  ? "border-accent text-ink"
                                  : "border-line-soft text-ink-4"
                              }`}
                            >
                              <Check className="h-4 w-4" />
                            </motion.button>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        haptic(6);
                        setExtra((prev) => ({ ...prev, [ei]: (prev[ei] ?? 0) + 1 }));
                      }}
                      className="mono-xs -ml-2 mt-1.5 flex min-h-11 items-center gap-1 px-2 text-ink-3 hover:text-ink"
                    >
                      <Plus className="h-3 w-3" /> set
                    </button>
                  </section>
                );
              })}

              {/* The vocabulary beyond today's plan. */}
              <section>
                <h3 className="kicker">Add exercise</h3>
                {suggestions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestions.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => addExercise(n)}
                        className="mono-xs min-h-11 rounded-pill border border-line-mid px-3 text-ink-2 hover:border-accent hover:text-ink"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={adding}
                    onChange={(e) => setAdding(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addExercise(adding);
                    }}
                    placeholder="or name one"
                    enterKeyHint="done"
                    className="w-full rounded-sm border border-line-soft bg-surface-2 px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-4 outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  />
                  <button
                    type="button"
                    onClick={() => addExercise(adding)}
                    aria-label="Add exercise"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-line-mid text-ink-2 hover:border-accent hover:text-ink"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </section>

              <motion.button
                type="button"
                onClick={() => {
                  haptic(10);
                  setMode("review");
                }}
                whileTap={{ scale: 0.97 }}
                transition={TICK}
                className="mono-xs flex min-h-12 w-full items-center justify-center rounded-sm border border-accent bg-ink text-accent-fg"
              >
                finish session
              </motion.button>
            </div>
          ) : (
            /* ---------------------------------------------------- review */
            <div className="mt-4 space-y-6 pb-2">
              <section>
                <h3 className="kicker">The receipts</h3>
                <p className="mt-2 font-mono text-[26px] font-bold tabular-nums leading-none tracking-[-0.02em] text-ink">
                  {formatLbs(sessionTonnage(session))}
                  <span className="mono-xs ml-1.5 font-normal text-ink-3">lb moved</span>
                </p>
                <p className="mono-xs mt-2 tabular-nums text-ink-3">
                  {totalSets} sets · {mmss(nowMs - session.startedAt)} ·{" "}
                  {session.exercises.filter((e) => e.sets.length > 0).length} exercises
                  {(() => {
                    const prs = session.exercises.reduce(
                      (a, e) => a + e.sets.filter((s) => s.pr).length,
                      0,
                    );
                    return prs > 0 ? ` · ${prs} PR` : "";
                  })()}
                </p>
              </section>

              <section>
                <h3 className="kicker">How hard was that</h3>
                <p className="mono-xs mt-1 text-ink-4">
                  session RPE — this is the recovery dial, be honest
                </p>
                <div className="mt-2 flex gap-1.5">
                  {[6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={reviewRpe === n}
                      onClick={() => {
                        haptic(8);
                        setReviewRpe(reviewRpe === n ? undefined : n);
                      }}
                      className={`mono-xs min-h-11 flex-1 rounded-sm border tabular-nums transition-colors ${
                        reviewRpe === n
                          ? "border-accent bg-ink/[0.10] text-ink"
                          : "border-line-mid text-ink-3"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </section>

              <label className="block space-y-2">
                <span className="meta block">Note</span>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={2}
                  placeholder="what a sentence is good at — felt flat, moved fast, elbow again…"
                  className="w-full resize-none rounded-sm border border-line-soft bg-surface-2 px-3 py-3 text-[16px] text-ink placeholder:text-ink-4 outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
              </label>

              <div className="space-y-2.5">
                <motion.button
                  type="button"
                  onClick={saveAndClose}
                  whileTap={{ scale: 0.97 }}
                  transition={TICK}
                  className="mono-xs flex min-h-12 w-full items-center justify-center rounded-sm border border-accent bg-ink text-accent-fg"
                >
                  save session
                </motion.button>
                <button
                  type="button"
                  onClick={() => setMode("log")}
                  className="mono-xs flex min-h-11 w-full items-center justify-center rounded-sm border border-line-mid text-ink-2"
                >
                  back to the bar
                </button>
                <button
                  type="button"
                  onClick={discard}
                  className={`mono-xs flex min-h-11 w-full items-center justify-center rounded-sm border transition-colors ${
                    armDiscard ? "border-bad text-bad" : "border-line-soft text-ink-4"
                  }`}
                >
                  {armDiscard ? "tap again — this deletes the whole session" : "discard session"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
