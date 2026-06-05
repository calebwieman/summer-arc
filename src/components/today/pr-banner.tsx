"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trophy, X } from "lucide-react";
import type { PrFlag } from "@/lib/stats";

interface PrBannerProps {
  prs: PrFlag[];
  onDismiss: () => void;
}

function formatPr(pr: PrFlag): string {
  switch (pr.kind) {
    case "runMiles":
      return `${pr.label}: ${pr.value} mi`;
    case "coldCalls":
      return `${pr.label}: ${pr.value}`;
    case "plungeMinutes":
      return `${pr.label}: ${pr.value} min`;
    case "habitsChecked":
      return `${pr.label}: ${pr.value} checked`;
  }
}

export function PrBanner({ prs, onDismiss }: PrBannerProps) {
  return (
    <AnimatePresence>
      {prs.length > 0 ? (
        <motion.div
          key="pr-banner"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3"
          role="status"
        >
          <Trophy className="h-4 w-4 mt-0.5 text-accent shrink-0" />
          <div className="flex-1 space-y-0.5">
            <p className="text-[12px] uppercase tracking-[0.12em] text-accent">
              Personal record
            </p>
            {prs.map((pr) => (
              <p key={pr.kind} className="text-[14px] text-foreground">
                {formatPr(pr)}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
