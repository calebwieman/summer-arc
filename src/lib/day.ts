import { getHabits, isHabitScheduledOn, anchorIndexFor, type HabitDef } from "./habits";
import { blocksForDate, toMinutes, type Block } from "./schedule";
import type { DailyLog, HabitKey } from "./types";

/**
 * Which DailyLog field a block is responsible for capturing. The rule for the
 * whole screen is that nothing lives in a separate list — every field is
 * captured inside the block it belongs to.
 */
export type BlockField =
  | "deepWorkMinutes"
  | "trainingNote"
  | "contentShipped"
  | "note";

export type BlockPhase = "past" | "current" | "upcoming";

export interface DayBlock {
  block: Block;
  index: number;
  startMin: number;
  endMin: number;
  /**
   * Habits committed inside this block. A list rather than a single id: a user
   * can anchor several habits to the same block, and nothing about the design
   * says a block owns at most one.
   */
  habits: HabitKey[];
  /** DailyLog fields captured here. */
  fields: BlockField[];
  phase: BlockPhase;
  /** 0..1 progress through this block (0 when upcoming, 1 when past). */
  progress: number;
  /** Minutes until start; 0 once started. */
  untilStart: number;
  /** Minutes until end; 0 once ended. */
  untilEnd: number;
}

export type DayState = "before" | "in-block" | "gap" | "after";

export interface DayModel {
  date: string;
  nowMin: number;
  blocks: DayBlock[];
  /** Index of the block containing now, or -1 in a gap/before/after. */
  currentIndex: number;
  /** The block the screen should centre on. Always valid when blocks exist. */
  focusIndex: number;
  state: DayState;
  /** Minutes of dead air remaining until the next block, when state==="gap". */
  gapRemaining: number;
  /**
   * A block that has just ended with a habit still unthrown, held open during
   * the dead air after it. You finish the run at 06:02; the 05:00–06:00 block
   * must not have vanished. -1 when nothing is being held.
   */
  graceIndex: number;
  /** Scheduled today but kept out of the done/total tally. */
  offSummary: HabitKey[];
  /**
   * Habits scheduled today that no block owns — a user habit with no anchor.
   * They have no place in the spine, so they are committed from a sheet opened
   * off their register glyph, which works at any hour rather than only during
   * some block that happens to be running.
   */
  floating: HabitKey[];
  /** Every habit expected today, anchored and floating, in display order. */
  scheduled: HabitKey[];
}

/** How long a just-ended block stays throwable. */
export const GRACE_MIN = 20;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Attach DailyLog fields to blocks. Weekends have no Deep Work and no Content
 * block, so those fields fall back to Wind Down rather than becoming
 * uncapturable for the day.
 *
 * Matching is on label and kind. It used to key off `Block.habit`, which no
 * longer exists — and tying the day's fields to a habit the user can now
 * delete would have made the closing note vanish with it.
 */
function assignFields(blocks: Block[]): Map<number, BlockField[]> {
  const map = new Map<number, BlockField[]>();
  const push = (i: number, f: BlockField) => {
    const cur = map.get(i);
    if (cur) cur.push(f);
    else map.set(i, [f]);
  };

  const findIdx = (pred: (b: Block) => boolean) => blocks.findIndex(pred);

  const windDownIdx = findIdx((b) => b.label === "Wind Down");
  // The day's closing note always lives in Wind Down.
  if (windDownIdx >= 0) push(windDownIdx, "note");

  // The session note lives in the training block, and only there. Wind Down
  // used to carry it too as the end-of-day door, which stacked a whole second
  // run entry onto the day's already-fullest card — and the R letter's sheet
  // has since become the real any-hour door, Sundays included. One block, one
  // job; the sheet covers the rest.
  const trainingIdx = findIdx((b) => b.kind === "training");
  if (trainingIdx >= 0) push(trainingIdx, "trainingNote");

  const deepIdx = findIdx((b) => b.label === "Deep Work");
  if (deepIdx >= 0) {
    push(deepIdx, "deepWorkMinutes");
  } else {
    // Sunday's Study block is the nearest equivalent; else fall back.
    const studyIdx = findIdx((b) => b.label === "Study");
    const target = studyIdx >= 0 ? studyIdx : windDownIdx;
    if (target >= 0) push(target, "deepWorkMinutes");
  }

  const contentIdx = findIdx((b) => b.label === "Content");
  const contentTarget = contentIdx >= 0 ? contentIdx : windDownIdx;
  if (contentTarget >= 0) push(contentTarget, "contentShipped");

  return map;
}

