"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatHeaderDate } from "@/lib/today";
import { getAllDailyLogs } from "@/lib/storage";
import { overallStats } from "@/lib/stats";
import { MonthGrid } from "./month-grid";
import { YearTrace } from "./year-trace";

/** Enough to pick one out; more would need a scroller, and this page has none. */
const MAX_RESULTS = 3;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="font-mono text-[20px] font-bold tabular-nums leading-none text-ink">
        {value}
      </p>
      <p className="mono-xs mt-1.5 text-ink-3">{label}</p>
    </div>
  );
}

/**
 * Everything behind today: totals, a month you can page through, the year as a
 * trace, and a text search over what you wrote.
 *
 * A locked page. Nothing here scrolls, which is the whole reason the surface
 * feels solid under a swipe — a scroll box would take the vertical gesture from
 * the stack before it ever reached it. That constrains the layout: the parts
 * are fixed, and the one region that varies swaps its contents rather than
 * changing height, so typing a search never makes the page move.
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

  const q = query.trim().toLowerCase();
  const searching = q.length >= 2;

  const results = useMemo(() => {
    if (!searching) return [];
    return getAllDailyLogs()
      .filter(
        (l) =>
          l.note?.toLowerCase().includes(q) ||
          l.trainingNote?.toLowerCase().includes(q),
      )
      .reverse()
      .slice(0, MAX_RESULTS);
  }, [q, searching, version]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 pb-2">
      <section className="flex shrink-0 items-start gap-2">
        <Stat value={String(stats.daysLogged)} label="days" />
        <Stat
          value={`${Math.round(stats.averageRatio * 100)}%`}
          label="average"
        />
        <Stat value={String(stats.perfectDays)} label="clean" />
      </section>

      <div className="shrink-0">
        <MonthGrid
          month={month}
          today={today}
          onMonth={setMonth}
          onPick={onPick}
          version={version}
        />
      </div>

      {/* One region, two occupants. The year trace lives here until a search is
          running, and then the results take the same space — so the page holds
          its shape instead of growing a list and pushing itself off-screen. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
        {searching ? (
          <section>
            <h3 className="kicker text-center">
              {results.length > 0 ? "Matches" : "No match"}
            </h3>
            <div className="mt-3 space-y-1.5">
              {results.map((l) => (
                <button
                  key={l.date}
                  type="button"
                  onClick={() => onPick(l.date)}
                  className="block w-full rounded-sm border border-line-soft px-3 py-1.5 text-left"
                >
                  <span className="mono-xs block text-ink-3">
                    {formatHeaderDate(l.date)}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink-2">
                    {l.note?.trim() || l.trainingNote?.trim()}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="drop-when-short">
            <YearTrace today={today} version={version} onPick={onPick} />
          </div>
        )}
      </div>

      {/* Last, so the keyboard rises into the space below it rather than over
          it — h-dvh shrinks with the keyboard and the flexible region above
          gives up its height first. */}
      <label className="flex shrink-0 items-center gap-2 rounded-sm border border-line-soft bg-surface-2 px-3">
        <Search className="h-3.5 w-3.5 shrink-0 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="a word from a note"
          enterKeyHint="search"
          className="w-full bg-transparent py-3 text-[16px] text-ink placeholder:text-ink-3 outline-none"
        />
      </label>
    </div>
  );
}
