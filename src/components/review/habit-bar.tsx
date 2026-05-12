"use client";

import { motion } from "framer-motion";

interface HabitBarProps {
  label: string;
  count: number;
  total: number;
}

export function HabitBar({ label, count, total }: HabitBarProps) {
  const pct = total === 0 ? 0 : Math.min(100, (count / total) * 100);
  const complete = count >= total && total > 0;

  return (
    <div className="flex items-center gap-3 min-h-8">
      <span className="flex-1 text-[14px] tracking-tight text-foreground">
        {label}
      </span>
      <div className="h-1.5 w-24 rounded-full bg-border overflow-hidden">
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
