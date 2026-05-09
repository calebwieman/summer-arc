import { differenceInCalendarDays, format, isAfter, isBefore } from "date-fns";

// Default arc — overridable in profile later
export const ARC_START = new Date(2026, 4, 16); // May 16, 2026 (month is 0-indexed)
export const ARC_END = new Date(2026, 7, 31); // Aug 31, 2026
export const ARC_TOTAL_DAYS =
  differenceInCalendarDays(ARC_END, ARC_START) + 1;

export interface ArcStatus {
  dayNumber: number;       // 1-indexed; can be <=0 (pre-arc) or > total (post-arc)
  totalDays: number;
  daysRemaining: number;   // can be negative
  percentComplete: number; // 0-100
  phase: "pre" | "active" | "summit" | "post";
  startDate: Date;
  endDate: Date;
  formattedToday: string;
}

export function getArcStatus(now: Date = new Date()): ArcStatus {
  const start = ARC_START;
  const end = ARC_END;
  const total = ARC_TOTAL_DAYS;
  const day = differenceInCalendarDays(now, start) + 1;
  const remaining = differenceInCalendarDays(end, now);

  let phase: ArcStatus["phase"] = "active";
  if (isBefore(now, start)) phase = "pre";
  else if (day === total) phase = "summit";
  else if (isAfter(now, end)) phase = "post";

  const pct = Math.max(0, Math.min(100, (day / total) * 100));

  return {
    dayNumber: day,
    totalDays: total,
    daysRemaining: remaining,
    percentComplete: pct,
    phase,
    startDate: start,
    endDate: end,
    formattedToday: format(now, "EEE, MMM d"),
  };
}

// Daily 5 keys — order matters for UI
export const DAILY_FIVE = [
  { key: "wake", label: "Wake by 6", icon: "alarm" },
  { key: "run", label: "Run", icon: "run" },
  { key: "lift", label: "Lift", icon: "dumbbell" },
  { key: "bible", label: "Bible", icon: "book" },
  { key: "no_doomscroll", label: "Doomscroll < 30m", icon: "phone-off" },
] as const;

export type DailyFiveKey = (typeof DAILY_FIVE)[number]["key"];
