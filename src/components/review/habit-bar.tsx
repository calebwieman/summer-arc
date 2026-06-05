"use client";

import { motion } from "framer-motion";

interface HabitBarProps {
  label: string;
  count: number;
  total: number;
  delta?: number;
}

export function HabitBar({ label, count, total, delta }: HabitBarProps) {
  const pct = total === 0 ? 0 : Math.min(100, (count / total) * 100);
  const complete = count >= total && total > 0;

  return (
    <div className="flex items-center gap-3 min-h-8">
      <span className="flex-1 text-[14px] tracking-tight text-foreground">
        {label}
      </span>
      {delta !== undefined && delta !== 0 ? (
        <span
          className={`text-[11px] tabular-nums w-8 text-right ${
            delta > 0 ? "text-accent" : "text-muted"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      ) : null}
      <div className="h-1.5 w-20 rounded-full bg-border overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${complete ? "bg-accent" : "bg-accent/70"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="text-[13px] text-muted tabular-nums w-10 text-right">
        {count}/{total}
      </span>
    </div>
  );
}