/** Build the full view model for a date at a given wall-clock minute. */
export function buildDay(
  date: string,
  nowMin: number,
  log?: DailyLog | null,
  habits: HabitDef[] = getHabits(),
): DayModel {
  const raw = blocksForDate(date);
  const fields = assignFields(raw);

  // Resolve every scheduled habit to the block that owns it, once.
  const byBlock = new Map<number, HabitKey[]>();
  const floating: HabitKey[] = [];
  const scheduled: HabitKey[] = [];
  const offSummary: HabitKey[] = [];
  for (const h of habits) {
    if (!isHabitScheduledOn(h, date)) continue;
    scheduled.push(h.id);
    if (h.offSummary) offSummary.push(h.id);
    const idx = h.anchor ? anchorIndexFor(h, date) : -1;
    if (idx >= 0) {
      const cur = byBlock.get(idx);
      if (cur) cur.push(h.id);
      else byBlock.set(idx, [h.id]);
    } else {
      floating.push(h.id);
    }
  }

  const blocks: DayBlock[] = raw.map((block, index) => {
    const startMin = toMinutes(block.start);
    const endMin = toMinutes(block.end);
    const span = Math.max(1, endMin - startMin);

    let phase: BlockPhase;
    if (nowMin >= endMin) phase = "past";
    else if (nowMin >= startMin) phase = "current";
    else phase = "upcoming";

    return {
      block,
      index,
      startMin,
      endMin,
      habits: byBlock.get(index) ?? [],
      fields: fields.get(index) ?? [],
      phase,
      progress: clamp01((nowMin - startMin) / span),
      untilStart: Math.max(0, startMin - nowMin),
      untilEnd: Math.max(0, endMin - nowMin),
    };
  });

  const currentIndex = blocks.findIndex((b) => b.phase === "current");
  const nextIndex = blocks.findIndex((b) => b.phase === "upcoming");

  let state: DayState;
  let gapRemaining = 0;
  if (blocks.length === 0) {
    state = "after";
  } else if (currentIndex >= 0) {
    state = "in-block";
  } else if (nowMin < blocks[0].startMin) {
    state = "before";
    gapRemaining = blocks[0].startMin - nowMin;
  } else if (nextIndex >= 0) {
    state = "gap";
    gapRemaining = blocks[nextIndex].startMin - nowMin;
  } else {
    state = "after";
  }

  // Grace only applies in dead air — a block that has genuinely started always
  // outranks one that is merely still open, so the two can never compete.
  // Once the whole day is behind you nothing can compete at all, so the last
  // unthrown block stays open until the date rolls over: you went to bed at
  // 22:30 and opened this at 23:30, and refusing to record that would make the
  // miss a lie about what actually happened.
  const dayOver = nextIndex < 0;
  let graceIndex = -1;
  if (currentIndex < 0) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b.phase !== "past" || b.habits.length === 0) continue;
      if (b.habits.every((h) => log?.habits?.[h])) break;
      if (dayOver || nowMin - b.endMin <= GRACE_MIN) graceIndex = i;
      break;
    }
  }

  // Focus: the live block, else one still held open, else the next one up,
  // else the last thing that happened.
  const focusIndex =
    currentIndex >= 0
      ? currentIndex
      : graceIndex >= 0
        ? graceIndex
        : nextIndex >= 0
          ? nextIndex
          : blocks.length - 1;

  return {
    date,
    nowMin,
    blocks,
    currentIndex,
    focusIndex,
    state,
    gapRemaining,
    graceIndex,
    offSummary,
    floating,
    scheduled,
  };
}

/** Habits scheduled today that are still unchecked, in day order. */
export function openHabits(day: DayModel, log: DailyLog | null): HabitKey[] {
  return day.scheduled.filter((h) => !log?.habits?.[h]);
}

/** Count of today's habits done / scheduled. */
export function habitTally(
  day: DayModel,
  log: DailyLog | null,
): { done: number; total: number } {
  // The run is real but is not one of the day's standing commitments, so it
  // stays out of done/total. Counting it would read 4/6 on a complete day.
  const skip = new Set(day.offSummary);
  const counted = day.scheduled.filter((k) => !skip.has(k));
  return {
    done: counted.filter((k) => log?.habits?.[k]).length,
    total: counted.length,
  };
}
