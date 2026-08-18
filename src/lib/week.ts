import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { trainingBlockOn, toMinutes } from "./schedule";
import { getHabits } from "./habits";
import { buildLogIndex, type LogIndex } from "./log-index";

/**
 * One definition of "this week", used by everything that says those words.
 *
 * Monday to Sunday, because that is how the training week is written and how
 * every other week reading in the app is ordered. The alternative — a rolling
 * last-seven-days — is defensible on its own but not alongside this one: two
 * surfaces saying "this week" and meaning different sets of days is exactly the
 * kind of quiet disagreement that makes an instrument untrustworthy.
 */
export function weekDays(today: string): string[] {
  const d = parseISO(today);
  const monday = subDays(d, (d.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) =>
    format(subDays(monday, -i), "yyyy-MM-dd"),
  );
}

export interface TrainingWeek {
  /** Which session of the week today is, counting from Monday. 1-based. */
  nth: number;
  /** Training sessions the template asks for this week. */
  planned: number;
  /** Minutes the template asks for across the whole week. */
  plannedMin: number;
  /** Minutes of it thrown so far. */
  doneMin: number;
  /** Days since the last day with no training block, or null if never. */
  sinceRest: number | null;
}

export function trainingWeek(
  today: string,
  ix: LogIndex = buildLogIndex(),
): TrainingWeek {
  const training = getHabits().find((h) => h.anchor?.kind === "training");
  const days = weekDays(today);

  let nth = 0;
  let planned = 0;
  let plannedMin = 0;
  let doneMin = 0;
  for (const date of days) {
    const block = trainingBlockOn(date);
    if (!block) continue;
    const mins = toMinutes(block.end) - toMinutes(block.start);
    planned += 1;
    plannedMin += mins;
    if (date <= today) nth += 1;
    if (training && ix.byDate.get(date)?.habits?.[training.id] === true) {
      doneMin += mins;
    }
  }

  // Rest is a day the template gives you off, not a day you skipped.
  let sinceRest: number | null = null;
  const from = parseISO(today);
  for (let i = 0; i <= 21; i++) {
    const date = format(subDays(from, i), "yyyy-MM-dd");
    if (!trainingBlockOn(date)) {
      sinceRest = differenceInCalendarDays(from, parseISO(date));
      break;
    }
  }

  return { nth, planned, plannedMin, doneMin, sinceRest };
}

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

/**
 * The line a training card carries: where today sits in the week, how much of
 * the week's minutes are in the bank, and how long since a day off.
 *
 * Deliberately short. It sits on the seat card, which is the only surface in
 * the app whose height comes from its content rather than from a budget, and
 * every extra character is a wrap away from eating a rail.
 */
export function trainingLine(today: string, ix?: LogIndex): string {
  const w = trainingWeek(today, ix);
  const parts = [`${ORDINAL[w.nth] ?? `${w.nth}th`} this week`];
  parts.push(`${w.doneMin}/${w.plannedMin} min`);
  if (w.sinceRest != null && w.sinceRest > 0) {
    parts.push(`${w.sinceRest} since rest`);
  }
  return parts.join(" · ");
}

/** What tomorrow asks for, read off the template. */
export function tomorrowLine(today: string): string {
  const date = format(subDays(parseISO(today), -1), "yyyy-MM-dd");
  const block = trainingBlockOn(date);
  return block ? `tomorrow · ${block.label}` : "tomorrow · rest";
}
