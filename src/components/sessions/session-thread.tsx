"use client";

import { useMemo } from "react";
import { getAllDailyLogs } from "@/lib/storage";
import { trainingBlockOn } from "@/lib/schedule";
import { formatHeaderDate } from "@/lib/today";
import { Sheet } from "@/components/ui/sheet";

/**
 * Every note ever written for one session type, newest first.
 *
 * One previous note tells you nothing about direction; three tell you whether
 * the build is working — `6×800 @ 5:42`, then `@ 5:38`, then `5×1k @ 3:52`.
 * The paces are already being written down (the Hyrox brief literally says
 * "log the splits"), and until now the only route back to them was remembering
 * a word and typing it into the history search.
 *
 * A sheet rather than a page, and deliberately: sheets mount as siblings of the
 * surface stack, so this one is allowed to scroll without taking a gesture from
 * anything. A list of unknown length has no business on a locked page.
 */
export function SessionThread({
  label,
  onClose,
}: {
  /** The session type to show, or null when closed. */
  label: string | null;
  onClose: () => void;
}) {
  const entries = useMemo(() => {
    if (!label) return [];
    return getAllDailyLogs()
      .filter((l) => {
        const note = l.trainingNote?.trim();
        if (!note) return false;
        return trainingBlockOn(l.date)?.label === label;
      })
      .reverse();
  }, [label]);

  return (
    <Sheet open={label != null} onClose={onClose} title={label ?? "Session"} tall>
      {entries.length === 0 ? (
        <p className="mono-xs text-ink-3">
          Nothing written yet. The session note on the day screen lands here.
        </p>
      ) : (
        <ol className="space-y-4">
          {entries.map((l) => (
            <li key={l.date} className="border-l border-line-mid pl-3">
              <p className="mono-xs text-ink-4">{formatHeaderDate(l.date)}</p>
              <p className="mt-1 text-[15px] leading-snug text-ink-2">
                {l.trainingNote?.trim()}
              </p>
            </li>
          ))}
        </ol>
      )}
      <p className="mono-xs mt-6 text-ink-4">
        {entries.length} {entries.length === 1 ? "session" : "sessions"} logged
      </p>
    </Sheet>
  );
}
