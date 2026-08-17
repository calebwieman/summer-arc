"use client";

import { Sheet } from "@/components/ui/sheet";
import type { HabitDef } from "@/lib/habits";
import type { DailyLog, HabitKey } from "@/lib/types";
import { Latch } from "./latch";

/**
 * Commit surface for a habit that no block owns.
 *
 * Anchored habits are thrown inside their block, which is the app's whole
 * grammar — the commit lives where the thing happens. A habit the user created
 * without an anchor has no such place, and parking it in Wind Down would mean
 * "read 20 pages" could only be logged after 21:15. So it gets a sheet off its
 * register glyph instead, reachable at any hour.
 */
export function FloatingHabitSheet({
  habit,
  log,
  onChange,
  onClose,
}: {
  habit: HabitDef | undefined;
  log: DailyLog | null;
  onChange: (id: HabitKey, next: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!habit} onClose={onClose} title={habit?.label ?? "Habit"}>
      {habit ? (
        <div className="space-y-4 pb-2">
          <Latch
            habit={habit.id}
            icon={habit.icon}
            label={habit.label}
            checked={log?.habits?.[habit.id] === true}
            stampMin={log?.stamps?.[habit.id]}
            onChange={(v) => {
              onChange(habit.id, v);
              // A throw is the whole purpose of this sheet; staying open after
              // it just asks for a second dismissal.
              if (v) onClose();
            }}
          />
          <p className="mono-xs text-center text-ink-3">
            no block — log it whenever it happens
          </p>
        </div>
      ) : null}
    </Sheet>
  );
}
