"use client";

import type { ReactNode } from "react";
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
import { haptic } from "@/lib/haptics";
import type { DailyLog, HabitKey } from "@/lib/types";
import { FourteenDay } from "@/components/review/fourteen-day";
import { HistoryScreen } from "@/components/history/history-screen";
import { DaySheet } from "@/components/history/day-sheet";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { FloatingHabitSheet } from "./floating-habit-sheet";
import { WeekStrip, buildWeek, type WeekDay } from "./week-strip";
import { Settings2 } from "lucide-react";
import { HabitGlyph } from "./habit-glyph";
import { Latch } from "./latch";
import { MinutesField, NoteField, ShippedField } from "./fields";

const PULL_COMMIT = 96;

/**
 * The surfaces, ordered by depth. Pulling down goes deeper, pulling up comes
 * back — the app stays one screen and gains surfaces by gesture rather than by
 * routes. Each end of the stack is its own neighbour, which is what makes the
 * top and bottom feel like ends.
 */
const STACK = ["day", "record", "history"] as const;
type Mode = (typeof STACK)[number];

function step(mode: Mode, delta: 1 | -1): Mode {
  const i = STACK.indexOf(mode);
  return STACK[Math.min(STACK.length - 1, Math.max(0, i + delta))];
}
const S_PAGE = { type: "spring", stiffness: 300, damping: 34, mass: 0.9 } as const;
const S_SNAP = { type: "spring", stiffness: 700, damping: 44, mass: 0.8 } as const;

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

/* ------------------------------------------------------------------ wheel */

/**
 * The column is a drum.
 *
 * The focus card is the seat — the one place on the wheel that faces you
 * squarely. Everything else lies on the curve running away from it: the day
 * behind you above, the day ahead below. A row's distance from the seat is the
 * only input; from it comes how far the row has tipped away, how far it has
 * receded, and how much of it is still in focus.
 *
 * The curve is deep, and that was a choice made against a flatter, more
 * legible one. A shallow drum keeps the whole morning crisp; this one turns
 * far enough that the rim goes soft and the earliest rows read as distance
 * rather than as text. WHEEL_MAX is what stops it turning edge-on — past
 * about sixty degrees the type has no height left and the rail reads as a
 * fault. If the morning ever needs to be read at a glance, this is the number
 * to bring down, not the blur.
 *
 * WHEEL_PULL is the foreshortening. Rows sit in normal flow at even spacing,
 * but a cylinder's rows crowd together as they turn away, so each one is drawn
 * back toward the seat by a little more than the last. Without it the tilt
 * opens a gap under every row and the stack reads as slats, not a surface.
 */
const WHEEL_STEP = 12;
const WHEEL_MAX = 58;
const WHEEL_PULL = 44;

/** The wheel's own spring: quick, barely any overshoot, settles like a detent. */
const S_WHEEL = { type: "spring", stiffness: 380, damping: 34, mass: 0.7 } as const;
/** The seat's is looser, so the arriving card lands with a little weight. */
const S_SEAT = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 } as const;

/** Which side of the seat a row is on: -1 above (past), +1 below (ahead). */
type Side = 1 | -1;

/** Where a row `d` places from the seat rests on the curve. */
function pose(d: number, side: Side, reduced: boolean | null) {
  if (reduced) {
    return {
      rotateX: 0,
      y: 0,
      scale: 1,
      opacity: Math.max(0.6, 1 - d * 0.04),
      filter: "blur(0px)",
    };
  }
  const tip = Math.min(WHEEL_MAX, d * WHEEL_STEP);
  const pull = Math.min(WHEEL_PULL, d * d);
  return {
    // Away from you on both sides: the top of a past row leans back, the
    // bottom of an upcoming one does.
    rotateX: -side * tip,
    y: -side * pull,
    scale: Math.max(0.86, 1 - d * 0.012),
    opacity: Math.max(0.42, 1 - d * 0.055),
    // The rim goes soft. Chosen deliberately over a flatter, more legible
    // curve — the far end of the day is context, and the seat is the work.
    filter: d >= 4 ? `blur(${Math.min(0.9, (d - 3) * 0.2).toFixed(2)}px)` : "blur(0px)",
  };
}

/** Rows join and leave the wheel through the seat, because that is the truth. */
function atSeat(side: Side, reduced: boolean | null) {
  if (reduced) return { opacity: 0 };
  return {
    opacity: 0,
    y: -side * 26,
    // Flatter than its resting pose: it has just come over the top.
    rotateX: side * 12,
    scale: 0.95,
    filter: "blur(1.4px)",
  };
}

