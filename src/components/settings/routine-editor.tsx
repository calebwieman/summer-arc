"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import {
  ROUTINE_CHANGED,
  WEEKLY_SCHEDULE,
  routineEdited,
  routineFor,
  routineProblem,
  setRoutineDay,
  toMinutes,
  type Block,
  type BlockKind,
  type Weekday,
} from "@/lib/schedule";

/**
 * Reshape the week.
 *
 * The template shipped with the app is a starting point; the first week of a
 * semester rewrites it. Each weekday is edited as a draft in a sheet and only
 * lands when it is coherent — sorted, every block ending after it starts,
 * nothing overlapping — because the whole spine assumes at most one current
 * block and a saved overlap would quietly break focus everywhere.
 *
 * Labels and kinds are load-bearing, not decoration: habits anchor to labels
 * ("Wake", "Quiet Time", "Deep Work", "Wind Down") and the sessions page is
 * built from kind=training. The hint under the list says so, because renaming
 * "Wind Down" should be a choice, not an accident.
 */

/** Monday-first, matching every other week view in the app. */
const DAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const DAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAME = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const KIND_ORDER: BlockKind[] = ["training", "class", "work", "personal", "rest"];
const KIND_TAG: Record<BlockKind, string> = {
  training: "TRN",
  class: "CLS",
  work: "WRK",
  personal: "PSN",
  rest: "RST",
};

/** "HH:mm" + minutes, clamped to the day. */
function addMinutes(t: string, mins: number): string {
  const m = Math.min(23 * 60 + 59, toMinutes(t) + mins);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function sameBlocks(a: Block[], b: Block[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (x, i) =>
        x.start === b[i].start &&
        x.end === b[i].end &&
        x.label === b[i].label &&
        x.kind === b[i].kind &&
        (x.brief ?? "") === (b[i].brief ?? ""),
    )
  );
}

/** 16px inputs — anything smaller makes iOS zoom the sheet on focus. */
const FIELD =
  "rounded-sm border border-line-soft bg-surface-2 px-2 py-2.5 text-[16px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus:border-line-mid";

