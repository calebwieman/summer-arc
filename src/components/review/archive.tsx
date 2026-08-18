"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { haptic } from "@/lib/haptics";
import { daysSinceBackup } from "@/lib/prefs";
import { todayISO } from "@/lib/clock";
import {
  exportBackup,
  exportCsv,
  getAllDailyLogs,
  importBackup,
} from "@/lib/storage";

function download(filename: string, contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next turn so Safari has finished handing the blob off.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Action({
  children,
  onPress,
  tone = "normal",
}: {
  children: React.ReactNode;
  onPress: () => void;
  tone?: "normal" | "warn";
}) {
  return (
    <motion.button
      type="button"
      onClick={onPress}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 520, damping: 32 }}
      className={`min-h-11 flex-1 rounded-sm border px-3 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
        tone === "warn"
          ? "border-warn/60 text-warn hover:bg-warn/10"
          : "border-line-mid text-ink-2 hover:border-accent hover:text-ink"
      }`}
    >
      {children}
    </motion.button>
  );
}

/**
 * The whole record lives in one localStorage bucket on one device. Without a
 * way out of it, a cleared site setting or a lost phone is a lost semester —
 * so the export path is part of the app, not a devtools exercise.
 */
export function Archive() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [standing, setStanding] = useState("backup writes a file you can keep");

  /*
    What the app actually knows about its own safety, instead of the same
    sentence on day one and day three hundred. iOS evicts a PWA's localStorage
    under storage pressure after about a week unopened, and until now nothing
    here could tell you whether a file existed at all.
  */
  useEffect(() => {
    // The day count is already the section's subtitle; this line is only ever
    // about the file, and saying "78 days stored" twice would be noise.
    const since = daysSinceBackup();
    setStanding(
      since == null
        ? "never backed up — one tap writes a file you can keep"
        : since === 0
          ? "backed up today"
          : `last backup ${since}d ago`,
    );
  }, [status]);
  const dayCount = getAllDailyLogs().length;

  const onFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const { daily, migrated, habitsAdded } = importBackup(parsed, {
        merge: true,
      });
      // Naming the habits it brought over matters: they arrive scheduled every
      // day, and knowing which ones appeared is what prompts narrowing them.
      const added =
        habitsAdded.length > 0 ? ` · added ${habitsAdded.join(", ")}` : "";
      setStatus(
        migrated > 0
          ? `${daily} days · ${migrated} converted${added} — reloading`
          : `merged ${daily} ${daily === 1 ? "day" : "days"} — reloading`,
      );
      haptic([16, 24, 10]);
      setTimeout(() => window.location.reload(), 700);
    } catch {
      setStatus("could not read that file");
    } finally {
      setConfirmImport(false);
    }
  };

  return (
    <section className="border-t border-line-soft pt-6 pb-8 text-center">
      <h2 className="kicker">Archive</h2>
      <p className="meta mt-1.5">
        {dayCount} {dayCount === 1 ? "day" : "days"} stored
      </p>

      <div className="mt-5 flex gap-2">
        <Action
          onPress={() => {
            haptic(10);
            download(
              `standard-${todayISO()}.json`,
              JSON.stringify(exportBackup(), null, 2),
              "application/json",
            );
            setStatus("backup saved");
          }}
        >
          Backup
        </Action>
        <Action
          onPress={() => {
            haptic(10);
            download(`standard-${todayISO()}.csv`, exportCsv(), "text/csv");
            setStatus("csv saved");
          }}
        >
          CSV
        </Action>
        <Action
          tone={confirmImport ? "warn" : "normal"}
          onPress={() => {
            if (!confirmImport) {
              setConfirmImport(true);
              setStatus("merges into what is already here");
              return;
            }
            fileRef.current?.click();
          }}
        >
          {confirmImport ? "Choose file" : "Restore"}
        </Action>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <p className="mono-xs mt-4 min-h-4 text-center text-ink-3">
        {status ?? standing}
      </p>
    </section>
  );
}