/**
 * One row on the curve, in two layers.
 *
 * The outer one owns `layout` and nothing else that moves — layout animates by
 * writing transforms, so anything artistic on the same element fights it for
 * the same matrix. The inner one owns the pose. Membership changes (the wheel
 * turning) are the outer's job; where a row sits on the curve is the inner's.
 */
function WheelRow({
  d,
  side,
  reduced,
  children,
}: {
  d: number;
  side: Side;
  reduced: boolean | null;
  children: ReactNode;
}) {
  // Nearest the seat leads, so a turn resolves outward instead of arriving all
  // at once.
  const delay = Math.min(0.14, (d - 1) * 0.022);
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(3px)" }}
      transition={{ ...S_WHEEL, delay }}
    >
      <motion.div
        /*
          Origin at the left edge, and it is the whole reason the rail reads as
          aligned. Scaling and tilting about the centre pulls a left-aligned
          row inward as it recedes, so the column of start times fanned out
          into a ragged margin — which looks like a bug, not like depth.
        */
        style={{ originX: 0, originY: side === -1 ? 1 : 0 }}
        initial={atSeat(side, reduced)}
        animate={pose(d, side, reduced)}
        transition={{ ...S_WHEEL, delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * The seat itself. Turning the wheel forward brings the next block up from
 * below and rolls the old one off the top; turning it back does the reverse.
 * `custom` carries the direction, which is the only way an exiting card can
 * know which way to leave — by then its own props are a render out of date.
 */
const SEAT = {
  enter: (dir: number) => ({
    opacity: 0,
    y: dir >= 0 ? 38 : -38,
    rotateX: dir >= 0 ? -20 : 20,
    scale: 0.94,
  }),
  seat: { opacity: 1, y: 0, rotateX: 0, scale: 1 },
  leave: (dir: number) => ({
    opacity: 0,
    y: dir >= 0 ? -32 : 32,
    rotateX: dir >= 0 ? 18 : -18,
    scale: 0.94,
  }),
};

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

function Past({
  blocks,
  reduced,
}: {
  blocks: DayBlock[];
  reduced: boolean | null;
}) {
  if (blocks.length === 0) {
    /*
      The top of the wheel, with nothing on it. It happens before the day
      starts and whenever you turn the wheel back to the first block, and an
      unexplained void that size reads as a fault rather than as an end. One
      line, sitting against the seat, says which it is.
    */
    return (
      <motion.div layout="position" className="px-5">
        <p className="mono-xs text-ink-4">the day starts here</p>
        <div className="mt-2 h-px w-6 bg-line-mid" />
      </motion.div>
    );
  }

  /*
    Every block the day has already been through, stacked, each keeping its
    own time. The older ones used to collapse into one horizontal run of
    labels — which saved height but turned the morning into a caption you
    cannot read a time off.

    Distance is measured from the seat, so the newest row — the one that just
    left the card — is 1, and the day recedes upward from there. The rail is
    bottom-aligned inside a fixed region, so a long day overflows at the top.
    That is why the container carries a fade rather than a hard edge: the
    oldest lines dissolve instead of being sliced, which reads as depth rather
    than as a clipping fault, and now agrees with the curve they sit on.
  */
  const n = blocks.length;
  return (
    <motion.div layout="position" className="px-5">
      <AnimatePresence mode="popLayout">
        {blocks.map((b, i) => (
          <WheelRow key={b.index} d={n - i} side={-1} reduced={reduced}>
            <PastLine b={b} />
          </WheelRow>
        ))}
      </AnimatePresence>
      <div className="mt-2 h-px w-6 bg-line-mid" />
    </motion.div>
  );
}

/**
 * Blocks that have already ended but sit *after* the seat on the wheel.
 *
 * They only exist once you turn the wheel back: recall Wake at 22:00 and the
 * whole rest of the day is behind you in time yet below you on the drum. Their
 * phase decides how they read — a finished block is a finished block — and
 * their position decides where they sit. Conflating the two is what made the
 * first pass of this feel wrong: recalling the morning left the evening piled
 * up above the seat, so nothing appeared to turn at all.
 */
function Stale({
  blocks,
  reduced,
}: {
  blocks: DayBlock[];
  reduced: boolean | null;
}) {
  if (blocks.length === 0) return null;
  return (
    <motion.div layout="position" className="px-5">
      <AnimatePresence mode="popLayout">
        {blocks.map((b, i) => (
          <WheelRow key={b.index} d={i + 1} side={1} reduced={reduced}>
            <PastLine b={b} />
          </WheelRow>
        ))}
      </AnimatePresence>
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
  reduced,
  dOffset = 0,
}: {
  blocks: DayBlock[];
  /** End of whatever precedes this list, so the first gap is measurable. */
  prevEndMin: number | null;
  reduced: boolean | null;
  /** Rows already standing between the seat and this list, on the same curve. */
  dOffset?: number;
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
      <AnimatePresence mode="popLayout">
      <WheelRow key={next.index} d={dOffset + 1} side={1} reduced={reduced}>
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
      </WheelRow>

      {soon.map((b, i) => {
        const prev = i === 0 ? next : soon[i - 1];
        const gap = b.startMin - prev.endMin;
        // Every upcoming block grows, not just the first — and the row height
        // grows with it, so approach is felt in the layout and not only in the
        // type size. This is what `lib/layout.ts` exists for.
        const q = approach(b.untilStart);
        return (
          <WheelRow key={b.index} d={dOffset + i + 2} side={1} reduced={reduced}>
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
          </WheelRow>
        );
      })}

      {after.length > 0 ? (
        <WheelRow key="rim" d={dOffset + soon.length + 2} side={1} reduced={reduced}>
          <p className="mono-xs mt-2 truncate text-ink-4">
            {after.map((b) => b.block.label).join(" · ")}
          </p>
        </WheelRow>
      ) : null}
      </AnimatePresence>
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
  focusIndex,
  onRecall,
  onFloating,
}: {
  day: DayModel;
  log: DailyLog | null;
  habits: HabitDef[];
  /** The block currently in the seat, so the register can show where it is. */
  focusIndex: number;
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
  /*
    Where the wheel is parked. One marker, not a flag per letter — two habits
    can share a block, and two elements sharing a layoutId is how you get
    Motion animating a marker to a place it is also leaving.
  */
  const seatedId = habits.find((h) => blockOf.get(h.id) === focusIndex)?.id;

  /*
    Scrub. Press anywhere on the register and slide sideways: the glyph nearest
    the finger becomes the focused block, so the end of the day is one
    continuous gesture instead of tap, throw, tap, throw.

    Selection is by nearest centre, not by what is under the point. The event
    target is no use — a touch pointer is implicitly captured by whatever took
    the pointerdown, so it names the first glyph for the whole drag — and
    point hit-testing drops the gaps between glyphs, which made the row stutter
    and swallowed the first letter outright, since the gesture only engages
    after ten pixels and that is already past the letter you started on.
  */
  const rowRef = useRef<HTMLDivElement>(null);
  const marks = useRef<{ id: string; cx: number }[]>([]);
  const scrubbing = useRef(false);
  const scrubbed = useRef(false);
  const startAt = useRef<{ x: number; y: number } | null>(null);
  const lastPicked = useRef<string | null>(null);

  const pick = useCallback(
    (id: HabitKey) => {
      if (id === lastPicked.current) return;
      const idx = blockOf.get(id);
      const isFloating = floating.has(id);
      // Not scheduled today: nothing to open, and skipping it keeps the slide
      // continuous rather than stalling on a dead letter.
      if (idx == null && !isFloating) return;
      lastPicked.current = id;
      haptic(6);
      if (idx != null) onRecall(idx);
      else onFloating(id);
    },
    [blockOf, floating, onRecall, onFloating],
  );

  /** Whichever glyph centre the finger is closest to, gaps included. */
  const nearest = (x: number) => {
    let best: string | undefined;
    let bestD = Infinity;
    for (const m of marks.current) {
      const d = Math.abs(m.cx - x);
      if (d < bestD) {
        bestD = d;
        best = m.id;
      }
    }
    return best;
  };

  return (
    <div
      /*
        touch-none, and it is load-bearing. The drag ancestor is marked
        touch-action: pan-x, so the browser owns horizontal gestures — and the
        moment a scrub grew past a few pixels it claimed the gesture and fired
        pointercancel, killing the event stream after exactly one move. Taking
        horizontal touch outright here is what lets the slide run; the vertical
        stack swipe still works because Motion drags from pointer events, which
        keep flowing.
      */
      className="flex touch-none items-center justify-center px-5"
      onPointerDown={(e) => {
        // The row cannot reflow mid-gesture, so one read at the top is enough.
        marks.current = [
          ...(rowRef.current?.querySelectorAll<HTMLElement>("[data-habit]") ??
            []),
        ].map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.dataset.habit as string, cx: r.x + r.width / 2 };
        });
        startAt.current = { x: e.clientX, y: e.clientY };
        scrubbing.current = false;
        scrubbed.current = false;
        lastPicked.current = null;
      }}
      onPointerMove={(e) => {
        const s = startAt.current;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        // Only claim it once the movement is clearly sideways, so a vertical
        // swipe that happens to start here still reaches the surface stack.
        if (!scrubbing.current) {
          if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
          scrubbing.current = true;
          scrubbed.current = true;
        }
        const id = nearest(e.clientX);
        if (id) pick(id);
      }}
      onPointerUp={() => {
        startAt.current = null;
        scrubbing.current = false;
      }}
      onPointerCancel={() => {
        startAt.current = null;
        scrubbing.current = false;
      }}
    >
      {/* Centred, and no longer a scroll box: scrubbing owns the horizontal
          gesture here, so a scroller would only fight it. */}
      <div ref={rowRef} className="flex gap-2 overflow-hidden">
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
              data-habit={k}
              title={h.label}
              // aria-disabled, not disabled: the letter still reads and still
              // takes a press, it simply has no block to open.
              aria-disabled={!scheduled}
              aria-label={`${h.label} — ${
                !scheduled
                  ? "not scheduled today"
                  : done
                    ? "done, open to change"
                    : "not logged, open to log"
              }`}
              onClick={() => {
                // The slide already selected as it went.
                if (scrubbed.current) return;
                pick(k);
              }}
              className="relative flex min-h-11 items-center px-1"
            >
              {/* The marker is one element that moves between letters rather
                  than one per letter that fades — a shared layoutId is what
                  makes it slide under the finger instead of blinking across. */}
              {k === seatedId ? (
                <motion.span
                  layoutId="register-seat"
                  aria-hidden
                  className="absolute inset-y-[9px] -inset-x-[3px] rounded-sm border border-line-mid bg-surface-2"
                  transition={S_WHEEL}
                />
              ) : null}
              <HabitGlyph
                habit={k}
                code={h.code}
                seated={k === seatedId}
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
  dir,
  reduced,
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
  /** +1 when the wheel last turned toward later blocks, -1 toward earlier. */
  dir: number;
  reduced: boolean | null;
}) {
  const live = day.currentIndex === b.index;
  const held = day.graceIndex === b.index;
  const started = day.nowMin >= b.startMin;
  const lastSession = useMemo(
    () =>
      b.fields.includes("trainingNote")
        ? lastTrainingNote(day.date, b.block.label)
        : null,
    [b.fields, day.date, b.block.label],
  );
  const span = Math.max(1, b.endMin - b.startMin);
  const pct = useTransform(nowMV, (m) => {
    const p = Math.min(1, Math.max(0, (m - b.startMin) / span));
    return `${p * 100}%`;
  });
  const left = useTransform(nowMV, (m) => formatDuration(Math.max(0, b.endMin - m)));

  return (
    <motion.section
      /*
        No `layout` here any more. The seat animates on a variant that moves it
        in y and turns it in x, and layout animation drives the very same
        matrix — the two would take turns writing it and the card would judder
        on every detent. Popping out of flow is enough: the next card takes the
        seat the instant this one is released.
      */
      variants={SEAT}
      custom={dir}
      initial="enter"
      animate="seat"
      exit="leave"
      transition={S_SEAT}
      style={reduced ? undefined : { transformPerspective: 1100 }}
      // shrink-0: the card owns a latch and a field, and a clipped commit
      // control is worse than a clipped context row. The rails absorb the
      // squeeze instead.
      className="relative mx-5 shrink-0 overflow-hidden rounded-lg border border-line-soft bg-surface py-5 pr-4 pl-9"
    >
      {/* The detent. A block landing in the seat lights its own rim for half a
          second — the visual half of the tick the haptic already fires, and
          the thing that makes a scrub read as notched rather than continuous. */}
      {reduced ? null : (
        <motion.span
          aria-hidden
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 rounded-lg border border-accent/70"
        />
      )}
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

        {/* The session, from the template. Six different training days a week
            is more than anyone should have to hold in their head at 05:00, so
            the block says what it is instead of waiting to be remembered. */}
        {b.block.brief ? (
          <p className="mono-xs mt-2 text-ink-3">{b.block.brief}</p>
        ) : null}

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
  const [mode, setMode] = useState<Mode>("day");
  /** A past day opened for backfill from the history surface. */
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  /** Bumped after any write so history recounts without a full reload. */
  const [dataVersion, setDataVersion] = useState(0);
  /** A floating habit being committed in its own sheet. */
  const [floatingId, setFloatingId] = useState<HabitKey | null>(null);
  /** A recalled block index, or null when following the live day. */
  const [selected, setSelected] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recordHeadingRef = useRef<HTMLHeadingElement>(null);
  const historyHeadingRef = useRef<HTMLHeadingElement>(null);

  const deeper = step(mode, 1);
  const shallower = step(mode, -1);

  /*
    Arrow keys walk the same stack. The register used to carry a "pull for
    record" button, which was also the only route through for a keyboard or
    assistive-tech user; removing the visible hint should not remove the
    capability with it.
  */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") setMode(deeper);
      else if (e.key === "ArrowUp" || e.key === "PageUp") setMode(shallower);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deeper, shallower]);

  const recoil = useMotionValue(0);
  const pull = useMotionValue(0);
  /** The housing's own tip, kicked each time the wheel lands on a new seat. */
  const drum = useMotionValue(0);
  /** Which way the wheel last turned. Drives every entrance and exit on it. */
  const [dir, setDir] = useState(0);
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
    if (mode === "history") historyHeadingRef.current?.focus();
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
  /*
    Every turn of the wheel tips the whole housing a few degrees against the
    direction of travel and lets it fall back. It is small — five degrees, gone
    in half a second — and it is what stops a scrub from reading as a list
    swapping its contents: the column has mass, and you just moved it.
  */
  const lastSeat = useRef(focusIndex);
  useEffect(() => {
    if (focusIndex === lastSeat.current) return;
    const d = focusIndex > lastSeat.current ? 1 : -1;
    lastSeat.current = focusIndex;
    setDir(d);
    if (reduced) return;
    // Keyframes must run as a tween — see fireRecoil for why a spring across
    // them plays nothing at all.
    animate(drum, [-d * 4.5, 0], { duration: 0.62, ease: [0.16, 1, 0.3, 1] });
  }, [focusIndex, drum, reduced]);

  const lastPastEnd =
    [...day.blocks].reverse().find((b) => b.phase === "past")?.endMin ?? null;

  /*
    The column is split by where a block sits relative to the seat, not by
    whether it has happened. Those two agree all day — the seat is the live
    block, so everything behind it is past and everything ahead is upcoming —
    and they part company the moment you turn the wheel back to fill something
    in. Splitting by phase there left the evening stacked above a recalled
    morning: the seat changed and the column did not move, which is the exact
    opposite of a wheel.
  */
  const above = day.blocks.filter((b) => b.index < focusIndex);
  const below = day.blocks.filter((b) => b.index > focusIndex);
  // Phases run in order, so below is a run of finished blocks followed by a
  // run of ones still to come.
  const stale = below.filter((b) => b.phase === "past");
  const ahead = below.filter((b) => b.phase !== "past");
  // The first gap ahead is measured from whatever actually precedes it on the
  // wheel — otherwise recalling Wake reports sixteen hours open before bed.
  const beforeAhead =
    stale.length > 0
      ? stale[stale.length - 1].endMin
      : focus && showFocus
        ? focus.endMin
        : null;

  if (!clock.ready) return <main className="min-h-dvh" aria-hidden />;

  return (
    <motion.main
      style={{ y: recoil }}
      className="relative flex h-dvh flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]"
    >
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        /*
          Taut. 0.45 let the whole surface wallow half a screen before
          committing, which is what made the pages feel loose; 0.14 gives just
          enough travel to see the gesture register. The ends of the stack go
          almost rigid, so "there is nothing below this" is felt in the hand
          rather than discovered by a pull that does nothing.
        */
        dragElastic={{
          top: shallower === mode ? 0.03 : 0.14,
          bottom: deeper === mode ? 0.03 : 0.14,
        }}
        dragMomentum={false}
        onDrag={(_, i) => pull.set(i.offset.y)}
        onDragEnd={(_, i) => {
          pull.set(0);
          if (i.offset.y > PULL_COMMIT) setMode(deeper);
          else if (i.offset.y < -PULL_COMMIT) setMode(shallower);
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
                // Clearance for the status-bar band lives in .app-top — see
                // globals.css for why it is a named class rather than an
                // arbitrary value repeated at three call sites.
                className="app-top flex h-full flex-col"
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
                {/*
                  The drum. Everything between the masthead and the register
                  rides one surface: the day behind you curving away above, the
                  seat facing you, the day ahead curving away below.

                  The perspective lives on the two rails rather than here, with
                  its vanishing point pinned to the edge each rail shares with
                  the seat. One perspective for the whole column would need to
                  know where the seat sits in pixels, and the seat moves — the
                  card is a different height for a block that carries a note
                  than for one that carries a latch.
                */}
                <motion.div
                  style={
                    reduced
                      ? undefined
                      : { rotateX: drum, transformPerspective: 1400 }
                  }
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <motion.div
                    {...rise(1, reduced)}
                    style={
                      reduced
                        ? undefined
                        : { perspective: 1000, perspectiveOrigin: "50% 100%" }
                    }
                    className="fade-top flex min-h-0 flex-[1.7] flex-col justify-end gap-3 overflow-hidden pb-1"
                  >
                    <Past blocks={above} reduced={reduced} />
                  </motion.div>

                  {inDeadAir && focus ? (
                    <GapNow
                      from={lastPastEnd}
                      to={focus.startMin}
                      label={focus.block.label}
                      nowMV={clock.nowMV}
                    />
                  ) : null}

                  {/* initial={false}: the first card of the session is already
                      where it belongs, and flying it in would say the wheel
                      turned when nothing had. */}
                  <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                    {showFocus ? (
                      <FocusBlock
                        key={focus.index}
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
                        dir={dir}
                        reduced={reduced}
                      />
                    ) : (
                      <motion.section
                        key="closed"
                        variants={SEAT}
                        custom={dir}
                        initial="enter"
                        animate="seat"
                        exit="leave"
                        transition={S_SEAT}
                        className="mx-5 shrink-0 rounded-lg border border-line-soft bg-surface px-5 py-10 text-center"
                      >
                        <h1 className="text-[32px] font-light leading-none tracking-[-0.03em] text-ink">
                          Day closed
                        </h1>
                        <p className="mono-xs mt-3 text-ink-3">next up 04:45</p>
                      </motion.section>
                    )}
                  </AnimatePresence>

                  <motion.div
                    {...rise(3, reduced)}
                    style={
                      reduced
                        ? undefined
                        : { perspective: 1000, perspectiveOrigin: "50% 0%" }
                    }
                    className="fade-bottom flex min-h-0 flex-1 flex-col justify-start gap-3 overflow-hidden pt-3"
                  >
                    <Stale blocks={stale} reduced={reduced} />
                    <Upcoming
                      blocks={ahead}
                      prevEndMin={beforeAhead}
                      reduced={reduced}
                      dOffset={stale.length}
                    />
                  </motion.div>
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
                    focusIndex={focusIndex}
                    onRecall={setSelected}
                    onFloating={setFloatingId}
                  />
                </motion.div>
              </motion.div>
            ) : mode === "record" ? (
              <motion.div
                key="record"
                layout
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
                transition={S_PAGE}
                className="app-top-scroll flex h-full flex-col overflow-hidden px-5"
              >
                {/* my-auto, not justify-center: with auto margins the block
                    centres while there is room to spare and falls back to
                    top-aligned when there is not. Centring a flex column whose
                    content overflows clips it at BOTH ends, which would eat the
                    heading on a short screen — and this page cannot scroll to
                    get it back. */}
                <div className="my-auto">
                  {/* A real heading, focused on entry: the morph replaces the
                      whole surface, and without this a screen reader is left on
                      a control that no longer exists and announces nothing. */}
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
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="history"
                layout
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
                transition={S_PAGE}
                className="app-top-scroll flex h-full flex-col overflow-hidden px-5"
              >
                <div className="pb-5 text-center">
                  <h1
                    ref={historyHeadingRef}
                    tabIndex={-1}
                    className="kicker outline-none"
                  >
                    History
                  </h1>
                  <p className="meta mt-1.5">tap any day to fill it in</p>
                </div>
                <HistoryScreen
                  today={clock.date}
                  version={dataVersion}
                  onPick={setPickedDate}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </motion.div>
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <DaySheet
        date={pickedDate}
        onClose={() => setPickedDate(null)}
        onSaved={() => setDataVersion((v) => v + 1)}
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