function BlockRow({
  b,
  onChange,
  onRemove,
}: {
  b: Block;
  onChange: (next: Block) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-1.5">
      <input
        type="time"
        value={b.start}
        aria-label="starts"
        onChange={(e) => e.target.value && onChange({ ...b, start: e.target.value })}
        className={`${FIELD} w-[74px] font-mono tabular-nums`}
      />
      <input
        type="time"
        value={b.end}
        aria-label="ends"
        onChange={(e) => e.target.value && onChange({ ...b, end: e.target.value })}
        className={`${FIELD} w-[74px] font-mono tabular-nums`}
      />
      <input
        type="text"
        value={b.label}
        aria-label="block name"
        placeholder="name"
        enterKeyHint="done"
        onChange={(e) => onChange({ ...b, label: e.target.value })}
        className={`${FIELD} min-w-0 flex-1`}
      />
      <button
        type="button"
        aria-label={`kind: ${b.kind} — tap to change`}
        onClick={() => {
          haptic(4);
          const next =
            KIND_ORDER[(KIND_ORDER.indexOf(b.kind) + 1) % KIND_ORDER.length];
          onChange({ ...b, kind: next });
        }}
        className={`mono-xs h-11 w-[46px] shrink-0 rounded-sm border ${
          b.kind === "training"
            ? "border-ink text-ink"
            : "border-line-mid text-ink-3"
        }`}
      >
        {KIND_TAG[b.kind]}
      </button>
      <button
        type="button"
        aria-label={`remove ${b.label || "block"}`}
        onClick={onRemove}
        className="flex h-11 w-9 shrink-0 items-center justify-center rounded-pill text-ink-4 hover:text-bad"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function DayEditor({
  day,
  onClose,
}: {
  day: Weekday | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Block[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (day == null) return;
    // A fresh copy: edits must not lean on object identity with the template.
    setDraft(routineFor(day).map((b) => ({ ...b })));
    setError(null);
  }, [day]);

  const set = useCallback((i: number, next: Block) => {
    setError(null);
    setDraft((d) => d.map((b, j) => (j === i ? next : b)));
  }, []);

  const save = () => {
    if (day == null) return;
    const template = WEEKLY_SCHEDULE[day];
    // Saving the template back is a reset, not an override — otherwise a
    // curious open-and-save would pin this day against future defaults.
    const problem = sameBlocks(
      [...draft].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
      template,
    )
      ? setRoutineDay(day, null)
      : setRoutineDay(day, draft);
    if (problem) {
      setError(problem);
      haptic(4);
      return;
    }
    haptic([14, 20, 8]);
    onClose();
  };

  const name = day == null ? "" : DAY_NAME[day];

  return (
    <Sheet open={day != null} onClose={onClose} title={`${name} routine`} tall>
      {day == null ? null : (
        <div className="pb-2">
          <div className="divide-y divide-line-soft/60">
            {draft.map((b, i) => (
              <BlockRow
                key={i}
                b={b}
                onChange={(next) => set(i, next)}
                onRemove={() => {
                  haptic(6);
                  setError(null);
                  setDraft((d) => d.filter((_, j) => j !== i));
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              haptic(6);
              setError(null);
              setDraft((d) => {
                const last = d[d.length - 1];
                const start = last ? last.end : "08:00";
                return [
                  ...d,
                  { start, end: addMinutes(start, 60), label: "", kind: "personal" },
                ];
              });
            }}
            className="mono-xs mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-line-mid text-ink-2 hover:border-accent hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" /> add block
          </button>

          {/* Anchors are load-bearing; say so where the renaming happens. */}
          <p className="mono-xs mt-3 text-center text-ink-4">
            letters anchor to Wake · Quiet Time · Deep Work · Wind Down · TRN
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                haptic(6);
                setError(null);
                setDraft(WEEKLY_SCHEDULE[day].map((b) => ({ ...b })));
              }}
              className="mono-xs min-h-11 flex-1 rounded-sm border border-line-mid text-ink-3 hover:text-ink-2"
            >
              template
            </button>
            {DAY_ORDER.filter((d) => d !== day).map((d) => (
              <button
                key={d}
                type="button"
                aria-label={`copy ${DAY_NAME[d]}`}
                onClick={() => {
                  haptic(6);
                  setError(null);
                  setDraft(routineFor(d).map((b) => ({ ...b })));
                }}
                className="mono-xs min-h-11 w-9 rounded-sm border border-line-soft text-ink-4 hover:border-line-mid hover:text-ink-2"
              >
                {DAY_LETTER[d]}
              </button>
            ))}
          </div>

          {error ? (
            <p className="mono-xs mt-3 text-center text-bad">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={save}
            className="mono-xs mt-3 min-h-12 w-full rounded-sm border border-accent bg-ink/[0.08] text-ink"
          >
            save {name.toLowerCase()}
          </button>
        </div>
      )}
    </Sheet>
  );
}

export function RoutineSection() {
  const [editing, setEditing] = useState<Weekday | null>(null);
  // Re-read the edited markers whenever an override lands.
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(ROUTINE_CHANGED, bump);
    return () => window.removeEventListener(ROUTINE_CHANGED, bump);
  }, []);

  return (
    <section>
      <h3 className="kicker">Routine</h3>
      <div className="mt-3 flex gap-2">
        {DAY_ORDER.map((d) => {
          const edited = routineEdited(d);
          return (
            <button
              key={d}
              type="button"
              aria-label={`${DAY_NAME[d]}${edited ? ", edited" : ""} — edit routine`}
              onClick={() => {
                haptic(6);
                setEditing(d);
              }}
              className={`relative min-h-11 flex-1 rounded-sm border font-mono text-[11px] ${
                edited
                  ? "border-accent text-ink"
                  : "border-line-mid text-ink-3 hover:text-ink-2"
              }`}
            >
              {DAY_LETTER[d]}
              {edited ? (
                <span
                  aria-hidden
                  className="absolute inset-x-3 bottom-[6px] h-[1.5px] rounded-pill bg-ink"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <DayEditor day={editing} onClose={() => setEditing(null)} />
    </section>
  );
}
