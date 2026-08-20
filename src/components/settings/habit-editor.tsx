"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  ALL_DAYS,
  BUILT_INS,
  getAllHabits,
  makeHabitId,
  saveHabits,
  type HabitDef,
} from "@/lib/habits";

const BUILTIN_IDS_SET = new Set(BUILT_INS.map((h) => h.id));
import { allBlockLabels, type Weekday } from "@/lib/schedule";
import { haptic } from "@/lib/haptics";
import { ICON_NAMES, iconFor } from "@/components/day/habit-icons";

const DOW: { d: Weekday; l: string }[] = [
  { d: 1, l: "M" },
  { d: 2, l: "T" },
  { d: 3, l: "W" },
  { d: 4, l: "T" },
  { d: 5, l: "F" },
  { d: 6, l: "S" },
  { d: 0, l: "S" },
];

const TAP = { type: "spring", stiffness: 520, damping: 32 } as const;

/** "" = floats, "label:X" = anchored to a block label, "kind:training". */
function anchorValue(h: HabitDef): string {
  if (!h.anchor) return "";
  if (h.anchor.kind) return `kind:${h.anchor.kind}`;
  const first = h.anchor.labels?.[0];
  return first ? `label:${first}` : "";
}

function anchorFromValue(v: string): HabitDef["anchor"] {
  if (!v) return undefined;
  if (v.startsWith("kind:")) {
    return { kind: v.slice(5) as NonNullable<HabitDef["anchor"]>["kind"] };
  }
  return { labels: [v.slice(6)] };
}

// No width here on purpose: call sites set it. With `w-full` baked in, the
// two-character code field's `w-20` collided with it and lost, rendering a
// full-width box for a single letter.
const INPUT =
  "rounded-sm border border-line-soft bg-surface-2 px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-3 outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

function Pill({
  active,
  children,
  onPress,
  label,
}: {
  active: boolean;
  children: React.ReactNode;
  onPress: () => void;
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onPress}
      whileTap={{ scale: 0.94 }}
      transition={TAP}
      className={`mono-xs flex min-h-9 min-w-9 items-center justify-center rounded-sm border px-2 transition-colors ${
        active
          ? "border-accent bg-ink/[0.10] text-ink"
          : "border-line-mid text-ink-3"
      }`}
    >
      {children}
    </motion.button>
  );
}

