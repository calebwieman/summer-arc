"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from "lucide-react";
import { getHabits, saveHabits } from "@/lib/storage";
import { createHabitId, DEFAULT_HABITS } from "@/lib/today";
import type { HabitDef } from "@/lib/types";

export function HabitEditor({ onChange }: { onChange?: () => void }) {
  const [habits, setHabits] = useState<HabitDef[]>([]);
  const [mounted, setMounted] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  useEffect(() => {
    setHabits(getHabits());
    setMounted(true);
  }, []);

  function commit(next: HabitDef[]) {
    setHabits(next);
    saveHabits(next);
    onChange?.();
  }

  function rename(id: string, label: string) {
    commit(habits.map((h) => (h.id === id ? { ...h, label } : h)));
  }

  function remove(id: string) {
    const habit = habits.find((h) => h.id === id);
    const name = habit?.label?.trim();
    if (
      name &&
      !window.confirm(
        `Remove "${name}"? It stops showing on Today. Days you've already logged keep their data.`,
      )
    ) {
      return;
    }
    commit(habits.filter((h) => h.id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= habits.length) return;
    const next = [...habits];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  function add() {
    const id = createHabitId();
    setJustAddedId(id);
    commit([...habits, { id, label: "" }]);
  }

  function resetDefaults() {
    if (
      !window.confirm(
        "Reset to the default habit list? Your logged history is kept, but the current habit names and order will be replaced.",
      )
    )
      return;
    commit(DEFAULT_HABITS.map((h) => ({ ...h })));
  }

  if (!mounted) {
    return <div className="h-24 rounded-2xl border border-border bg-surface" />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {habits.length === 0 ? (
          <p className="px-5 py-6 text-center text-[14px] text-muted">
            No habits. Add one below.
          </p>
        ) : (
          habits.map((habit, index) => (
            <div key={habit.id} className="flex items-center gap-2 px-3 py-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted/50" />
              <input
                type="text"
                value={habit.label}
                autoFocus={habit.id === justAddedId}
                placeholder="Habit name"
                onChange={(e) => rename(habit.id, e.target.value)}
                className="min-h-10 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted/50 outline-none"
              />
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-muted hover:text-foreground disabled:opacity-25 transition-colors"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={index === habits.length - 1}
                  onClick={() => move(index, 1)}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-muted hover:text-foreground disabled:opacity-25 transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${habit.label || "habit"}`}
                  onClick={() => remove(habit.id)}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-muted hover:text-red-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-surface min-h-12 text-[15px] text-foreground hover:border-accent/60 transition-colors"
        >
          <Plus className="h-4 w-4 text-accent" /> Add habit
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          className="rounded-2xl border border-border bg-surface px-4 min-h-12 text-[13px] text-muted hover:text-foreground transition-colors"
        >
          Reset
        </button>
      </div>

      <p className="px-1 text-[12px] leading-5 text-muted/80">
        Editing habits won&rsquo;t change days you&rsquo;ve already logged.
        Deleting a habit just hides it going forward.
      </p>
    </div>
  );
}
