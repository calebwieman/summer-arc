"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface HabitRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export function HabitRow({ label, checked, onToggle }: HabitRowProps) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="flex w-full items-center gap-4 px-5 py-3.5 min-h-14 text-left rounded-xl hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
    >
      <motion.span
        aria-hidden
        animate={{
          backgroundColor: checked ? "#f59e0b" : "rgba(255,255,255,0)",
          borderColor: checked ? "#f59e0b" : "#3f3f46",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
      >
        <motion.span
          initial={false}
          animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 30 }}
          className="flex items-center justify-center"
        >
          <Check className="h-3.5 w-3.5 text-[#0a0a0a]" strokeWidth={3} />
        </motion.span>
      </motion.span>
      <motion.span
        animate={{ opacity: checked ? 0.4 : 1 }}
        className={`flex-1 text-[15px] tracking-tight ${checked ? "line-through" : ""}`}
      >
        {label}
      </motion.span>
    </motion.button>
  );
}
