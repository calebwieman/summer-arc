"use client";

import type { ReactNode } from "react";
import { memo } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useClock } from "@/hooks/use-clock";
import { useDeck, COL_COMMIT } from "@/hooks/use-deck";
import { buildDay, type DayBlock, type DayModel } from "@/lib/day";
import { approach, upcomingHeight } from "@/lib/layout";
import { buildHabitSeries } from "@/lib/series";
import { getDailyLog, lastTrainingNote, saveDailyLog } from "@/lib/storage";
import { formatHeaderDate, makeEmptyLog } from "@/lib/today";
import { HABITS_CHANGED, getHabits, type HabitDef } from "@/lib/habits";
import { ROUTINE_CHANGED } from "@/lib/schedule";
import { habitTally } from "@/lib/day";
import { formatClock, formatDuration, formatTime, formatWatch } from "@/lib/clock";
import { tomorrowLine, trainingLine } from "@/lib/week";
import { haptic } from "@/lib/haptics";
import { IMPACT, NOTCH, ROW, SEAT, SURFACE, TICK } from "@/lib/motion";
import type { DailyLog, HabitKey } from "@/lib/types";
import { FourteenDay } from "@/components/review/fourteen-day";
import { WeekLoad } from "@/components/review/week-load";
import { TrendsSheet } from "@/components/review/trends-sheet";
import { HistoryScreen } from "@/components/history/history-screen";
import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { SessionsScreen } from "@/components/sessions/sessions-screen";
import { SessionThread } from "@/components/sessions/session-thread";
import { GymScreen } from "@/components/gym/gym-screen";
import { HabitsScreen } from "@/components/settings/habits-screen";
import { SystemScreen } from "@/components/settings/system-screen";
import { DaySheet } from "@/components/history/day-sheet";
import { FloatingHabitSheet } from "./floating-habit-sheet";
import { WeekStrip, buildWeek, type WeekDay } from "./week-strip";
import { Settings2 } from "lucide-react";
import { HabitGlyph } from "./habit-glyph";
import { Latch } from "./latch";
import { MinutesField, NoteField, ShippedField } from "./fields";

/*
  How far the finger travels before a pull commits.

  96 with an elastic of 0.14 meant the surface moved about thirteen visible
  pixels before changing screen — the gesture was 87% invisible. 72 against an
  elastic of 0.22 is sixteen pixels of literal travel, still taut, but it is
  now paired with the outgoing surface scaling and dimming under the finger and
  the destination naming itself, so what you see tracks what you are doing.
*/
const PULL_COMMIT = 72;


/**
 * The surfaces, ordered by depth. Pulling down goes deeper, pulling up comes
 * back — the app stays one screen and gains surfaces by gesture rather than by
 * routes. Each end of the stack is its own neighbour, which is what makes the
 * top and bottom feel like ends.
 */
const GRID = [
  // The gym sits directly beside the day, not two moves away on the record
  // row: it is used every morning, and a surface used daily earns a slot on
  // the row the thumb already lives on. Lesson paid for in the field — its
  // first address was record→right, and the button that jumped there got
  // more use than the swipe ever did.
  ["calendar", "day", "gym", "habits", "system"],
  ["sessions", "record"],
  ["history"],
] as const;

type Page = (typeof GRID)[number][number];

/** Where each row sits when you arrive on it from above or below. */
const HOME = [1, 1, 0];

function clamp(n: number, hi: number) {
  return Math.min(hi, Math.max(0, n));
}

function pageAt(row: number, col: number): Page {
  const r = GRID[clamp(row, GRID.length - 1)];
  return r[clamp(col, r.length - 1)];
}
/** Snapping the surface back to rest when a pull is released short. */
const S_SNAP = { type: "spring", stiffness: 700, damping: 44, mass: 0.8 } as const;

/**
 * How one surface replaces another.
 *
 * It used to be a cross-fade of two full-screen text layers: at the midpoint
 * the entire day — past rail, focus card, register — sat legibly at about 40%
 * opacity *over* the record's fourteen rows of monospace. Two dense text
 * layers superimposed. It read as a dissolve rather than as a move, and it is
 * exactly the class of treatment that has been rejected twice on legibility.
 *
 * Now they stack. The surface you are leaving recedes and lifts — the same
 * pose the pull has already been previewing under your finger for the last
 * quarter second — and the one arriving rises into its place. The outgoing
 * layer's opacity keyframe finishes at 45% of the transition, so it is already
 * at half strength before the incoming one is legible. That is the mechanical
 * answer to the legibility objection rather than a promise about taste.
 */
interface Move {
  axis: "x" | "y";
  dir: number;
}

const SURF = {
  enter: (m: Move) =>
    m.axis === "x"
      ? { x: m.dir >= 0 ? "24%" : "-24%", y: 0, opacity: 0, scale: 1 }
      : { y: m.dir >= 0 ? "16%" : "-16%", x: 0, opacity: 0, scale: 1 },
  here: {
    x: 0,
    y: 0,
    opacity: 1,
    scale: 1,
    // Late and quick. The surface is already sliding into place before it
    // starts becoming legible, so the movement is what you read first.
    transition: { ...SURFACE, opacity: { duration: 0.26, delay: 0.1 } },
  },
  gone: (m: Move) => ({
    scale: m.axis === "x" ? 0.96 : m.dir >= 0 ? 0.94 : 1.015,
    x: m.axis === "x" ? (m.dir >= 0 ? -20 : 20) : 0,
    y: m.axis === "x" ? 0 : m.dir >= 0 ? -14 : 14,
    opacity: 0,
    // Early and quicker. These surfaces have no background of their own, so
    // an outgoing layer held at half strength is not "behind" the incoming
    // one — it shows straight through it. Measured: holding it at 0.5 left
    // both layers above 0.61 for a stretch of the transition, which is the
    // superimposed-text problem again with extra steps. It leaves properly
    // now, and the two fades barely overlap.
    transition: { ...SURFACE, opacity: { duration: 0.16, ease: "easeIn" } },
  }),
};

/** One line under each surface's name, saying what it is for. */
const SUBTITLES: Record<Page, string> = {
  day: "",
  record: "last 14 days · never miss twice",
  history: "tap any day to fill it in",
  calendar: "tap any day to fill it in",
  habits: "what the letters stand for",
  system: "how it looks, and how it survives",
  sessions: "training, session by session",
  gym: "every set, written down at the rack",
};

/** What each surface calls itself, used wherever a gesture names its target. */
const TITLES: Record<Page, string> = {
  day: "Today",
  record: "The record",
  history: "History",
  calendar: "Calendar",
  habits: "The register",
  system: "System",
  sessions: "Sessions",
  gym: "The gym",
};


/**
 * Bands arrive top-down; the live block leads so the eye lands there first.
 *
 * Once per session, though. Swiping up from the record used to replay the
 * whole 300ms staggered curtain-raise, so coming back to today was an
 * introduction rather than an arrival — and the surface transition it plays
 * over is now doing that job properly on its own.
 */
