"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Download, FileText, Trash2, Upload } from "lucide-react";
import { HabitEditor } from "@/components/settings/habit-editor";
import {
  clearAllLogs,
  exportBackup,
  exportCsv,
  getLastExportAt,
  getVerseEnabled,
  importBackup,
  setLastExportAt,
  setVerseEnabled,
} from "@/lib/storage";

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [verse, setVerse] = useState(true);
  const [lastExport, setLastExport] = useState<string | null>(null);

  useEffect(() => {
    setVerse(getVerseEnabled());
    setLastExport(getLastExportAt());
  }, []);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }

  function handleExport() {
    const bundle = exportBackup();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `summer-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportAt();
    setLastExport(new Date().toISOString());
    flash("Backup downloaded.");
  }

  function handleExportCsv() {
    const csv = exportCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `summer-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportAt();
    setLastExport(new Date().toISOString());
    flash("CSV downloaded.");
  }

  function handleImport(file: File, merge: boolean) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const result = importBackup(parsed, { merge });
        flash(
          `Restored ${result.daily} day${result.daily === 1 ? "" : "s"}` +
            (result.weekly ? ` · ${result.weekly} weekly` : ""),
        );
      } catch {
        flash("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  }

  function handleClear() {
    if (
      !window.confirm(
        "Erase ALL local data? This cannot be undone. Export a backup first if you want it.",
      )
    )
      return;
    clearAllLogs();
    flash("All data erased.");
  }

  function toggleVerse() {
    const next = !verse;
    setVerse(next);
    setVerseEnabled(next);
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-md px-5 pb-32 pt-10 space-y-10"
    >
      <header>
        <p className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Settings
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight text-foreground">
          Settings
        </h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Habits
        </h2>
        <HabitEditor />
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Display
        </h2>
        <button
          type="button"
          onClick={toggleVerse}
          aria-pressed={verse}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4 text-left transition-colors hover:border-accent/60"
        >
          <span className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-accent" />
            <span>
              <span className="block text-[15px] text-foreground">
                Verse of the day
              </span>
              <span className="block text-[12px] text-muted">
                Show a daily verse above Today.
              </span>
            </span>
          </span>
          <span
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              verse ? "bg-accent" : "bg-border"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-background transition-transform ${
                verse ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Backup &amp; data
        </h2>
        <p className="text-[13px] leading-6 text-muted">
          Your logs live in this device&rsquo;s storage only — there&rsquo;s no
          cloud sync. Export a backup every so often. Last export:{" "}
          <span className="text-foreground">{formatRelative(lastExport)}</span>.
        </p>

        <button
          type="button"
          onClick={handleExport}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4 text-left transition-colors hover:border-accent/60"
        >
          <span className="flex items-center gap-3">
            <Download className="h-5 w-5 text-accent" />
            <span className="text-[15px] text-foreground">Export backup</span>
          </span>
          <span className="text-[12px] text-muted">JSON</span>
        </button>

        <button
          type="button"
          onClick={handleExportCsv}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4 text-left transition-colors hover:border-accent/60"
        >
          <span className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-accent" />
            <span className="text-[15px] text-foreground">Export to CSV</span>
          </span>
          <span className="text-[12px] text-muted">Spreadsheet</span>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file, true);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4 text-left transition-colors hover:border-accent/60"
        >
          <span className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-accent" />
            <span className="text-[15px] text-foreground">Import backup</span>
          </span>
          <span className="text-[12px] text-muted">Merge</span>
        </button>
        <p className="px-1 text-[12px] leading-5 text-muted/80">
          Import merges with existing data — same-date entries are overwritten.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-muted">
          Danger zone
        </h2>
        <button
          type="button"
          onClick={handleClear}
          className="flex w-full items-center justify-between rounded-2xl border border-red-900/40 bg-surface px-5 py-4 text-left transition-colors hover:border-red-700/60"
        >
          <span className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-red-400" />
            <span className="text-[15px] text-red-300">
              Erase all local data
            </span>
          </span>
        </button>
      </section>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto max-w-md px-5">
          <div className="rounded-xl border border-border bg-background/95 px-4 py-2 text-center text-[13px] text-foreground backdrop-blur">
            {toast}
          </div>
        </div>
      ) : null}
    </motion.main>
  );
}
