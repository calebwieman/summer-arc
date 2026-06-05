"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getVerseEnabled } from "@/lib/storage";
import { getVerseOfTheDay, type Verse } from "@/lib/verse";

export function VerseBanner({ date }: { date: string }) {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(getVerseEnabled());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getVerseOfTheDay(date).then((v) => {
      if (!cancelled) setVerse(v);
    });
    return () => {
      cancelled = true;
    };
  }, [date, enabled]);

  if (!enabled || !verse) return null;

  return (
    <motion.aside
      key={verse.ref}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border bg-surface px-5 py-4"
    >
      <p className="text-[14px] leading-6 italic text-foreground/90">
        &ldquo;{verse.text}&rdquo;
      </p>
      <p className="mt-1.5 text-[12px] uppercase tracking-[0.12em] text-muted">
        {verse.ref}
      </p>
    </motion.aside>
  );
}
