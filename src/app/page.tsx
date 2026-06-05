"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, X } from "lucide-react";
import { DayForm } from "@/components/today/day-form";
import { PrBanner } from "@/components/today/pr-banner";
import { ProgressRing } from "@/components/today/progress-ring";
import { VerseBanner } from "@/components/today/verse-banner";
import {
  getDailyLog,
  getHabits,
  getLastExportAt,
  saveDailyLog,
} from "@/lib/storage";
import {
  currentStreak,
  detectPrs,
  habitStreak,
  recentSleepMedian,
  type PrFlag,
} from "@/lib/stats";
import {
  DEFAULT_HABITS,
  formatHeaderDate,
  getTodayString,
  habitsForDate,
  makeEmptyLog,
} from "@/lib/today";
import type { DailyLog, HabitDef } from "@/lib/types";

declare global {
  interface Navigator {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  }
}

const BACKUP_NAG_DISMISS_KEY = "summer:backup-nag-dismissed";
const NAG_AFTER_DAYS = 14;
const MIN_LOGS_BEFORE_NAG = 7;

function shouldNagBackup(): boolean {
  if (typeof window === "undefined") return false;
  const dismissed = window.localStorage.getItem(BACKUP_NAG_DISMISS_KEY);
  if (dismissed) {
    const ts = parseInt(dismissed, 10);
    if (Number.isFinite(ts) && Date.now() - ts < 7 * 86400 * 1000) {
      return false;
    }
  }
  let logCount = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith("summer:daily:")) logCount++;
    if (logCount >= MIN_LOGS_BEFORE_NAG) break;
  }
  if (logCount < MIN_LOGS_BEFORE_NAG) return false;
  const last = getLastExportAt();
  if (!last) return true;
  const lastMs = Date.parse(last);
  if (!Number.isFinite(lastMs)) return true;
  return Date.now() - lastMs > NAG_AFTER_DAYS * 86400 * 1000;
}

export default function HomePage() {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [habits, setHabits] = useState<HabitDef[]>(DEFAULT_HABITS);
  const [streak, setStreak] = useState(0);
  const [sleepSuggestion, setSleepSuggestion] = useState(0);
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});
  const [prs, setPrs] = useState<PrFlag[]>([]);
  const [shownPrKinds, setShownPrKinds] = useState<Set<string>>(new Set());
  const [showBackupNag, setShowBackupNag] = useState(false);

  const todayDate = log?.date ?? getTodayString();

  const visibleHabits = useMemo(
    () => habitsForDate(habits, todayDate),
    [habits, todayDate],
  );

  const checkedCount = useMemo(
    () =>
      log
        ? visibleHabits.reduce((n, h) => (log.habits[h.id] ? n + 1 : n), 0)
        : 0,
    [log, visibleHabits],
  );

  const refreshStreaks = useCallback((list: HabitDef[]) => {
    const map: Record<string, number> = {};
    for (const h of list) map[h.id] = habitStreak(h.id);
    setHabitStreaks(map);
    setStreak(currentStreak());
  }, []);

  useEffect(() => {
    const loadToday = () => {
      const today = getTodayString();
      const habitList = getHabits();
      setHabits(habitList);
      setLog((prev) => {
        if (prev && prev.date === today) return prev;
        const fresh = getDailyLog(today) ?? makeEmptyLog(today, habitList);
        // Apply ?check=habit1,habit2 from URL (Apple Shortcuts entry point).
        const params = new URLSearchParams(window.location.search);
        const checkParam = params.get("check");
        if (checkParam) {
          const requested = checkParam.split(",").map((s) => s.trim());
          const validIds = new Set(habitList.map((h) => h.id));
          const next = { ...fresh, habits: { ...fresh.habits } };
          let changed = false;
          for (const key of requested) {
            if (validIds.has(key) && !next.habits[key]) {
              next.habits[key] = true;
              changed = true;
            }
          }
          if (changed) saveDailyLog(next);
          window.history.replaceState({}, "", window.location.pathname);
          return next;
        }
        return fresh;
      });
      refreshStreaks(habitList);
      setSleepSuggestion(recentSleepMedian());
      setShowBackupNag(shouldNagBackup());
    };
    loadToday();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }
      loadToday();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", loadToday);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", loadToday);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, [refreshStreaks]);

  // Live app badge
  useEffect(() => {
    if (!log) return;
    if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
      if (checkedCount > 0) {
        navigator.setAppBadge?.(checkedCount).catch(() => {});
      } else {
        navigator.clearAppBadge?.().catch(() => {});
      }
    }
  }, [checkedCount, log]);

  if (!log) {
    return <main className="min-h-dvh" aria-hidden />;
  }

  const update = (patch: Partial<DailyLog>) => {
    setLog((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveDailyLog(next);

      const fresh = detectPrs(next).filter((p) => !shownPrKinds.has(p.kind));
      if (fresh.length > 0) {
        setPrs((existing) => {
          const seen = new Set(existing.map((p) => p.kind));
          return [...existing, ...fresh.filter((p) => !seen.has(p.kind))];
        });
        setShownPrKinds((s) => {
          const ns = new Set(s);
          for (const p of fresh) ns.add(p.kind);
          return ns;
        });
      }

      refreshStreaks(habits);
      return next;
    });
  };

  const dismissBackupNag = () => {
    window.localStorage.setItem(
      BACKUP_NAG_DISMISS_KEY,
      String(Date.now()),
    );
    setShowBackupNag(false);
  };

  return (
    <motion.main
      key={log.date}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-md px-5 pb-32 pt-10 space-y-8"
    >
      {/* Date header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] uppercase tracking-[0.18em] text-muted">
            Today
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight text-foreground">
            {formatHeaderDate(log.date)}
          </h1>
          {streak > 0 ? (
            <span className="mt-2 inline-flex items-center gap-1 text-[12px] text-accent">
              <Flame className="h-3.5 w-3.5" />
              <span className="tabular-nums font-medium">{streak}</span>
              <span className="text-muted">
                day{streak === 1 ? "" : "s"} streak
              </span>
            </span>
          ) : null}
        </div>
        <ProgressRing count={checkedCount} total={visibleHabits.length} />
      </header>

      <VerseBanner date={log.date} />

      <AnimatePresence>
        {showBackupNag ? (
          <motion.div
            key="backup-nag"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
            role="status"
          >
            <div className="flex-1 text-[13px] text-foreground">
              It&rsquo;s been a while since your last backup.{" "}
              <Link href="/settings" className="text-accent underline">
                Export now
              </Link>
              .
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissBackupNag}
              className="text-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PrBanner prs={prs} onDismiss={() => setPrs([])} />

      <DayForm
        log={log}
        habits={habits}
        habitStreaks={habitStreaks}
        sleepSuggestion={sleepSuggestion}
        onChange={update}
      />
    </motion.main>
  );
}