function HabitRow({
  habit,
  index,
  count,
  onChange,
  onMove,
  onDelete,
}: {
  habit: HabitDef;
  index: number;
  count: number;
  onChange: (next: HabitDef) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const Icon = iconFor(habit.icon);
  const anchored = !!habit.anchor;

  return (
    <div className="rounded-sm border border-line-soft">
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon className="h-4 w-4 shrink-0 text-ink-2" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="truncate text-[15px] text-ink">{habit.label}</span>
          <span className="mono-xs shrink-0 text-ink-4">{habit.code}</span>
        </button>
        <button
          type="button"
          aria-label={`Move ${habit.label} up`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="flex h-9 w-7 items-center justify-center text-ink-3 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`Move ${habit.label} down`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          className="flex h-9 w-7 items-center justify-center text-ink-3 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <div className="space-y-4 border-t border-line-soft px-3 pt-4 pb-4">
          <label className="block space-y-1.5">
            <span className="meta block">Name</span>
            <input
              className={`${INPUT} w-full`}
              value={habit.label}
              onChange={(e) => onChange({ ...habit, label: e.target.value })}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="meta block">Register letter</span>
            <input
              className={`${INPUT} w-20 text-center uppercase`}
              value={habit.code}
              maxLength={2}
              onChange={(e) =>
                onChange({ ...habit, code: e.target.value.toUpperCase() })
              }
            />
          </label>

          <div className="space-y-1.5">
            <span className="meta block">Icon</span>
            <div className="flex flex-wrap gap-1.5">
              {ICON_NAMES.map((n) => {
                const I = iconFor(n);
                return (
                  <Pill
                    key={n}
                    label={n}
                    active={habit.icon === n}
                    onPress={() => {
                      haptic(6);
                      onChange({ ...habit, icon: n });
                    }}
                  >
                    <I className="h-4 w-4" />
                  </Pill>
                );
              })}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="meta block">Commit inside</span>
            <select
              className={`${INPUT} w-full`}
              value={anchorValue(habit)}
              onChange={(e) =>
                onChange({ ...habit, anchor: anchorFromValue(e.target.value) })
              }
            >
              <option value="">No block — any time</option>
              <option value="kind:training">Any training block</option>
              {allBlockLabels().map((l) => (
                <option key={l} value={`label:${l}`}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <span className="meta block">Days</span>
            {anchored ? (
              // Anchored habits take their schedule from the block, which is
              // the whole reason Sunday is not a training miss. Letting the day
              // set disagree with the anchor would give two answers to
              // "is this expected today".
              <p className="mono-xs text-ink-3">
                follows the block — rest days come free
              </p>
            ) : (
              <div className="flex gap-1.5">
                {DOW.map(({ d, l }, i) => {
                  const on = habit.days.includes(d);
                  return (
                    <Pill
                      key={`${d}-${i}`}
                      label={`day ${d}`}
                      active={on}
                      onPress={() => {
                        haptic(6);
                        onChange({
                          ...habit,
                          days: on
                            ? habit.days.filter((x) => x !== d)
                            : [...habit.days, d].sort((a, b) => a - b),
                        });
                      }}
                    >
                      {l}
                    </Pill>
                  );
                })}
              </div>
            )}
          </div>

          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="mono-xs flex-1 text-bad">delete for good?</span>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="mono-xs min-h-11 px-3 text-ink-3"
              >
                keep
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic([16, 30, 12]);
                  onDelete();
                }}
                className="mono-xs min-h-11 rounded-sm border border-bad px-3 text-bad"
              >
                delete
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mono-xs flex min-h-11 items-center gap-2 text-ink-3 hover:text-bad"
            >
              <Trash2 className="h-3.5 w-3.5" />
              delete habit
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Add, rename, reorder and retire habits.
 *
 * Deleting removes the definition but never the history: a day that recorded
 * the habit keeps its entry, so an export of last month still contains it. What
 * deletion changes is scoring — a habit with no definition is not scheduled,
 * so it stops counting against you from today rather than retroactively.
 */
export function HabitEditor() {
  const [habits, setHabits] = useState<HabitDef[]>([]);

  useEffect(() => setHabits(getAllHabits()), []);

  /*
    Archived habits are kept in the registry but not in this list.

    Deleting a built-in archives it rather than removing it, because
    `getAllHabits` reconciles missing built-ins back in and a hard delete would
    reappear on the next read. That tombstone is right — but the editor was
    rendering the whole registry, archived included, so confirming a delete left
    the row exactly where it was and the button read as broken. It was the only
    honest reading: nothing on screen changed.

    So the row leaves, which is what delete means, and the archived ones get a
    line of their own at the foot where they can be brought back. Nothing is
    lost either way: history keeps its entries regardless, because a day stores
    habit ids and not definitions.
  */
  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);

  const commit = useCallback((next: HabitDef[]) => {
    const ordered = next.map((h, i) => ({ ...h, order: i }));
    setHabits(ordered);
    saveHabits(ordered);
  }, []);

  const add = () => {
    haptic(10);
    const label = "New habit";
    const def: HabitDef = {
      id: makeHabitId(label, habits),
      label,
      code: "N",
      icon: "check",
      days: ALL_DAYS,
      order: habits.length,
    };
    commit([...habits, def]);
  };

  return (
    <section>
      <h3 className="kicker text-center">Habits</h3>
      <p className="meta mt-1.5 text-center">
        {active.length} tracked · order sets the register
      </p>

      <div className="mt-4 space-y-2">
        {active.map((h, i) => (
          <HabitRow
            key={h.id}
            habit={h}
            index={i}
            count={active.length}
            onChange={(next) =>
              commit(habits.map((x) => (x.id === h.id ? next : x)))
            }
            onMove={(dir) => {
              // Indices address the visible list; the swap has to happen in the
              // stored one, which may have archived entries interleaved.
              const j = i + dir;
              if (j < 0 || j >= active.length) return;
              const a = habits.findIndex((x) => x.id === active[i].id);
              const bIdx = habits.findIndex((x) => x.id === active[j].id);
              if (a < 0 || bIdx < 0) return;
              const next = [...habits];
              [next[a], next[bIdx]] = [next[bIdx], next[a]];
              haptic(6);
              commit(next);
            }}
            onDelete={() =>
              /*
                A built-in is archived, never removed: getAllHabits reconciles
                missing built-ins back into the registry, so a hard delete
                reappeared on the next read — confirmed gone, back in the same
                second. Archived is exactly the tombstone that merge respects.
              */
              commit(
                BUILTIN_IDS_SET.has(h.id)
                  ? habits.map((x) =>
                      x.id === h.id ? { ...x, archived: true } : x,
                    )
                  : habits.filter((x) => x.id !== h.id),
              )
            }
          />
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={add}
          className="mono-xs flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm border border-line-mid text-ink-2 hover:border-accent hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          add habit
        </button>
        {active.length === 0 ? (
          <button
            type="button"
            onClick={() => commit(BUILT_INS)}
            className="mono-xs min-h-11 rounded-sm border border-line-mid px-3 text-ink-3"
          >
            restore defaults
          </button>
        ) : null}
      </div>

      {/* Retired, and reversible. A built-in cannot be truly deleted — the
          registry reconciles it back — so this is where the ones you have put
          away actually live, rather than sitting in the list pretending the
          delete did not work. */}
      {archived.length > 0 ? (
        <div className="mt-6 border-t border-line-soft pt-4">
          <p className="meta">Retired</p>
          <div className="mt-2 space-y-1.5">
            {archived.map((h) => (
              <div key={h.id} className="flex items-center gap-3">
                <span className="mono-xs w-6 shrink-0 text-ink-4">{h.code}</span>
                <span className="mono-xs flex-1 truncate text-ink-3">
                  {h.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    haptic(8);
                    commit(
                      habits.map((x) =>
                        x.id === h.id ? { ...x, archived: false } : x,
                      ),
                    );
                  }}
                  className="mono-xs min-h-11 shrink-0 px-2 text-ink-3 hover:text-ink"
                >
                  bring back
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
