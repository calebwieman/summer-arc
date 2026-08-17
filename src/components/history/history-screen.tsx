"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatHeaderDate } from "@/lib/today";
import { getAllDailyLogs } from "@/lib/storage";
import { overallStats } from "@/lib/stats";
import { MonthGrid } from "./month-grid";
import { YearTrace } from "./year-trace";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="font-mono text-[22px] font-bold tabular-nums leading-none text-ink">
        {value}
      </p>
      <p className="mono-xs mt-1.5 text-ink-3">{label}</p>
    </div>
  );
}

/**
 * Everything behind today: the totals, a month you can page through, the year
 * as a trace, and a text search over what you wrote.
 *
 * It is a surface, not a route — reached by pulling past the record, so the app
 * is still one screen.
 */
export function HistoryScreen({
  today,
  version,
  onPick,
}: {
  today: string;
  /** Bumped after any write, so every child recounts. */
  version: number;
  onPick: (date: string) => void;
}) {
  const [month, setMonth] = useState(today);
  const [query, setQuery] = useState("");

  const stats = useMemo(() => overallStats(today), [today, version]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return getAllDailyLogs()
      .filter(
        (l) =>
          l.note?.toLowerCase().includes(q) ||
          l.trainingNote?.toLowerCase().includes(q),
      )
      .reverse()
      .slice(0, 20);
  }, [query, version]);

  return (
    <div className="space-y-9 pb-10">
      <section className="flex items-start gap-2">
        <Stat value={String(stats.daysLogged)} label="days" />
        <Stat
          value={`${Math.round(stats.averageRatio * 100)}%`}
          label="average"
        />
        <Stat value={String(stats.perfectDays)} label="clean" />
      </section>

      <MonthGrid
        month={month}
        today={today}
        onMonth={setMonth}
        onPick={onPick}
        version={version}
      />

      <YearTrace today={today} version={version} onPick={onPick} />

      <section>
        <h3 className="kicker text-center">Search</h3>
        <label className="mt-3 flex items-center gap-2 rounded-sm border border-line-soft bg-surface-2 px-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="a word from a note"
            enterKeyHint="search"
            className="w-full bg-transparent py-3 text-[16px] text-ink placeholder:text-ink-3 outline-none"
          />
        </label>

        {query.trim().length >= 2 ? (
          <div className="mt-3 space-y-2">
            {results.length === 0 ? (
              <p className="mono-xs text-center text-ink-3">nothing matches</p>
            ) : (
              results.map((l) => (
                <button
                  key={l.date}
                  type="button"
                  onClick={() => onPick(l.date)}
                  className="block w-full rounded-sm border border-line-soft px-3 py-2.5 text-left"
                >
                  <span className="mono-xs block text-ink-3">
                    {formatHeaderDate(l.date)}
                  </span>
                  <span className="mt-1 block truncate text-[14px] text-ink-2">
                    {l.note?.trim() || l.trainingNote?.trim()}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
