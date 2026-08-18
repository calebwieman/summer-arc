"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Latch } from "@/components/day/latch";
import {
  MinutesField,
  NoteField,
  ShippedField,
} from "@/components/day/fields";
import { getHabits, isHabitScheduledOn, type HabitDef } from "@/lib/habits";
import { getDailyLog, saveDailyLog } from "@/lib/storage";
import { formatHeaderDate, makeEmptyLog } from "@/lib/today";
import type { DailyLog, HabitKey } from "@/lib/types";

/**
 * Edit one past day.
 *
 * The day screen can only reach today and blocks it recalls, which was fine
 * while the record was read-only but leaves no way to fix a day you forgot to
 * log at all. Everything here is the same machinery as the spine — the same
 * latch, the same fields — so a backfilled day is written exactly the way a
 * live one is, stamps included.
 */
export function DaySheet({
  date,
  onClose,
  onSaved,
}: {
  /** null closes the sheet. */
  date: string | null;
  onClose: () => void;
  /** Fired after a write so the calendar behind can redraw. */
  onSaved?: () => void;
}) {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [habits, setHabits] = useState<HabitDef[]>([]);

  useEffect(() => {
    if (!date) return;
    setLog(getDailyLog(date) ?? makeEmptyLog(date));
    setHabits(getHabits().filter((h) => isHabitScheduledOn(h, date)));
  }, [date]);

  const patch = useCallback(
    (p: Partial<DailyLog>) => {
      if (!date) return;
      setLog((prev) => {
        const next = { ...(prev ?? makeEmptyLog(date)), ...p };
        saveDailyLog(next);
        onSaved?.();
        return next;
      });
    },
    [date, onSaved],
  );

  const setHabit = useCallback(
    (id: HabitKey, v: boolean) => {
      if (!date) return;
      setLog((prev) => {
        const base = prev ?? makeEmptyLog(date);
        const stamps = { ...(base.stamps ?? {}) };
        // No stamp on a backfill. A time here would be invented — the receipt
        // means "committed at", and nobody committed this at 14:03 today.
        delete stamps[id];
        const next: DailyLog = {
          ...base,
          habits: { ...base.habits, [id]: v },
          stamps,
        };
        saveDailyLog(next);
        onSaved?.();
        return next;
      });
    },
    [date, onSaved],
  );

  const done = habits.filter((h) => log?.habits?.[h.id]).length;
  const marked = (log?.noData?.length ?? 0) > 0;

  /*
    Mark the whole day as one there is no answer for.

    `noData` has existed on the log type since the migration, and everything
    that scores — the streaks, the calendar, the year trace, the rolling rates —
    already honours it: a habit listed there is dropped from the denominator
    rather than counted as a miss. But the only thing that has ever written it
    is the legacy importer. So a week with flu, four days travelling, a funeral:
    today those are permanent misses that break a streak, dent a lifetime rate
    for good, and make the never-miss-twice flag say something untrue. Every
    long-run number in the app is quietly wrong in the same direction until
    something can write this.

    Whole-day and all-habits on purpose. Per-habit it would be a way to launder
    a single miss, which is the one thing it must not become.
  */
  const toggleRest = useCallback(() => {
    if (!date) return;
    setLog((prev) => {
      const base = prev ?? makeEmptyLog(date);
      const all = getHabits()
        .filter((h) => isHabitScheduledOn(h, date))
        .map((h) => h.id);
      const next: DailyLog = {
        ...base,
        noData: (base.noData?.length ?? 0) > 0 ? [] : all,
      };
      saveDailyLog(next);
      onSaved?.();
      return next;
    });
  }, [date, onSaved]);

  return (
    <Sheet
      open={!!date}
      onClose={onClose}
      title={date ? formatHeaderDate(date) : "Day"}
      tall
    >
      {date ? (
        <div className="space-y-6 pb-2">
          <p className="mono-xs text-center text-ink-3">
            {done}/{habits.length} · backfill
          </p>

          <div className="space-y-3">
            {habits.length === 0 ? (
              <p className="mono-xs text-center text-ink-3">
                nothing was scheduled this day
              </p>
            ) : null}
            {habits.map((h) => (
              <Latch
                key={h.id}
                habit={h.id}
                icon={h.icon}
                label={h.label}
                checked={log?.habits?.[h.id] === true}
                stampMin={log?.stamps?.[h.id]}
                onChange={(v) => setHabit(h.id, v)}
              />
            ))}
          </div>

          <div className="space-y-5 border-t border-line-soft pt-5">
            <MinutesField
              value={log?.deepWorkMinutes ?? 0}
              blockMinutes={0}
              onChange={(v) => patch({ deepWorkMinutes: v })}
            />
            <NoteField
              label="Session"
              placeholder="6 × 800 @ 5:42"
              value={log?.trainingNote ?? ""}
              onChange={(v) => patch({ trainingNote: v })}
            />
            <ShippedField
              value={log?.contentShipped ?? false}
              onChange={(v) => patch({ contentShipped: v })}
            />
            <NoteField
              label="The day"
              placeholder="One line."
              rows={2}
              value={log?.note ?? ""}
              onChange={(v) => patch({ note: v })}
            />
          </div>

          <div className="border-t border-line-soft pt-5">
            <button
              type="button"
              onClick={toggleRest}
              aria-pressed={marked}
              className={`mono-xs flex min-h-11 w-full items-center justify-center rounded-sm border transition-colors ${
                marked
                  ? "border-accent text-ink"
                  : "border-line-mid text-ink-3 hover:text-ink-2"
              }`}
            >
              {marked ? "counted as no data — undo" : "no answer for this day"}
            </button>
            <p className="mono-xs mt-2 text-center text-ink-4">
              {marked
                ? "dropped from every rate and streak, not counted as a miss"
                : "illness, travel, a funeral — not a day you skipped"}
            </p>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
