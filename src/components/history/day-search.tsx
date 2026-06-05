"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Search, X } from "lucide-react";
import { getAllDailyLogs } from "@/lib/storage";

interface DaySearchProps {
  onSelectDay: (date: string) => void;
}

function snippet(text: string, query: string, max = 80): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, max);
  const start = Math.max(0, idx - 24);
  const end = Math.min(text.length, idx + query.length + 40);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}

export function DaySearch({ onSelectDay }: DaySearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const results = useMemo(() => {
    if (!open || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const logs = getAllDailyLogs();
    return logs
      .map((log) => {
        const fields = [
          log.win,
          log.lesson,
          log.runNotes,
          log.amLiftNotes,
          log.pmLiftNotes,
          log.bibleReading ?? "",
        ];
        const hit = fields.find((f) => f && f.toLowerCase().includes(q));
        if (!hit) return null;
        return { date: log.date, snippet: snippet(hit, q) };
      })
      .filter((r): r is { date: string; snippet: string } => !!r)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  }, [open, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search history"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground hover:border-accent/60 transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="search"
            className="fixed inset-0 z-50 flex items-start justify-center pt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              aria-label="Close search"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              className="relative mx-5 w-full max-w-md rounded-2xl border border-border bg-background overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Search className="h-4 w-4 text-muted shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search wins, lessons, notes…"
                  className="flex-1 min-h-10 bg-transparent text-[15px] text-foreground placeholder:text-muted/60 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {query.trim().length < 2 ? (
                  <p className="px-5 py-8 text-center text-[13px] text-muted">
                    Type at least two characters.
                  </p>
                ) : results.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[13px] text-muted">
                    No matches.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {results.map((r) => (
                      <li key={r.date}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDay(r.date);
                            setOpen(false);
                          }}
                          className="flex w-full flex-col items-start gap-1 px-5 py-3 text-left hover:bg-white/[0.03] transition-colors"
                        >
                          <span className="text-[12px] uppercase tracking-[0.12em] text-muted">
                            {format(parseISO(r.date), "EEE, MMM d, yyyy")}
                          </span>
                          <span className="text-[14px] text-foreground whitespace-pre-wrap line-clamp-2">
                            {r.snippet}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
