"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useClock } from "@/hooks/use-clock";
import { buildDay, type DayBlock, type DayModel } from "@/lib/day";
import { approach, upcomingHeight } from "@/lib/layout";
import { buildHabitSeries } from "@/lib/series";
import { getDailyLog, lastTrainingNote, saveDailyLog } from "@/lib/storage";
import { formatHeaderDate, makeEmptyLog } from "@/lib/today";
import { HABITS_CHANGED, getHabits, type HabitDef } from "@/lib/habits";
import { habitTally } from "@/lib/day";
import { formatClock, formatDuration } from "@/lib/clock";
import type { DailyLog, HabitKey } from "@/lib/types";
import { FourteenDay } from "@/components/review/fourteen-day";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { FloatingHabitSheet } from "./floating-habit-sheet";
import { WeekStrip, buildWeek, type WeekDay } from "./week-strip";
import { Settings2 } from "lucide-react";
import { HabitGlyph } from "./habit-glyph";
import { Latch } from "./latch";
import { MinutesField, NoteField, ShippedField } from "./fields";

const PULL_COMMIT = 96;
const S_PAGE = { type: "spring", stiffness: 300, damping: 34, mass: 0.9 } as const;
const S_SNAP = { type: "spring", stiffness: 400, damping: 32, mass: 1 } as const;

/** Bands arrive top-down; the live block leads so the eye lands there first. */
function rise(order: number, reduced: boolean | null) {
  return {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduced
      ? { duration: 0.18, delay: order * 0.03 }
      : {
          type: "spring" as const,
          stiffness: 300,
          damping: 30,
          mass: 0.9,
          delay: order * 0.06,
        },
  };
}

/* ---------------------------------------------------------------- masthead */

