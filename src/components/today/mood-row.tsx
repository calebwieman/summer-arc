"use client";

import { motion } from "framer-motion";

interface MoodRowProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

const DOTS = [1, 2, 3, 4, 5];

export function MoodRow({ value, onChange }: MoodRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-3.5">
      <span className="text-[14px] text-foreground">Energy</span>
      <div className="flex items-center gap-1.5">
        {DOTS.map((n) => {
          const active = value !== undefined && value >= n;
          return (
            <motion.button
              key={n}
              type="button"
              aria-label={`Set energy to ${n}`}
              aria-pressed={value === n}
              onClick={() => onChange(value === n ? undefined : n)}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="flex h-9 w-9 items-center justify-center"
            >
              <motion.span
                animate={{
                  backgroundColor: active ? "#f59e0b" : "rgba(255,255,255,0)",
                  borderColor: active ? "#f59e0b" : "#3f3f46",
                  scale: value === n ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="h-3 w-3 rounded-full border-2"
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