function rise(order: number, reduced: boolean | null, first = true) {
  if (!first) return { initial: false as const };
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
 * WHEEL_PULL is the foreshortening ceiling. Rows sit in normal flow at even
 * spacing, but a cylinder's rows crowd together as they turn away, so each one
 * is drawn back toward the seat by a little more than the last. Without it the
 * tilt opens a gap under every row and the stack reads as slats, not a
 * surface. It approaches the ceiling rather than hitting it — see `pose`.
 */
/*
  Flattened, on the report that scrubbing the register felt bad.

  The drum was 58 degrees deep with 12 degrees of tip per row. Scrubbing moves
  every row at once, so at that depth a single notch swung fifteen rows through
  a large arc, each re-rasterising its own blur — the column heaved rather than
  advanced. The curve is still there, it just reads as a gentle bow now instead
  of a barrel, and one notch moves the eye about a third as far.
*/
const WHEEL_STEP = 5;
const WHEEL_MAX = 24;
const WHEEL_PULL = 18;
/** How fast the foreshortening approaches its ceiling. Larger = later. */
const WHEEL_DECAY = 6.6;



/** Which side of the seat a row is on: -1 above (past), +1 below (ahead). */
type Side = 1 | -1;

/** Where a row `d` places from the seat rests on the curve. */
function pose(d: number, side: Side, reduced: boolean | null, live = false) {
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
  /*
    Foreshortening, as an asymptote rather than a clamped parabola.

    It used to be `min(44, d²)`, which reaches its ceiling at d = 7 — so every
    row from the seventh outward sat at exactly the same offset. The far rim
    had no gradient at all, which is precisely why it read as a wall pinned to
    the top of the rail instead of as a surface curving away. This never
    saturates: the steps get smaller and smaller but they never reach zero.

    A gaussian rather than a plain exponential, because the *shape* near the
    seat matters more than the shape at the rim. An exponential starts steep —
    ten pixels at d = 1, nineteen at d = 2 — which closed the gaps between the
    rows nearest the card and collided the upcoming rail outright, since those
    rows size themselves by how close they are and can be short. This tracks
    the old d² almost exactly for the first three rows (1.0, 3.9, 8.2 against
    1, 4, 9) and only then bends over.
  */
  const pull = WHEEL_PULL * (1 - Math.exp(-((d / WHEEL_DECAY) ** 2)));
  return {
    // Away from you on both sides: the top of a past row leans back, the
    // bottom of an upcoming one does.
    rotateX: -side * tip,
    y: -side * pull,
    scale: Math.max(0.93, 1 - d * 0.006),
    opacity: Math.max(0.55, 1 - d * 0.038),
    /*
      The rim goes soft. Chosen deliberately over a flatter, more legible
      curve — the far end of the day is context, and the seat is the work.

      Not while a gesture is running, though. Every blurred row is its own
      raster on Safari, and re-rasterising fifteen of them per frame under a
      surface that is also being scaled is the one thing here that would drop
      frames. It comes back the moment the finger leaves, and nobody has ever
      studied the far rim mid-swipe.
    */
    filter:
      live || d < 4
        ? "blur(0px)"
        : `blur(${Math.min(0.9, (d - 3) * 0.2).toFixed(2)}px)`,
  };
}

/**
 * Rows join and leave the wheel through the seat, because that is the truth.
 *
 * It starts part-lit rather than at nothing. A block crossing the seat leaves
 * one subtree and mounts in another, so structurally it *is* a death and a
 * birth — but it should read as the same row continuing round the drum. From
 * opacity 0 with a stagger behind it, a fast scrub never let any row reach
 * full strength and the whole column went to smear for the length of the
 * gesture. From 0.35 and fourteen pixels out, the same crossing reads as a
 * re-settle.
 */
function atSeat(side: Side, reduced: boolean | null) {
  if (reduced) return { opacity: 0 };
  return {
    opacity: 0.35,
    y: -side * 14,
    // Flatter than its resting pose: it has just come over the top.
    rotateX: side * 12,
    scale: 0.97,
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
  live,
  children,
  ref,
}: {
  d: number;
  side: Side;
  reduced: boolean | null;
  /** A gesture is in progress — the wheel is being turned right now. */
  live: boolean;
  children: ReactNode;
  /*
    AnimatePresence's popLayout mode works by cloning the child with a ref and
    setting `position: absolute` on the node it gets back. A function component
    that swallows the ref hands it nothing, so the mode silently does nothing at
    all — exiting rows stay in normal flow for the length of their exit and
    shove everything below them. Measured before this: `[data-motion-pop-id]`
    peaked at zero across an entire scrub, and one sweep grew the seat's slot
    from 121px to 1626px. React 19 passes `ref` as an ordinary prop, so
    accepting it here is the whole fix.
  */
  ref?: React.Ref<HTMLDivElement>;
}) {
  /*
    Nearest the seat leads, so one deliberate turn resolves outward instead of
    arriving all at once. Under a continuous scrub the same stagger is pure
    latency — five glyphs in half a second never let a row finish arriving
    before the next turn restarted it — so it is dropped while a gesture is
    live and restored the moment the finger leaves.
  */
  const delay = live ? 0 : Math.min(0.14, (d - 1) * 0.022);
  /*
    A spring while the wheel settles, a short tween while it is being turned.

    A spring runs until it has settled — about four hundred milliseconds here —
    and a scrub delivers a notch every hundred. Five notches × fourteen rows ×
    four animated properties left several hundred springs alive at once, all
    being re-targeted before any of them finished. The tween is done in a
    hundred and twenty milliseconds, so at most one generation is ever running,
    and nobody can see the difference in a gesture that is itself moving.
  */
  const move = live
    ? ({ duration: 0.12, ease: "easeOut" } as const)
    : ({ ...ROW, delay } as const);
  return (
    <motion.div
      ref={ref}
      /*
        Layout animation is off while a gesture is running. Motion re-measures
        the projection tree whenever a layout animation starts, and with a row
        per block that is a full pass over the column on every notch — measured
        at 456–484 `getBoundingClientRect` calls per notch. Between gestures it
        is worth it, because that is when a single change should glide. During
        one it is the single most expensive thing on the critical path, and the
        pose animation is already carrying the movement.
      */
      layout={!live}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // No blur on the way out. It bought nothing at this size, and a filter
      // establishes its own compositing layer — which the rail's mask does not
      // clip, so blurred rows escaped the fade and painted over the week strip.
      exit={{ opacity: 0 }}
      transition={move}
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
        animate={pose(d, side, reduced, live)}
        transition={move}
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
const SEAT_POSE = {
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

/**
 * A wall-clock time, with the meridiem set back.
 *
 * The letter is a qualifier, not data — you read "4:45" and already know which
 * one it is from where you are in the day. Holding it at the same weight as
 * the digits made the rail noisier than the 24-hour version it replaced, which
 * defeated the point. Opacity rather than a colour token, so it stays correct
 * against whatever ink the caller is using.
 */
function Time({
  at,
  label,
  className,
}: {
  /** "HH:mm", the schedule's own format. */
  at?: string;
  /** Already formatted, for the live watch. */
  label?: string;
  className?: string;
}) {
  const t = label ?? formatTime(at ?? "00:00");
  return (
    <span className={className}>
      {t.slice(0, -1)}
      <span className="opacity-60">{t.slice(-1)}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- masthead */

/**
 * The live clock, and the only thing in the app that ticks once a second.
 *
 * Its own component with its own state, so that tick re-renders eleven
 * characters rather than the entire day tree. It used to live in `DayScreen`,
 * which meant a full render — `buildDay`, fourteen wheel rows, the register —
 * every second, including in the middle of a scrub.
 */
function Watch({ pinnedAt }: { pinnedAt: string | null }) {
  const [now, setNow] = useState(pinnedAt ?? "");
  useEffect(() => {
    if (pinnedAt != null) {
      setNow(pinnedAt);
      return;
    }
    const tick = () => setNow(formatWatch(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [pinnedAt]);
  return <Time label={now} className="mono-sm tabular-nums text-ink-2" />;
}

function Masthead({
  day,
  pinnedAt,
  tally,
  minutes,
  reduced,
}: {
  day: DayModel;
  /** A fixed time string when the clock is pinned for preview, else null. */
  pinnedAt: string | null;
  tally: { done: number; total: number };
  minutes: number;
  reduced: boolean | null;
}) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pt-1 pb-3">
      <div className="min-w-0">
        <p className="kicker truncate">{formatHeaderDate(day.date)}</p>
        {/* Where the day actually stands, at a glance, without a trip anywhere. */}
        <p className="mono-xs mt-1.5 text-ink-3">
          {/* Keyed, so the count arrives rather than being swapped. The app
              had two number readouts behaving two different ways — the minutes
              field dropped its new value in and this one changed silently. */}
          <span className="text-ink-2">
            <motion.span
              key={tally.done}
              initial={reduced ? false : { y: -5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={TICK}
              className="inline-block tabular-nums"
            >
              {tally.done}
            </motion.span>
            /{tally.total}
          </span>
          {minutes > 0 ? ` · ${minutes}m deep` : ""}
          {" · ends "}
          {day.blocks.length ? (
            <Time at={day.blocks[day.blocks.length - 1].block.end} />
          ) : (
            "—"
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {/* The seconds are the proof of life — the now-rail moves too slowly to read. */}
        <Watch pinnedAt={pinnedAt} />
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- past */

function PastLine({ b }: { b: DayBlock }) {
  return (
    <div className="flex items-baseline gap-2.5 py-[3px]">
      <Time
        at={b.block.start}
        className="mono-sm w-[52px] shrink-0 text-right tabular-nums text-ink-3"
      />
      <span className="mono-xs truncate text-ink-3">{b.block.label}</span>
    </div>
  );
}

function PastInner({
  blocks,
  reduced,
  live,
}: {
  blocks: DayBlock[];
  reduced: boolean | null;
  live: boolean;
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
    <motion.div layout="position" className="relative px-5">
      <AnimatePresence mode="popLayout">
        {blocks.map((b, i) => (
          <WheelRow key={b.index} d={n - i} side={-1} reduced={reduced} live={live}>
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
function StaleInner({
  blocks,
  reduced,
  live,
}: {
  blocks: DayBlock[];
  reduced: boolean | null;
  live: boolean;
}) {
  if (blocks.length === 0) return null;
  return (
    <motion.div layout="position" className="relative px-5">
      <AnimatePresence mode="popLayout">
        {blocks.map((b, i) => (
          <WheelRow key={b.index} d={i + 1} side={1} reduced={reduced} live={live}>
            <PastLine b={b} />
          </WheelRow>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Memoised. A scrub re-renders `DayScreen` on every notch, and without this
 * each of those renders walked all three rails and the register again even
 * when nothing they draw had changed.
 */
const Past = memo(PastInner);

/* ---------------------------------------------------------------- upcoming */

/** Dead air worth naming. Below this it is just walking time. */
const OPEN_MIN = 12;

function OpenGap({ minutes }: { minutes: number }) {
  return (
    <div className="mt-1.5 flex items-center gap-2.5">
      <span className="w-[52px] shrink-0" />
      <span className="h-px w-3 bg-line-mid" />
      {/* The most useful line on the screen between two classes. */}
      <span className="mono-xs text-ink-3">{formatDuration(minutes)} open</span>
    </div>
  );
}

function UpcomingInner({
  blocks,
  prevEndMin,
  reduced,
  live,
  dOffset = 0,
}: {
  blocks: DayBlock[];
  /** End of whatever precedes this list, so the first gap is measurable. */
  prevEndMin: number | null;
  reduced: boolean | null;
  live: boolean;
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
    <motion.div layout="position" className="relative px-5">
      <div className="h-px w-6 bg-line-mid" />
      <AnimatePresence mode="popLayout">
      <WheelRow key={next.index} d={dOffset + 1} side={1} reduced={reduced} live={live}>
        {leadGap >= OPEN_MIN ? <OpenGap minutes={leadGap} /> : null}
        <motion.div
          layout
          transition={ROW}
          className="flex items-center gap-2.5"
          style={{ height: upcomingHeight(next.untilStart) * 0.52 }}
        >
          <Time
            at={next.block.start}
            className="mono-sm w-[52px] shrink-0 text-right tabular-nums text-ink-3"
          />
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
          <WheelRow key={b.index} d={dOffset + i + 2} side={1} reduced={reduced} live={live}>
            {gap >= OPEN_MIN ? <OpenGap minutes={gap} /> : null}
            <motion.div
              layout
              transition={ROW}
              className="flex items-center gap-2.5"
              style={{ height: upcomingHeight(b.untilStart) * 0.42 }}
            >
              <Time
                at={b.block.start}
                className="mono-sm w-[52px] shrink-0 text-right tabular-nums text-ink-3"
              />
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
        <WheelRow key="rim" d={dOffset + soon.length + 2} side={1} reduced={reduced} live={live}>
          <p className="mono-xs mt-2 truncate text-ink-4">
            {after.map((b) => b.block.label).join(" · ")}
          </p>
        </WheelRow>
      ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

const Stale = memo(StaleInner);
const Upcoming = memo(UpcomingInner);

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

function RegisterInner({
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
  const { blockOf, endedOf, floating } = useMemo(() => {
    const b = new Map<HabitKey, number>();
    const e = new Map<HabitKey, boolean>();
    for (const blk of day.blocks) {
      for (const id of blk.habits) {
        b.set(id, blk.index);
        e.set(id, blk.phase === "past");
      }
    }
    return { blockOf: b, endedOf: e, floating: new Set(day.floating) };
  }, [day]);
  const reduced = useReducedMotion();
  /*
    Where the wheel is parked. One marker, not a flag per glyph — two habits
    can share a block, and two elements sharing a layoutId is how you get
    Motion animating a marker to a place it is also leaving.
  */
  const seatedId = habits.find((h) => blockOf.get(h.id) === focusIndex)?.id;

  /*
    The marker answers the tap before the wheel does.

    During a spin the seat passes through blocks that own no habit — Lunch,
    Breakfast — so a marker driven purely by the seated block blinks out for
    the whole flight and pops in at the end. On a tap it glides straight to the
    tapped icon instead, on the same layout spring, and the wheel arrives
    underneath it; once the seat catches up the optimistic state dissolves
    without a pixel moving. The timeout is the escape hatch for a spin that
    never lands where the tap said (the user grabbed the wheel mid-flight).
  */
  const [pending, setPending] = useState<HabitKey | null>(null);
  useEffect(() => {
    if (!pending) return;
    if (seatedId === pending) {
      setPending(null);
      return;
    }
    const t = window.setTimeout(() => setPending(null), 900);
    return () => window.clearTimeout(t);
  }, [pending, seatedId]);
  const markerId = pending ?? seatedId;

  /*
    Taps, not a scrub.

    The slide picked whatever the finger crossed, which was fine for anchored
    letters and wrong for floating ones, and it forced this row to own
    horizontal touch outright — the surface gesture was dead across the whole
    bottom of the screen. Six spread-out 44px icons do the same job without
    owning anything, and the wheel spinning to the tapped block carries the
    continuity the slide used to fake.
  */
  return (
    <div className="flex w-full items-center justify-between px-7">
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
            // aria-disabled, not disabled: the glyph still reads and still
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
              if (!scheduled) return;
              haptic(6);
              if (idx != null) {
                setPending(k);
                onRecall(idx);
              } else {
                onFloating(k);
              }
            }}
            className="relative flex min-h-11 min-w-11 items-center justify-center"
          >
            {markerId === k ? (
              <motion.span
                layoutId={reduced ? undefined : "register-seat"}
                initial={reduced ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                aria-hidden
                className="absolute inset-x-0 inset-y-[4px] rounded-sm border border-line-mid bg-surface-2"
                transition={NOTCH}
              />
            ) : null}
            <HabitGlyph
              habit={k}
              code={h.code}
              icon={h.icon}
              seated={seatedId === k}
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
  );
}

const Register = memo(RegisterInner);

/**
 * The seat, while the wheel is being turned.
 *
 * A block's real card is whatever its content needs it to be: 103 pixels for a
 * class, 233 for one that carries a latch and a session note. That is fine when
 * it changes once. It is not fine five times in half a second — measured, the
 * card's height jumped 126px between notches and its top edge moved 273px in a
 * single frame, which shoved the entire column and is exactly the "random pops"
 * this exists to remove.
 *
 * So while a scrub is running the seat is this instead: the same chrome, the
 * same roll, one fixed height, and about six DOM nodes against the real card's
 * sixty. It also does not mount a latch, does not build the field set, and does
 * not call `lastTrainingNote` — which walks every log in storage and parses it.
 *
 * The finger lifts and this hands over to the real card, which is the one
 * moment in the gesture where the column is allowed to resize. That hand-off is
 * the expansion: you scrub through compact cards and the one you stop on opens.
 */
const PREVIEW_H = 132;

function SeatPreview({
  b,
  dir,
  reduced,
  ref,
}: {
  b: DayBlock;
  dir: number;
  reduced: boolean | null;
  ref?: React.Ref<HTMLElement>;
}) {
  return (
    <motion.section
      ref={ref}
      aria-hidden
      variants={SEAT_POSE}
      custom={dir}
      initial="enter"
      animate="seat"
      exit="leave"
      transition={SEAT}
      style={{
        height: PREVIEW_H,
        ...(reduced ? {} : { transformPerspective: 1100 }),
      }}
      className="relative mx-5 shrink-0 overflow-hidden rounded-lg border border-line-soft bg-surface py-5 pr-4 pl-9"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-5 left-4 w-px bg-line-mid"
      />
      {/*
        The shell is one element for the whole gesture and only its contents
        change. Keying the shell per block looked identical and was the bug:
        five notches in half a second each mounted a card and started a 340ms
        exit, so by the end of a scrub six of them were on screen at once,
        animating. The block name is two nodes, it replaces itself with no exit
        animation at all, and there is nothing left to pile up.
      */}
      <motion.div
        key={b.index}
        initial={reduced ? false : { y: dir >= 0 ? 22 : -22, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={ROW}
      >
        <span className="mono-sm tabular-nums text-ink-3">
          <Time at={b.block.start} /> — <Time at={b.block.end} />
        </span>
        <h1 className="mt-2.5 truncate text-[32px] font-light leading-[1.02] tracking-[-0.03em] text-ink">
          {b.block.label}
        </h1>
      </motion.div>
    </motion.section>
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
  ref,
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
  /** Forwarded so AnimatePresence's popLayout can take it out of flow. */
  ref?: React.Ref<HTMLElement>;
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
      ref={ref}
      /*
        No `layout` here any more. The seat animates on a variant that moves it
        in y and turns it in x, and layout animation drives the very same
        matrix — the two would take turns writing it and the card would judder
        on every detent. Popping out of flow is enough: the next card takes the
        seat the instant this one is released.
      */
      variants={SEAT_POSE}
      custom={dir}
      initial="enter"
      animate="seat"
      exit="leave"
      transition={SEAT}
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
            <Time at={b.block.start} /> — <Time at={b.block.end} />
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

        {/*
          Where this session sits in the week, and how much of the week's
          minutes are already in the bank. Nothing else in the app shows
          training VOLUME — the week strip, the seismograph, the month grid and
          the year trace are all completion, and completion counts a fifteen
          minute shakeout and a two hour long run as the same event.
        */}
        {b.block.kind === "training" ? (
          <p className="mono-xs mt-1 text-ink-4">{trainingLine(day.date)}</p>
        ) : null}

        {/*
          And on the last block of the day, what tomorrow asks for. Its whole
          job is the one thing a read-only week is for: knowing at 21:40 what
          the morning is, in time to set the alarm and put the kit by the door.
          Dropped on a short screen — this card is already the tightest thing in
          the app on Sunday, when Wind Down inherits the closing note AND the
          shipped field from a day with no Content block.
        */}
        {b.block.label === "Wind Down" ? (
          <p className="drop-when-short mono-xs mt-1 text-ink-4">
            {tomorrowLine(day.date)}
          </p>
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
            <div className="space-y-4">
              {/* The numbers live in the R sheet — this card is the session
                  you are in, not the ledger. */}
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
            <p className="mono-xs text-ink-3">
              opens <Time at={b.block.start} />
            </p>
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


/**
 * Every surface except the day.
 *
 * They all want the same three things — the status-band clearance, a real
 * heading that takes focus when the surface arrives, and the entrance the grid
 * gives them — so they share one shell rather than repeating it. The day is not
 * one of these because it owns its own masthead.
 */
function Surface({
  page,
  move,
  reduced,
  headingRef,
  children,
}: {
  page: Page;
  move: Move;
  reduced: boolean | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <motion.div
      custom={move}
      variants={SURF}
      initial={reduced ? { opacity: 0 } : "enter"}
      animate={reduced ? { opacity: 1 } : "here"}
      exit={reduced ? { opacity: 0 } : "gone"}
      transition={SURFACE}
      className="app-top-scroll absolute inset-0 flex flex-col overflow-hidden px-5"
    >
      <div className="shrink-0 pb-5 text-center">
        <h1 ref={headingRef} tabIndex={-1} className="kicker outline-none">
          {TITLES[page]}
        </h1>
        <p className="meta mt-1.5">{SUBTITLES[page]}</p>
        {/* The map, drawn: one dot per surface, laid out exactly as the grid
            is. Where you are is ink; everywhere you could swipe is line. The
            gesture nav stays invisible on the day, but a surface two moves
            from home earns a you-are-here. */}
        <div className="mt-2 flex flex-col items-center gap-1" aria-hidden>
          {GRID.map((r, ri) => (
            <div key={ri} className="flex gap-1.5">
              {r.map((p) => (
                <span
                  key={p}
                  className={`h-1 w-1 rounded-pill ${
                    p === page ? "bg-ink" : "bg-line-mid"
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {children}
    </motion.div>
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
  /*
    Where you are on the grid.

    Rows are the surfaces you already had — today, the record, history — and
    columns are what each of them opens sideways onto. One rule holds the whole
    map together and is worth stating before the code: **up and down change the
    instrument and always come home; right is the longer view of this row; left
    only exists on the day, and goes into the machine behind it.**

    `col` is an absolute index into the row, not an offset, so clamping is the
    only edge logic there is.
  */
  const [row, setRow] = useState(0);
  const [col, setCol] = useState(HOME[0]);
  /** How the last move went, so the arriving surface knows where to come from. */
  const [move, setMove] = useState<Move>({ axis: "y", dir: 1 });
  /** A past day opened for backfill from the history surface. */
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  /** Bumped after any write so history recounts without a full reload. */
  const [dataVersion, setDataVersion] = useState(0);
  /** A session type whose whole note history is open. */
  const [thread, setThread] = useState<string | null>(null);
  const [trendsOpen, setTrendsOpen] = useState(false);
  /** A floating habit being committed in its own sheet. */
  const [floatingId, setFloatingId] = useState<HabitKey | null>(null);
  /** A recalled block index, or null when following the live day. */
  const [selected, setSelected] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const page = pageAt(row, col);
  const lastCol = GRID[row].length - 1;
  const rowBelow = clamp(row + 1, GRID.length - 1);
  const rowAbove = clamp(row - 1, GRID.length - 1);
  const colRight = clamp(col + 1, lastCol);
  const colLeft = clamp(col - 1, lastCol);

  /*
    A vertical move always lands on its row's home column.

    That is the invariant that makes the map holdable: there is no diagonal,
    there is no per-row memory of where you were, and you are never more than
    one gesture away from a live instrument. It costs one line here and one in
    the key handler.
  */
  /*
    One step of memory, and only one, so that a vertical gesture is its own
    inverse.

    HOME-snapping alone made the undo gesture not the undo. The rows are 4, 2
    and 1 columns wide, so from `system` [0,3] a swipe down clamps to row 1 and
    HOME-snaps to `record`; swiping straight back up HOME-snaps row 0 to `day`.
    A gesture and its exact mirror left you two surfaces from where you started,
    and no amount of practice fixes that because the rule itself is the problem.
    Same for `sessions` -> down -> `history` -> up -> `record`.

    Full per-row memory would fix it but breaks the invariant the HOME snap was
    protecting: that a row always opens at a known column, so the map stays
    holdable. So this remembers exactly the row it just left. Return to it as
    the very next row change and you land where you were; arrive from anywhere
    else and you get HOME, unchanged.
  */
  const leftFrom = useRef<{ row: number; col: number } | null>(null);

  const goRow = useCallback(
    (next: number) => {
      const r = clamp(next, GRID.length - 1);
      if (r === row) return;
      const back = leftFrom.current;
      leftFrom.current = { row, col };
      setMove({ axis: "y", dir: r > row ? 1 : -1 });
      setRow(r);
      setCol(
        back && back.row === r
          ? clamp(back.col, GRID[r].length - 1)
          : HOME[r],
      );
    },
    [row, col],
  );

  const goCol = useCallback(
    (next: number) => {
      const c = clamp(next, GRID[row].length - 1);
      if (c === col) return;
      setMove({ axis: "x", dir: c > col ? 1 : -1 });
      setCol(c);
    },
    [row, col],
  );

  /*
    Arrow keys walk the same grid. The register used to carry a "pull for
    record" button, which was also the only route through for a keyboard or
    assistive-tech user; removing the visible hint should not remove the
    capability with it — and now that settings is a swipe rather than a button,
    this is the only route to it that does not need a hand.
  */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") goRow(row + 1);
      else if (e.key === "ArrowUp" || e.key === "PageUp") goRow(row - 1);
      else if (e.key === "ArrowRight") goCol(col + 1);
      else if (e.key === "ArrowLeft") goCol(col - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goRow, goCol, row, col]);

  const recoil = useMotionValue(0);
  /*
    The pull.

    This value used to be written on every frame of the app's central gesture
    and read by nothing at all — the surface stack recorded the finger and
    threw it away. Everything below is what it drives now: the surface you are
    leaving falls back and dims, the one you are heading for is named before
    you commit to it, and the whole thing is continuous rather than a threshold
    that fires.

    0.94 is the floor on scale deliberately. The rails are 10px uppercase mono
    and `globals.css` puts the legibility line at about ten pixels, so 9.4px
    for the quarter-second of a gesture is the most this can spend.
  */
  const pull = useMotionValue(0);
  const pullT = useTransform(pull, [-PULL_COMMIT, 0, PULL_COMMIT], [-1, 0, 1], {
    clamp: true,
  });
  const depthScale = useTransform(pullT, [-1, 0, 1], [1.015, 1, 0.94]);
  const depthDim = useTransform(pullT, [-1, 0, 1], [1, 1, 0.55]);
  const depthLift = useTransform(pullT, [-1, 0, 1], [0, 0, -14]);
  /** The destination only names itself once the pull is clearly deliberate. */
  const hintDown = useTransform(pullT, [0.5, 0.85], [0, 1], { clamp: true });
  const hintUp = useTransform(pullT, [-0.85, -0.5], [1, 0], { clamp: true });
  /** Sideways travel under the finger, and the two hints it reveals. */
  const deckX = useMotionValue(0);
  const deckT = useTransform(deckX, [-24, 0, 24], [-1, 0, 1], { clamp: true });
  const hintRight = useTransform(deckT, [0.45, 0.9], [0, 1], { clamp: true });
  const hintLeft = useTransform(deckT, [-0.9, -0.45], [1, 0], { clamp: true });
  /** A text field has focus, so the grid gives horizontal touch back to iOS. */
  const [editing, setEditing] = useState(false);
  /** A gesture is running: the wheel drops its stagger and the rim its blur. */
  const [live, setLive] = useState(false);
  /*
    The register claimed this gesture.

    Both consumers can act on one finger: the register scrubs from pointer
    events while Motion's drag reads the same finger's vertical component off
    window listeners, so a diagonal used to change the block *and* the surface.
    One finger, two outcomes. Motion has no way to cancel a drag in flight, so
    the claim is honoured at the end instead — the surface still resists and
    springs back, it just does not commit.

    Cleared on drag start, which for a gesture beginning on the register fires
    at three pixels, well before the scrub's cone decides at ten.
  */
  const claimed = useRef(false);
  /*
    Distinct from `live`, which is true for any gesture including a vertical
    drag. Only a scrub collapses the seat to its preview — a downward pull is
    not turning the wheel and has no business rebuilding the card underneath
    the finger.
  */
  const [scrubbing, setScrubbing] = useState(false);
  const deck = useDeck({
    x: deckX,
    // The finger goes left to reach the page on the right, so the sign flips.
    hasNeighbour: useCallback(
      (d: -1 | 1) => (d < 0 ? col < lastCol : col > 0),
      [col, lastCol],
    ),
    onCommit: useCallback((d: -1 | 1) => goCol(col - d), [goCol, col]),
    claimed,
    onLive: setLive,
    // A sheet is a detour, not a destination: while one is open the grid holds
    // still. Under reduced motion the whole horizontal axis stays available by
    // keyboard but not by gesture.
    enabled:
      pickedDate == null && floatingId == null && thread == null && !trendsOpen,
  });

  /** The day surface has been shown once; its entrance is spent. */
  const entered = useRef(false);
  useEffect(() => {
    entered.current = true;
  }, []);
  /** The housing's own tip, kicked each time the wheel lands on a new seat. */
  const drum = useMotionValue(0);
  /*
    Anticipation. Before the arriving card flies in, the slot it lands in dips
    five pixels the way the wheel is turning, so the card enters over a surface
    that is already moving with it rather than onto a static shelf. Five
    pixels: any more and it reads as a glitch rather than as a breath.

    It cannot be a variant — the dip belongs to the container, which survives
    the change, while the variants belong to the cards, which do not.
  */
  const seatDip = useMotionValue(0);
  const loadedFor = useRef<string>("");

  useEffect(() => {
    if (!clock.ready || loadedFor.current === clock.date) return;
    loadedFor.current = clock.date;
    setLog(getDailyLog(clock.date) ?? makeEmptyLog(clock.date));
  }, [clock.ready, clock.date]);

  useEffect(() => {
    // The surface change replaces everything on screen; without this a screen
    // reader is left on a control that no longer exists.
    if (page !== "day") headingRef.current?.focus();
  }, [page]);

  // Editing habits or the routine in the settings sheets must redraw the
  // spine underneath them. A fresh habits array is enough for both: the day
  // model is rebuilt whenever it changes, and blocksForDate reads the routine
  // live on that rebuild.
  useEffect(() => {
    const reload = () => {
      setHabits(getHabits());
      setDataVersion((v) => v + 1);
    };
    window.addEventListener(HABITS_CHANGED, reload);
    window.addEventListener(ROUTINE_CHANGED, reload);
    return () => {
      window.removeEventListener(HABITS_CHANGED, reload);
      window.removeEventListener(ROUTINE_CHANGED, reload);
    };
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
    () => (page === "record" ? buildHabitSeries(14, clock.date) : []),
    // Recompute whenever the record is opened or the log changes beneath it.
    [page, log, clock.date, habits],
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

  /*
    Backfill is a visit, not a destination, so the wheel returns to now once a
    habit is thrown — but not instantly.

    Returning inside the write did two things wrong. It was a side effect
    inside a `setLog` updater, which React 19 calls twice under StrictMode and
    may re-invoke under concurrent rendering; and it meant the single most
    important action in the app was rewarded with the whole screen dissolving
    before you could read the timestamp you had just earned. Committing Wake
    from a backfilled block rendered the same block label twice on screen
    150ms later, one arriving in the seat and one blurring out of the rail.

    620ms is the commit spring settling, plus the receipt fading up, plus
    enough dwell to actually read the stamp. Only then does the wheel turn
    back, and it turns back gently — see `restoring`.
  */
  const returnTimer = useRef<number | null>(null);
  /** The next seat change is a return from backfill, not a turn of the wheel. */
  const restoring = useRef(false);
  useEffect(
    () => () => {
      if (returnTimer.current) window.clearTimeout(returnTimer.current);
    },
    [],
  );

  const setHabit = useCallback(
    (k: HabitKey, v: boolean) => {
      setLog((prev) => {
        const base = prev ?? makeEmptyLog(clock.date);
        const stamps = { ...(base.stamps ?? {}) };
        if (v) stamps[k] = Math.floor(clock.nowMin);
        else delete stamps[k];
        const next: DailyLog = {
          ...base,
          habits: { ...base.habits, [k]: v },
          stamps,
        };
        saveDailyLog(next);
        return next;
      });
      setDataVersion((v) => v + 1);
      if (returnTimer.current) window.clearTimeout(returnTimer.current);
      returnTimer.current = window.setTimeout(
        () => {
          // The trip back is the same journey as the trip out: the wheel
          // rolls home through the blocks between, rather than cutting. Under
          // reduced motion spinHome degrades to the straight land inside
          // spinTo itself.
          restoring.current = true;
          spinHome.current();
        },
        reduced ? 200 : 620,
      );
    },
    [clock.date, clock.nowMin, reduced],
  );

  /*
    A saved gym session is a training session: the T letter commits itself,
    and the session's one-line receipt becomes the training note — unless a
    sentence has already been written by hand, because prose beats receipts.
    Routed through `setHabit` so the stamp, the recount and the wheel's
    return-home all behave exactly as if the latch had been thrown.
  */
  const onGymFinished = useCallback(
    (summary: string) => {
      const t = habits.find((h) => h.anchor?.kind === "training" && !h.archived);
      if (t) setHabit(t.id, true);
      setLog((prev) => {
        const base = prev ?? makeEmptyLog(clock.date);
        if (base.trainingNote?.trim()) return base;
        const next = { ...base, trainingNote: summary };
        saveDailyLog(next);
        return next;
      });
      setDataVersion((v) => v + 1);
    },
    [habits, setHabit, clock.date],
  );

  /*
    The sessions page's tap path to the gym — a cross-row jump, so it writes
    the same one-step memory a gesture would: pull down from the gym and you
    land back on the row you left.
  */
  const jumpToGym = useCallback(() => {
    leftFrom.current = { row, col };
    setMove({ axis: "y", dir: -1 });
    setRow(0);
    setCol(2);
  }, [row, col]);

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

  /*
    Spin the wheel to a tapped icon rather than teleporting.

    Every intermediate block takes the seat for a beat on an ease-in schedule —
    the early notches land almost together, the late ones spread out — which on
    screen is a fast flick that decelerates into the target, a rolodex settling
    rather than a cut. The live flag is raised for the duration so the seat
    keeps its fixed shell and the rim drops its blur; without it every notch
    would re-rasterise a column of blurred rows.
  */
  const spinTimers = useRef<number[]>([]);
  /** Always the current-day way home; refs because setHabit closes early. */
  const spinHome = useRef<() => void>(() => {});
  const clearSpin = useCallback(() => {
    if (spinTimers.current.length === 0) return;
    for (const t of spinTimers.current) window.clearTimeout(t);
    spinTimers.current = [];
    /*
      A cancelled flight must lower its own flags. The final timer was the only
      other writer of scrubbing, so cancelling it — tap the same icon twice,
      tap the block the wheel is passing, grab the surface mid-spin — left the
      seat as its inert preview shell permanently: no latch, no fields, and
      nothing else ever set it back.
    */
    setLive(false);
    setScrubbing(false);
  }, []);
  useEffect(() => clearSpin, [clearSpin]);
  const spinTo = useCallback(
    (target: number) => {
      clearSpin();
      if (target === focusIndex || !day.blocks[target]) return;
      // Landing on the live block is a return, not a recall.
      const land = (idx: number) =>
        setSelected(idx === day.focusIndex ? null : idx);
      const dir = target > focusIndex ? 1 : -1;
      const steps: number[] = [];
      for (let i = focusIndex + dir; i !== target; i += dir) steps.push(i);
      steps.push(target);
      if (reduced || steps.length === 1) {
        land(target);
        return;
      }
      setLive(true);
      setScrubbing(true);
      /*
        Tuned on the phone: 620ms with a 2.4 exponent spent a third of every
        flight easing into the last notch, which read as lag the moment taps
        came quickly — each new tap restarts from wherever the wheel is, so a
        heavy tail keeps it perpetually behind the finger. Shorter, flatter,
        still decelerating.
      */
      const total = Math.min(420, 160 + 40 * steps.length);
      steps.forEach((idx, i) => {
        const at = total * Math.pow((i + 1) / steps.length, 1.8);
        const id = window.setTimeout(() => {
          haptic(3);
          land(idx);
          if (i === steps.length - 1) {
            spinTimers.current = [];
            setLive(false);
            setScrubbing(false);
          }
        }, at);
        spinTimers.current.push(id);
      });
    },
    [focusIndex, day, reduced, clearSpin],
  );
  spinHome.current = () => spinTo(day.focusIndex);
  const showFocus =
    focus &&
    (recalled || !(day.state === "after" && day.graceIndex < 0)) &&
    page === "day";
  // No live block and nothing held: we are in real dead air, and the gap needs
  // its own now-indicator because the focus block has not started yet.
  const inDeadAir =
    !recalled &&
    day.currentIndex < 0 &&
    day.graceIndex < 0 &&
    !!focus &&
    focus.phase === "upcoming";
  /*
    Every turn of the wheel tips the whole housing against the direction of
    travel and lets it fall back past centre before it settles. It is what
    stops a scrub from reading as a list swapping its contents: the column has
    mass, and you just moved it.

    The first version was a one-way ease from −4.5° to 0 over 620ms, which is
    no anticipation, no follow-through and — at perspective 1400 on a 500px
    column — about two pixels of apparent movement spread over two thirds of a
    second. Invisible, and competing with a seat swap and fourteen re-poses for
    attention. Now it peaks in 80ms, swings past zero, and is done in 440ms.

    Returning to now after a commit is a restoration, not a turn, so it gets
    seven tenths of the amplitude — present, but not a second event.
  */
  const lastSeat = useRef(focusIndex);
  /*
    Direction is derived during render, not stored in state.

    It used to be `setDir(d)` inside the seat-change effect — a second React
    state update chasing the `setSelected` that caused it, so every notch of a
    scrub re-rendered the whole tree twice instead of once. Nothing needs a
    render to see this: it is read at render time by the variants, and by the
    time the effect runs the value is already correct.
  */
  const dirRef = useRef(1);
  if (focusIndex !== lastSeat.current) {
    dirRef.current = focusIndex > lastSeat.current ? 1 : -1;
  }
  const dir = dirRef.current;

  useEffect(() => {
    if (focusIndex === lastSeat.current) return;
    const d = focusIndex > lastSeat.current ? 1 : -1;
    const gain = restoring.current ? 0.7 : 1;
    restoring.current = false;
    lastSeat.current = focusIndex;
    if (reduced) return;
    /*
      Both of these start from wherever they currently are, not from zero.

      Written as `[0, …]` the first keyframe is a hard assignment, so a notch
      landing while the previous kick was still swinging teleported the whole
      housing back to centre for one frame. Measured across a single sweep:
      thirty-seven single-frame discontinuities, up to 5.26° of rotation and
      8.18px of travel. That is a pop, and it was the drum's own doing.

      Keyframes must still run as a tween — see fireRecoil for why a spring
      across them plays nothing at all.
    */
    animate(drum, [drum.get(), -d * 3.2 * gain, d * 0.9 * gain, 0], {
      duration: 0.44,
      times: [0, 0.18, 0.52, 1],
      ease: IMPACT,
    });
    animate(seatDip, [seatDip.get(), d * 5 * gain, 0], {
      duration: 0.5,
      times: [0, 0.16, 1],
      ease: IMPACT,
    });
  }, [focusIndex, drum, seatDip, reduced]);

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
  // Memoised, so that a render caused by something else — the tally changing,
  // a gesture flag flipping — hands the rails the same arrays it did last time
  // and they can skip re-rendering entirely.
  const { above, stale, ahead, beforeAhead } = useMemo(() => {
    const a = day.blocks.filter((b) => b.index < focusIndex);
    const below = day.blocks.filter((b) => b.index > focusIndex);
    // Phases run in order, so below is a run of finished blocks followed by a
    // run of ones still to come.
    const st = below.filter((b) => b.phase === "past");
    const ah = below.filter((b) => b.phase !== "past");
    const f = day.blocks[focusIndex];
    return {
      above: a,
      stale: st,
      ahead: ah,
      // The first gap ahead is measured from whatever actually precedes it on
      // the wheel — otherwise recalling Wake reports sixteen hours open before
      // bed.
      beforeAhead:
        st.length > 0 ? st[st.length - 1].endMin : (f?.endMin ?? null),
    };
  }, [day, focusIndex]);

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
          Taut, but no longer mute. 0.45 let the whole surface wallow half a
          screen before committing, which is what made the pages feel loose;
          0.14 was the correction and overshot, leaving thirteen visible pixels
          for a gesture the whole app is built around. 0.22 against the shorter
          PULL_COMMIT keeps the same tautness and gives the finger something to
          be attached to, because the surface now scales, dims and names its
          destination as it goes.

          The ends of the stack stay nearly rigid — 0.06, still 3.7× stiffer
          than a live edge, so "there is nothing below this" is felt in the
          hand. It is paired with an end-stop rule that flashes at the edge,
          because resistance alone reads as a frozen app.
        */
        dragElastic={{
          top: rowAbove === row ? 0.06 : 0.22,
          bottom: rowBelow === row ? 0.06 : 0.22,
        }}
        dragMomentum={false}
        onDragStart={() => {
          // A spin still in flight would keep ticking under the drag and drop
          // the live flag mid-gesture when its last step fired.
          clearSpin();
          claimed.current = false;
          setLive(true);
        }}
        onDrag={(_, i) => pull.set(i.offset.y)}
        onDragEnd={(_, i) => {
          pull.set(0);
          setLive(false);
          if (claimed.current) return;
          if (i.offset.y > PULL_COMMIT) goRow(row + 1);
          else if (i.offset.y < -PULL_COMMIT) goRow(row - 1);
        }}
        transition={S_SNAP}
        className="flex h-full flex-col"
      >
        {/*
          Depth lives on its own element, wrapping the surfaces rather than
          sitting on them. Each surface already animates its own opacity and y
          on entry and exit, and a motion value bound to the same properties
          would simply be overwritten the moment those ran. One stable wrapper
          outside the AnimatePresence takes the finger; the surfaces inside it
          keep their own choreography.
        */}
        <motion.div
          style={
            reduced
              ? { x: deckX }
              : { scale: depthScale, opacity: depthDim, y: depthLift, x: deckX }
          }
          /*
            touch-none, except while a field has focus.

            `pan-x ∩ none = none`, which is how the grid takes horizontal touch
            away from the browser for this whole subtree. But touch-action only
            intersects downward, so it also reaches the history search box and
            the seat card's note fields — and caret placement, the magnifier and
            the selection handles are text-editing behaviours that iOS is not
            documented to keep under `none`. While a field is focused this falls
            back to the inherited `pan-x` and iOS gets whatever it wants: the
            grid is already disarmed over inputs, the stack's drag already
            exempts them, and the register is taps only now, so nothing else
            depends on this element's value. touch-action is read at touch
            start and focus changes on tap, so the next touch sees the new value.
          */
          className={`relative h-full ${editing ? "" : "touch-none"}`}
          onFocusCapture={(e) => {
            const el = e.target as HTMLElement;
            setEditing(
              /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable,
            );
          }}
          onBlurCapture={() => setEditing(false)}
          {...deck}
        >
          <AnimatePresence custom={move} initial={false}>
            {page === "day" ? (
              <motion.div
                key="day"
                custom={move}
                variants={SURF}
                initial={reduced ? { opacity: 0 } : "enter"}
                animate={reduced ? { opacity: 1 } : "here"}
                exit={reduced ? { opacity: 0 } : "gone"}
                transition={SURFACE}
                // Clearance for the status-bar band lives in .app-top — see
                // globals.css for why it is a named class rather than an
                // arbitrary value repeated at three call sites.
                className="app-top absolute inset-0 flex flex-col"
              >
                <motion.div {...rise(0, reduced, !entered.current)} className="shrink-0">
                  <Masthead
                    day={day}
                    pinnedAt={clock.pinned ? formatClock(clock.nowMin) : null}
                    tally={habitTally(day, log)}
                    minutes={log?.deepWorkMinutes ?? 0}
                    reduced={reduced}
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
                      : // 900, not 1400. The same degrees of kick produce
                        // about 1.55× the apparent displacement, which is what
                        // takes the detent from theoretical to visible. It only
                        // affects the housing: the rows get their perspective
                        // from their own rail below, so the resting geometry is
                        // untouched.
                        { rotateX: drum, transformPerspective: 900 }
                  }
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <motion.div
                    {...rise(1, reduced, !entered.current)}
                    style={
                      reduced
                        ? undefined
                        : { perspective: 1000, perspectiveOrigin: "50% 100%" }
                    }
                    className="fade-top flex min-h-0 flex-[1.7] flex-col justify-end gap-3 overflow-hidden pb-1"
                  >
                    <Past blocks={above} reduced={reduced} live={live} />
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
                  <motion.div
                    style={reduced ? undefined : { y: seatDip }}
                    /*
                      relative, and it is load-bearing. popLayout pins an
                      exiting child with absolute top/left measured against its
                      `offsetParent` — with a static parent the popped card
                      anchors to whatever positioned ancestor happens to be
                      above it and lands in the wrong place entirely.
                    */
                    className="relative shrink-0"
                  >
                  <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                    {showFocus && scrubbing ? (
                      <SeatPreview
                        key="preview"
                        b={focus}
                        dir={dir}
                        reduced={reduced}
                      />
                    ) : showFocus ? (
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
                        onReturn={() => {
                          restoring.current = true;
                          spinHome.current();
                        }}
                        dir={dir}
                        reduced={reduced}
                      />
                    ) : (
                      <motion.section
                        key="closed"
                        variants={SEAT_POSE}
                        custom={dir}
                        initial="enter"
                        animate="seat"
                        exit="leave"
                        transition={SEAT}
                        className="mx-5 shrink-0 rounded-lg border border-line-soft bg-surface px-5 py-10 text-center"
                      >
                        <h1 className="text-[32px] font-light leading-none tracking-[-0.03em] text-ink">
                          Day closed
                        </h1>
                        <p className="mono-xs mt-3 text-ink-3">
                      next up <Time at={day.blocks[0]?.block.start ?? "04:45"} />
                    </p>
                      </motion.section>
                    )}
                  </AnimatePresence>
                  </motion.div>

                  <motion.div
                    {...rise(3, reduced, !entered.current)}
                    style={
                      reduced
                        ? undefined
                        : { perspective: 1000, perspectiveOrigin: "50% 0%" }
                    }
                    className="fade-bottom flex min-h-0 flex-1 flex-col justify-start gap-3 overflow-hidden pt-3"
                  >
                    <Stale blocks={stale} reduced={reduced} live={live} />
                    <Upcoming
                      blocks={ahead}
                      prevEndMin={beforeAhead}
                      reduced={reduced}
                      live={live}
                      dOffset={stale.length}
                    />
                  </motion.div>
                </motion.div>

                {/* The register is the one thing that must never be squeezed
                    off: it is the only route to a habit whose block has closed. */}
                <motion.div
                  {...rise(4, reduced, !entered.current)}
                  className="shrink-0 space-y-3 pb-3"
                >
                  {week.length > 0 ? <WeekStrip week={week} /> : null}
                  <Register
                    day={day}
                    log={log}
                    habits={habits}
                    focusIndex={focusIndex}
                    onRecall={spinTo}
                    onFloating={setFloatingId}
                  />
                </motion.div>
              </motion.div>
            ) : (
              <Surface
                key={page}
                page={page}
                move={move}
                reduced={reduced}
                headingRef={headingRef}
              >
                {page === "record" ? (
                  <>
                    <FourteenDay series={series} />
                    {/* The space under the seismograph, spent on the one
                        dimension nothing else in the app draws. Dropped
                        outright on a short screen rather than squeezed. */}
                    <div className="drop-when-short mt-auto shrink-0 pt-4 pb-1">
                      <WeekLoad today={clock.date} version={dataVersion} />
                    </div>
                    {/* Every chart, one place — the sheet scrolls, the page
                        cannot, so the full set lives behind one tap. */}
                    <button
                      type="button"
                      onClick={() => setTrendsOpen(true)}
                      className="mono-xs min-h-11 shrink-0 text-center text-ink-3 hover:text-ink"
                    >
                      all trends →
                    </button>
                  </>
                ) : page === "history" ? (
                  <HistoryScreen
                    today={clock.date}
                    version={dataVersion}
                    onPick={setPickedDate}
                  />
                ) : page === "calendar" ? (
                  <CalendarScreen
                    today={clock.date}
                    version={dataVersion}
                    onPick={setPickedDate}
                  />
                ) : page === "sessions" ? (
                  <SessionsScreen
                    today={clock.date}
                    version={dataVersion}
                    onOpen={setThread}
                    onGym={jumpToGym}
                  />
                ) : page === "gym" ? (
                  <GymScreen
                    today={clock.date}
                    version={dataVersion}
                    onTrained={onGymFinished}
                  />
                ) : page === "habits" ? (
                  <HabitsScreen version={dataVersion} />
                ) : (
                  <SystemScreen />
                )}
              </Surface>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/*
        Where the pull is going, named before it commits, at the edge the
        gesture is opening up. Pulling down reveals space at the top, so the
        destination is written there; pulling up writes it at the foot. At an
        end of the stack the same label says so instead — resistance on its own
        is indistinguishable from a frozen app, which is what 0.03 elastic and
        four pixels of travel used to feel like.
      */}
      {reduced ? null : (
        <>
          <motion.div
            aria-hidden
            style={{ opacity: hintDown }}
            className="app-top pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 pt-1"
          >
            <span className="meta">
              {rowBelow === row ? "nothing deeper" : TITLES[pageAt(rowBelow, HOME[rowBelow])]}
            </span>
            <span className="h-px w-8 bg-line-mid" />
          </motion.div>
          <motion.div
            aria-hidden
            style={{ opacity: hintLeft }}
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-2 pr-1"
          >
            <span className="meta [writing-mode:vertical-rl]">
              {col < lastCol ? TITLES[pageAt(row, col + 1)] : "nothing further"}
            </span>
            <span className="h-8 w-px bg-line-mid" />
          </motion.div>
          <motion.div
            aria-hidden
            style={{ opacity: hintRight }}
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-2 pl-1"
          >
            <span className="h-8 w-px bg-line-mid" />
            <span className="meta [writing-mode:vertical-rl]">
              {col > 0 ? TITLES[pageAt(row, col - 1)] : "nothing further"}
            </span>
          </motion.div>
          <motion.div
            aria-hidden
            style={{ opacity: hintUp }}
            className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-[max(env(safe-area-inset-bottom),8px)]"
          >
            <span className="h-px w-8 bg-line-mid" />
            <span className="meta">
              {rowAbove === row ? "this is today" : TITLES[pageAt(rowAbove, HOME[rowAbove])]}
            </span>
          </motion.div>
        </>
      )}
      <DaySheet
        date={pickedDate}
        onClose={() => setPickedDate(null)}
        onSaved={() => setDataVersion((v) => v + 1)}
      />
      <SessionThread label={thread} onClose={() => setThread(null)} />
      <TrendsSheet
        open={trendsOpen}
        onClose={() => setTrendsOpen(false)}
        today={clock.date}
        version={dataVersion}
      />
      <FloatingHabitSheet
        habit={floatingId ? habitById.get(floatingId) : undefined}
        log={log}
        onChange={setHabit}
        onPatch={patch}
        onClose={() => setFloatingId(null)}
      />
    </motion.main>
  );
}