function Masthead({
  day,
  seconds,
  tally,
  minutes,
  onSettings,
}: {
  day: DayModel;
  seconds: string;
  tally: { done: number; total: number };
  minutes: number;
  onSettings: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pt-1 pb-3">
      <div className="min-w-0">
        <p className="kicker truncate">{formatHeaderDate(day.date)}</p>
        {/* Where the day actually stands, at a glance, without a trip anywhere. */}
        <p className="mono-xs mt-1.5 text-ink-3">
          <span className="text-ink-2">
            {tally.done}/{tally.total}
          </span>
          {minutes > 0 ? ` · ${minutes}m deep` : ""}
          {" · ends "}
          {day.blocks.length ? day.blocks[day.blocks.length - 1].block.end : "—"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {/* The seconds are the proof of life — the now-rail moves too slowly to read. */}
        <span className="mono-sm tabular-nums text-ink-2">
          {seconds}
        </span>
        <button
          type="button"
          aria-label="Settings"
          onClick={onSettings}
          className="flex h-11 w-11 items-center justify-center rounded-pill text-ink-3 hover:text-ink"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- past */

function PastLine({ b }: { b: DayBlock }) {
  return (
    <div className="flex items-baseline gap-2.5 py-[3px]">
      <span className="mono-sm w-[42px] shrink-0 tabular-nums text-ink-3">
        {b.block.start}
      </span>
      <span className="mono-xs truncate text-ink-3">{b.block.label}</span>
    </div>
  );
}

function Past({ blocks }: { blocks: DayBlock[] }) {
  if (blocks.length === 0) return null;
  // Two named lines, not three. The rail is clipped by its container, and a
  // line sliced through the middle reads as a rendering fault rather than as
  // context — so the rail has to ask for less room than it is ever given.
  const tail = blocks.slice(-2);
  const head = blocks.slice(0, -2);

  return (
    <motion.div layout="position" className="px-5">
      {head.length > 0 ? (
        <p className="mono-xs truncate py-[3px] text-ink-4">
          {head.map((b) => b.block.label).join(" · ")}
        </p>
      ) : null}
      {tail.map((b, i) => (
        <motion.div
          key={b.index}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30, delay: 0.06 + i * 0.04 }}
        >
          <PastLine b={b} />
        </motion.div>
      ))}
      <div className="mt-2 h-px w-6 bg-line-mid" />
    </motion.div>
  );
}

/* ---------------------------------------------------------------- upcoming */

/** Dead air worth naming. Below this it is just walking time. */
const OPEN_MIN = 12;

function OpenGap({ minutes }: { minutes: number }) {
  return (
    <div className="mt-1.5 flex items-center gap-2.5">
      <span className="w-[42px] shrink-0" />
      <span className="h-px w-3 bg-line-mid" />
      {/* The most useful line on the screen between two classes. */}
      <span className="mono-xs text-ink-3">{formatDuration(minutes)} open</span>
    </div>
  );
}

function Upcoming({
  blocks,
  prevEndMin,
}: {
  blocks: DayBlock[];
  /** End of whatever precedes this list, so the first gap is measurable. */
  prevEndMin: number | null;
}) {
  if (blocks.length === 0) return null;
  const [next, ...rest] = blocks;
  // Two previews, not three — same reason as the past rail. Everything beyond
  // them collapses into the single condensed line at the foot, which costs one
  // row instead of three and never gets clipped in half.
  const soon = rest.slice(0, 2);
  const after = rest.slice(2);
  // Authored large and scaled down, so growth is a GPU transform, not a reflow.
  const p = approach(next.untilStart);
  const leadGap = prevEndMin == null ? 0 : next.startMin - prevEndMin;

  return (
    <motion.div layout="position" className="px-5">
      <div className="h-px w-6 bg-line-mid" />
      {leadGap >= OPEN_MIN ? <OpenGap minutes={leadGap} /> : null}
      <motion.div
        layout
        transition={S_PAGE}
        className="flex items-center gap-2.5"
        style={{ height: upcomingHeight(next.untilStart) * 0.52 }}
      >
        <span className="mono-sm w-[42px] shrink-0 tabular-nums text-ink-3">
          {next.block.start}
        </span>
        <motion.span
          className="origin-left truncate font-light tracking-[-0.02em] text-ink-2"
          // Authored at 26px and scaled down: ~14px of travel as it approaches,
          // which is actually visible, unlike the 7px the first pass produced.
          style={{ fontSize: 26, scale: 0.55 + 0.45 * p, opacity: 0.45 + 0.55 * p }}
        >
          {next.block.label}
        </motion.span>
        <span className="mono-sm ml-auto shrink-0 tabular-nums text-ink-3">
          {formatDuration(next.untilStart)}
        </span>
      </motion.div>

      {soon.map((b, i) => {
        const prev = i === 0 ? next : soon[i - 1];
        const gap = b.startMin - prev.endMin;
        // Every upcoming block grows, not just the first — and the row height
        // grows with it, so approach is felt in the layout and not only in the
        // type size. This is what `lib/layout.ts` exists for.
        const q = approach(b.untilStart);
        return (
          <div key={b.index}>
            {gap >= OPEN_MIN ? <OpenGap minutes={gap} /> : null}
            <motion.div
              layout
              transition={S_PAGE}
              className="flex items-center gap-2.5"
              style={{ height: upcomingHeight(b.untilStart) * 0.42 }}
            >
              <span className="mono-sm w-[42px] shrink-0 tabular-nums text-ink-3">
                {b.block.start}
              </span>
              <motion.span
                className="origin-left truncate tracking-[-0.01em] text-ink-2"
                style={{
                  fontSize: 17,
                  scale: 0.72 + 0.28 * q,
                  opacity: 0.62 + 0.38 * q,
                }}
              >
                {b.block.label}
              </motion.span>
            </motion.div>
          </div>
        );
      })}

      {after.length > 0 ? (
        <p className="mono-xs mt-2 truncate text-ink-4">
          {after.map((b) => b.block.label).join(" · ")}
        </p>
      ) : null}
    </motion.div>
  );
}

/* --------------------------------------------------------------- gap now */

/**
 * Dead air still has a now. Between blocks there is no live block to carry the
 * now-line, so the gap itself becomes the instrument: a travelling index that
 * crosses the span continuously and a live countdown to the next thing.
 */
function GapNow({
  from,
  to,
  label,
  nowMV,
}: {
  /** End of the last thing that happened; null before the day starts. */
  from: number | null;
  to: number;
  label: string;
  nowMV: ReturnType<typeof useClock>["nowMV"];
}) {
  const span = from == null ? 0 : Math.max(1, to - from);
  const left = useTransform(nowMV, (m) => formatDuration(Math.max(0, to - m)));
  const pos = useTransform(nowMV, (m) =>
    from == null ? "0%" : `${Math.min(100, Math.max(0, ((m - from) / span) * 100))}%`,
  );

  return (
    <motion.div layout="position" className="px-5 pb-1">
      {from != null ? (
        <div className="relative mt-1 h-px w-full bg-line-soft">
          <motion.span
            aria-hidden
            className="absolute -top-[2px] h-[5px] w-[5px] rounded-pill bg-accent"
            style={{ left: pos }}
          />
        </div>
      ) : null}
      <p className="mono-xs mt-2.5 text-ink-3">
        open · <motion.span>{left}</motion.span> to {label}
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ footer */

function Register({
  day,
  log,
  habits,
  onOpen,
  onRecall,
  onFloating,
}: {
  day: DayModel;
  log: DailyLog | null;
  habits: HabitDef[];
  onOpen: () => void;
  onRecall: (blockIndex: number) => void;
  /** A habit with no block of its own — committed in a sheet instead. */
  onFloating: (id: HabitKey) => void;
}) {
  const blockOf = new Map<HabitKey, number>();
  const endedOf = new Map<HabitKey, boolean>();
  for (const b of day.blocks) {
    for (const id of b.habits) {
      blockOf.set(id, b.index);
      endedOf.set(id, b.phase === "past");
    }
  }
  const floating = new Set(day.floating);

  return (
    <div className="flex items-center gap-3 px-5">
      {/* Scrolls rather than shrinks: the register is a fixed row in a fixed
          column, and once habits are user-defined there is no upper bound on
          how many glyphs land here. Five fit; twelve would have squeezed the
          "pull for record" affordance off the edge. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {habits.map((h) => {
          const k = h.id;
          const idx = blockOf.get(k);
          const isFloating = floating.has(k);
          const scheduled = idx != null || isFloating;
          const done = log?.habits?.[k] === true;
          return (
            <button
              key={k}
              type="button"
              title={h.label}
              aria-label={`${h.label} — ${
                !scheduled
                  ? "not scheduled today"
                  : done
                    ? "done, open to change"
                    : "not logged, open to log"
              }`}
              disabled={!scheduled}
              // Recalls the block that owns this habit, which is the only way
              // to reach one whose window has already closed. A habit with no
              // block opens its own sheet, so it is reachable at any hour.
              onClick={() => {
                if (idx != null) onRecall(idx);
                else if (isFloating) onFloating(k);
              }}
              className="flex min-h-11 items-center disabled:cursor-default"
            >
              <HabitGlyph
                habit={k}
                code={h.code}
                state={
                  !scheduled
                    ? "unscheduled"
                    : done
                      ? "done"
                      : endedOf.get(k)
                        ? "overdue"
                        : "pending"
                }
              />
            </button>
          );
        })}
      </div>
      {/* The pull is primary; this is the discoverable equivalent, and the
          only path available to a keyboard or assistive-tech user. */}
      <button
        type="button"
        onClick={onOpen}
        className="mono-xs ml-auto min-h-11 text-ink-3 hover:text-ink-2"
      >
        pull for record
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- focus block */

function FocusBlock({
  b,
  day,
  log,
  habitById,
  nowMV,
  onHabit,
  onPatch,
  onRecoil,
  recalled,
  onReturn,
}: {
  b: DayBlock;
  day: DayModel;
  log: DailyLog | null;
  habitById: Map<string, HabitDef>;
  nowMV: ReturnType<typeof useClock>["nowMV"];
  onHabit: (k: HabitKey, v: boolean) => void;
  onPatch: (p: Partial<DailyLog>) => void;
  onRecoil: () => void;
  /** True when this block was summoned rather than being the live one. */
  recalled: boolean;
  onReturn: () => void;
}) {
  const live = day.currentIndex === b.index;
  const held = day.graceIndex === b.index;
  const started = day.nowMin >= b.startMin;
  const lastSession = useMemo(
    () =>
      b.fields.includes("trainingNote") ? lastTrainingNote(day.date) : null,
    [b.fields, day.date],
  );
  const span = Math.max(1, b.endMin - b.startMin);
  const pct = useTransform(nowMV, (m) => {
    const p = Math.min(1, Math.max(0, (m - b.startMin) / span));
    return `${p * 100}%`;
  });
  const left = useTransform(nowMV, (m) => formatDuration(Math.max(0, b.endMin - m)));

  return (
    <motion.section
      layout
      // shrink-0: the card owns a latch and a field, and a clipped commit
      // control is worse than a clipped context row. The rails absorb the
      // squeeze instead.
      className="relative mx-5 shrink-0 overflow-hidden rounded-lg border border-line-soft bg-surface py-5 pr-4 pl-9"
    >
      {/*
        The time rail.

        Elapsed progress used to be a full-width wash with a full-width hairline
        at `now` drawn over the content. Both crossed whatever field happened to
        sit at the current minute — at 10:49 inside a 10:00–12:20 block that is
        exactly the deep-work readout, so the line ran through the digits and
        the wash edge sat on their baseline.

        The rail carries the same three facts in a gutter of its own: filled
        above for elapsed, empty below for remaining, a dot at now. It cannot
        collide with type because no type is ever in that column.
      */}
      <div
        aria-hidden
        // line-mid, not line-soft: in dark, line-soft (#262629) against the
        // card surface (#141417) is invisible, so the rail read as a line that
        // simply stopped at now, with no sense of how much block was left.
        className="pointer-events-none absolute inset-y-5 left-4 w-px bg-line-mid"
      >
        {live ? (
          <>
            <motion.span
              className="absolute inset-x-0 top-0 block bg-accent/40"
              style={{ height: pct }}
            />
            <motion.span
              className="absolute -left-[2px] h-[5px] w-[5px] -translate-y-1/2 rounded-pill bg-accent"
              style={{ top: pct }}
            />
          </>
        ) : null}
      </div>

      <div className="relative">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-sm tabular-nums text-ink-3">
            {b.block.start} — {b.block.end}
          </span>
          <span className="mono-xs shrink-0 text-ink-3">
            {recalled
              ? "recalled"
              : held
                ? "held"
                : live
                  ? <motion.span>{left}</motion.span>
                  : `in ${formatDuration(b.untilStart)}`}
          </span>
        </div>

        {/* Size at low weight: presence without luminance. */}
        <h1 className="mt-2.5 text-[32px] font-light leading-[1.02] tracking-[-0.03em] text-ink">
          {b.block.label}
        </h1>

        {recalled ? (
          <button
            type="button"
            onClick={onReturn}
            className="mono-xs mt-2 min-h-11 text-ink-3 hover:text-ink"
          >
            ← back to now
          </button>
        ) : held ? (
          <p className="mono-xs mt-2 text-warn">still open — throw it</p>
        ) : null}

        <div className="mt-5 space-y-5">
          {b.fields.includes("deepWorkMinutes") ? (
            <MinutesField
              value={log?.deepWorkMinutes ?? 0}
              blockMinutes={span}
              onChange={(v) => onPatch({ deepWorkMinutes: v })}
            />
          ) : null}

          {b.fields.includes("trainingNote") ? (
            <div className="space-y-2">
              <NoteField
                label="Session"
                placeholder="6 × 800 @ 5:42"
                value={log?.trainingNote ?? ""}
                onChange={(v) => onPatch({ trainingNote: v })}
              />
              {lastSession ? (
                <p className="mono-xs truncate text-ink-3">
                  last · {lastSession.note}
                </p>
              ) : null}
            </div>
          ) : null}

          {b.fields.includes("contentShipped") ? (
            <ShippedField
              value={log?.contentShipped ?? false}
              onChange={(v) => onPatch({ contentShipped: v })}
            />
          ) : null}

          {b.fields.includes("note") ? (
            <NoteField
              label="Close the day"
              placeholder="One line."
              rows={2}
              value={log?.note ?? ""}
              onChange={(v) => onPatch({ note: v })}
            />
          ) : null}

          {/* The commits sit last: read the block, fill it in, then throw it.
              Last also means lowest — inside the one-handed thumb arc.
              A block that has not begun cannot be thrown: otherwise Saturday
              afternoon offers a Lights-out latch that stamps 16:00.
              Plural now — nothing stops a user anchoring two habits here. */}
          {b.habits.length > 0 && !started ? (
            <p className="mono-xs text-ink-3">opens {b.block.start}</p>
          ) : null}
          {started
            ? b.habits.map((id) => {
                const def = habitById.get(id);
                if (!def) return null;
                return (
                  <Latch
                    key={id}
                    habit={id}
                    icon={def.icon}
                    label={def.label}
                    checked={log?.habits?.[id] === true}
                    stampMin={log?.stamps?.[id]}
                    onChange={(v) => onHabit(id, v)}
                    onRecoil={onRecoil}
                  />
                );
              })
            : null}
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ screen */

export function DayScreen() {
  const reduced = useReducedMotion();
  const clock = useClock();
  const [log, setLog] = useState<DailyLog | null>(null);
  // Lazy initial read: the registry lives in localStorage, and the real UI is
  // gated behind `clock.ready`, so nothing rendered before mount can mismatch.
  const [habits, setHabits] = useState<HabitDef[]>(getHabits);
  const [mode, setMode] = useState<"day" | "record">("day");
  /** A floating habit being committed in its own sheet. */
  const [floatingId, setFloatingId] = useState<HabitKey | null>(null);
  /** A recalled block index, or null when following the live day. */
  const [selected, setSelected] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recordHeadingRef = useRef<HTMLHeadingElement>(null);
  const recoil = useMotionValue(0);
  const pull = useMotionValue(0);
  const loadedFor = useRef<string>("");

  const [seconds, setSeconds] = useState("--:--:--");
  useEffect(() => {
    if (clock.pinned) {
      setSeconds(formatClock(clock.nowMin));
      return;
    }
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setSeconds(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [clock.pinned, clock.nowMin]);

  useEffect(() => {
    if (!clock.ready || loadedFor.current === clock.date) return;
    loadedFor.current = clock.date;
    setLog(getDailyLog(clock.date) ?? makeEmptyLog(clock.date));
  }, [clock.ready, clock.date]);

  useEffect(() => {
    if (mode === "record") recordHeadingRef.current?.focus();
  }, [mode]);

  // Editing habits in the settings sheet must redraw the spine underneath it.
  useEffect(() => {
    const reload = () => setHabits(getHabits());
    window.addEventListener(HABITS_CHANGED, reload);
    return () => window.removeEventListener(HABITS_CHANGED, reload);
  }, []);

  const habitById = useMemo(
    () => new Map(habits.map((h) => [h.id, h])),
    [habits],
  );

  const day = useMemo(
    () => buildDay(clock.date, clock.nowMin, log, habits),
    [clock.date, clock.nowMin, log, habits],
  );

  const week = useMemo<WeekDay[]>(
    () => (clock.ready ? buildWeek(clock.date) : []),
    [clock.ready, clock.date, log, habits],
  );

  const series = useMemo(
    () => (mode === "record" ? buildHabitSeries(14, clock.date) : []),
    // Recompute whenever the record is opened or the log changes beneath it.
    [mode, log, clock.date, habits],
  );

  const patch = useCallback(
    (p: Partial<DailyLog>) => {
      setLog((prev) => {
        const next = { ...(prev ?? makeEmptyLog(clock.date)), ...p };
        saveDailyLog(next);
        return next;
      });
    },
    [clock.date],
  );

  const setHabit = useCallback(
    (k: HabitKey, v: boolean) => {
      setLog((prev) => {
        const base = prev ?? makeEmptyLog(clock.date);
        const stamps = { ...(base.stamps ?? {}) };
        if (v) stamps[k] = Math.floor(clock.nowMin);
        else delete stamps[k];
        // Backfill is a visit, not a destination — go back to now once thrown.
        setSelected(null);
        const next: DailyLog = {
          ...base,
          habits: { ...base.habits, [k]: v },
          stamps,
        };
        saveDailyLog(next);
        return next;
      });
    },
    [clock.date, clock.nowMin],
  );

  // The whole instrument takes the shock — the mass reads as the device.
  const fireRecoil = useCallback(() => {
    if (reduced) return;
    // Keyframes must run as a tween. A spring across three keyframes resolves
    // origin === target and plays nothing — the recoil was silently dead, and
    // it is the whole substitute for haptics on iPhone.
    animate(recoil, [0, 4, 0], {
      duration: 0.26,
      times: [0, 0.28, 1],
      ease: [0.22, 1, 0.36, 1],
    });
  }, [recoil, reduced]);

  // Backfill. Blocks butt up against each other on MWF — Wake ends exactly when
  // Run starts — so a habit whose block has closed had a zero-second commit
  // window and was lost for the day. Summoning its block back is the fix: the
  // habit is still thrown inside the block that owns it, that block is just
  // recalled. Selection clears itself once the throw lands.
  const focusIndex = selected != null && day.blocks[selected] ? selected : day.focusIndex;
  const focus = day.blocks[focusIndex];
  const recalled = focusIndex !== day.focusIndex;
  const showFocus =
    focus &&
    (recalled || !(day.state === "after" && day.graceIndex < 0)) &&
    mode === "day";
  // No live block and nothing held: we are in real dead air, and the gap needs
  // its own now-indicator because the focus block has not started yet.
  const inDeadAir =
    !recalled &&
    day.currentIndex < 0 &&
    day.graceIndex < 0 &&
    !!focus &&
    focus.phase === "upcoming";
  const lastPastEnd =
    [...day.blocks].reverse().find((b) => b.phase === "past")?.endMin ?? null;
  const past = day.blocks.filter(
    (b) => b.phase === "past" && b.index !== focusIndex,
  );
  const upcoming = day.blocks.filter(
    (b) => b.phase === "upcoming" && b.index !== focusIndex,
  );

  if (!clock.ready) return <main className="min-h-dvh" aria-hidden />;

  return (
    <motion.main
      style={{ y: recoil }}
      className="relative flex h-dvh flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]"
    >
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: mode === "record" ? 0.45 : 0.08, bottom: mode === "day" ? 0.45 : 0.08 }}
        dragMomentum={false}
        onDrag={(_, i) => pull.set(i.offset.y)}
        onDragEnd={(_, i) => {
          pull.set(0);
          if (mode === "day" && i.offset.y > PULL_COMMIT) setMode("record");
          else if (mode === "record" && i.offset.y < -PULL_COMMIT) setMode("day");
        }}
        transition={S_SNAP}
        className="flex h-full flex-col"
      >
        <LayoutGroup>
          <AnimatePresence mode="popLayout" initial={false}>
            {mode === "day" ? (
              <motion.div
                key="day"
                layout
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
                transition={S_PAGE}
                // The extra 12px past the inset is real clearance, not padding
                // taste: in standalone PWA mode with a black-translucent status
                // bar the OS paints its own legibility backdrop over the top of
                // the page, and anything sitting flush against the inset reads
                // as smeared through it. The date line was landing in that band.
                className="flex h-full flex-col pt-[calc(env(safe-area-inset-top)+12px)]"
              >
                <motion.div {...rise(0, reduced)} className="shrink-0">
                  <Masthead
                    day={day}
                    seconds={seconds}
                    tally={habitTally(day, log)}
                    minutes={log?.deepWorkMinutes ?? 0}
                    onSettings={() => setSettingsOpen(true)}
                  />
                </motion.div>

                {/* Weighted 1.7:1 so the live block — and its commit — sit low
                    enough to fall inside a one-handed thumb arc.

                    `overflow-hidden` is load-bearing. These context rails are
                    the only elastic regions in a fixed h-dvh column, so on a
                    short screen they are squeezed below their content height —
                    and without clipping their rows simply spilled out of the
                    box and painted over whatever came next. That is what put
                    the week strip on top of SPAN 1115 and the register glyphs
                    on top of the evening line. Clipped, the same squeeze just
                    shows fewer rows. */}
                <motion.div
                  {...rise(1, reduced)}
                  className="flex min-h-0 flex-[1.7] flex-col justify-end gap-3 overflow-hidden pb-1"
                >
                  <Past blocks={past} />
                </motion.div>

                {inDeadAir && focus ? (
                  <GapNow
                    from={lastPastEnd}
                    to={focus.startMin}
                    label={focus.block.label}
                    nowMV={clock.nowMV}
                  />
                ) : null}

                {showFocus ? (
                  <FocusBlock
                    b={focus}
                    day={day}
                    log={log}
                    habitById={habitById}
                    nowMV={clock.nowMV}
                    onHabit={setHabit}
                    onPatch={patch}
                    onRecoil={fireRecoil}
                    recalled={recalled}
                    onReturn={() => setSelected(null)}
                  />
                ) : (
                  <section className="mx-5 shrink-0 rounded-lg border border-line-soft bg-surface px-5 py-10 text-center">
                    <h1 className="text-[32px] font-light leading-none tracking-[-0.03em] text-ink">
                      Day closed
                    </h1>
                    <p className="mono-xs mt-3 text-ink-3">next up 04:45</p>
                  </section>
                )}

                <motion.div
                  {...rise(3, reduced)}
                  className="flex min-h-0 flex-1 flex-col justify-start gap-3 overflow-hidden pt-3"
                >
                  <Upcoming
                    blocks={upcoming}
                    prevEndMin={showFocus && focus ? focus.endMin : null}
                  />
                </motion.div>

                {/* The register is the one thing that must never be squeezed
                    off: it is the only route to a habit whose block has closed. */}
                <motion.div
                  {...rise(4, reduced)}
                  className="shrink-0 space-y-3 pb-3"
                >
                  {week.length > 0 ? <WeekStrip week={week} /> : null}
                  <Register
                    day={day}
                    log={log}
                    habits={habits}
                    onOpen={() => setMode("record")}
                    onRecall={setSelected}
                    onFloating={setFloatingId}
                  />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="record"
                layout
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
                transition={S_PAGE}
                className="flex h-full flex-col overflow-y-auto px-5 pt-[calc(env(safe-area-inset-top)+8px)]"
              >
                {/* A real heading, focused on entry: the morph replaces the
                    whole surface, and without this a screen reader is left on a
                    control that no longer exists and announces nothing. */}
                <div className="pb-2 text-center">
                  <h1
                    ref={recordHeadingRef}
                    tabIndex={-1}
                    className="kicker outline-none"
                  >
                    The record
                  </h1>
                  <p className="meta mt-1.5">last 14 days · never miss twice</p>
                </div>
                <FourteenDay series={series} />
                <div className="flex flex-col items-center gap-4 pb-8">
                  <button
                    type="button"
                    onClick={() => setMode("day")}
                    className="mono-xs min-h-11 text-center text-ink-3 hover:text-ink-2"
                  >
                    pull up to return
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </motion.div>
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <FloatingHabitSheet
        habit={floatingId ? habitById.get(floatingId) : undefined}
        log={log}
        onChange={setHabit}
        onClose={() => setFloatingId(null)}
      />
    </motion.main>
  );
}
