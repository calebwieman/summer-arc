"use client";

import { useState, useTransition } from "react";
import { AlarmClock, Footprints, Dumbbell, BookOpen, PhoneOff, Check } from "lucide-react";
import { Card, CardHeader, CardBody, CardLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toggleDaily } from "@/app/actions/daily";

interface State {
  woke_by_target: boolean;
  ran: boolean;
  lifted: boolean;
  bible: boolean;
  doomscroll_under: boolean;
}

interface Props {
  date: string;
  initial: State;
  wakeTime: string;
  doomscrollMin: number;
}

const ICONS = {
  woke_by_target: AlarmClock,
  ran: Footprints,
  lifted: Dumbbell,
  bible: BookOpen,
  doomscroll_under: PhoneOff,
};

export function DailyFive({ date, initial, wakeTime, doomscrollMin }: Props) {
  const [state, setState] = useState<State>(initial);
  const [, startTransition] = useTransition();

  const items: Array<{ key: keyof State; label: string }> = [
    { key: "woke_by_target", label: `Wake by ${wakeTime}` },
    { key: "ran", label: "Run" },
    { key: "lifted", label: "Lift" },
    { key: "bible", label: "Bible" },
    { key: "doomscroll_under", label: `Phone < ${doomscrollMin}m` },
  ];

  const completed = items.filter((i) => state[i.key]).length;

  function toggle(key: keyof State) {
    const next = { ...state, [key]: !state[key] };
    setState(next); // optimistic
    startTransition(() => {
      toggleDaily(date, key, next[key]).catch(() => {
        // rollback on error
        setState(state);
      });
    });
  }

  return (
    <Card className="mx-5 my-3">
      <CardHeader className="flex items-center justify-between">
        <CardLabel>DAILY 5</CardLabel>
        <div className="text-xs text-[var(--text-muted)] tabular">
          <span className="text-[var(--accent)] font-semibold">{completed}</span>
          <span className="text-[var(--text-dim)]"> / 5</span>
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        {items.map(({ key, label }) => {
          const Icon = ICONS[key];
          const done = state[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all active:scale-[0.99]",
                done
                  ? "bg-[var(--accent-glow)] border-[var(--accent-dim)]"
                  : "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-bright)]"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center",
                  done
                    ? "bg-[var(--accent)] text-black"
                    : "bg-[var(--surface-3)] text-[var(--text-muted)]"
                )}
              >
                {done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
              </div>
              <span
                className={cn(
                  "flex-1 text-left text-sm font-medium",
                  done ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                )}
              >
                {label}
              </span>
              {done && (
                <span className="text-[10px] uppercase tracking-wider text-[var(--accent-bright)] font-semibold">
                  DONE
                </span>
              )}
            </button>
          );
        })}
      </CardBody>
    </Card>
  );
}
