"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Pencil } from "lucide-react";
import { getHabits, HABITS_CHANGED, type HabitDef } from "@/lib/habits";
import { allHabitStats, type HabitStats } from "@/lib/stats";
import { HabitGlyph } from "@/components/day/habit-glyph";
import { Sheet } from "@/components/ui/sheet";
import { HabitEditor } from "./habit-editor";
import { SWEEP } from "@/lib/motion";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function schedule(h: HabitDef): string {
  if (h.anchor?.kind) return `every ${h.anchor.kind} block`;
  if (h.anchor?.labels?.length) return h.anchor.labels.join(" · ").toLowerCase();
  return "floating";
}

/**
 * The register, written out.
 *
 * One swipe left from the day, and it is the page that answers "what am I
 * actually tracking, and how is each one doing" — the letters along the bottom
 * of the day screen in longhand, with the schedule that puts them there and the
 * lifetime rate behind them.
 *
 * Editing happens in a sheet rather than on the page. The page cannot scroll,
 * and a habit's detail — name, letter, icon, days, anchor — is taller than a
 * phone on its own; a sheet is allowed to scroll because it mounts outside the
 * surface stack and steals no gesture from it.
 */
export function HabitsScreen({ version }: { version: number }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [habits, setHabits] = useState<HabitDef[]>([]);
  const [stats, setStats] = useState<HabitStats[]>([]);

  useEffect(() => {
    const load = () => {
      setHabits(getHabits());
      setStats(allHabitStats());
    };
    load();
    window.addEventListener(HABITS_CHANGED, load);
    return () => window.removeEventListener(HABITS_CHANGED, load);
  }, [version]);

  const byId = useMemo(
    () => new Map(stats.map((s) => [s.id, s])),
    [stats],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mono-xs shrink-0 text-ink-3">
        <span className="text-ink-2 tabular-nums">{habits.length}</span> tracked
        · order sets the register
      </p>

      <div className="mt-4 divide-y divide-line-soft/60">
        {habits.map((h, i) => {
          const s = byId.get(h.id);
          const rate = s && s.scheduledCount > 0 ? s.lifetimeRate : null;
          return (
            <motion.div
              key={h.id}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04, ease: SWEEP }}
              className="flex items-center gap-3 py-3"
            >
              <HabitGlyph habit={h.id} code={h.code} state="pending" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-ink-2">{h.label}</p>
                <p className="mono-xs mt-0.5 truncate text-ink-4">
                  {schedule(h)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="mono-xs tabular-nums text-ink-3">
                  {rate == null ? "—" : `${Math.round(rate * 100)}%`}
                </span>
                <span aria-hidden className="flex gap-[3px]">
                  {ORDER.map((d, j) => (
                    <span
                      key={j}
                      className={`h-[3px] w-[3px] rounded-pill ${
                        h.days.includes(d as never) ? "bg-ink-3" : "bg-line-mid"
                      }`}
                      title={DOW[j]}
                    />
                  ))}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mono-xs mt-auto flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-sm border border-line-mid text-ink-2 hover:border-accent hover:text-ink"
      >
        <Pencil className="h-3.5 w-3.5" />
        edit the register
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Habits"
        tall
      >
        <HabitEditor />
      </Sheet>
    </div>
  );
}
