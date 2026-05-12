"use client";

import { motion } from "framer-motion";

interface ProgressRingProps {
  count: number;
  total: number;
  size?: number;
}

export function ProgressRing({ count, total, size = 64 }: ProgressRingProps) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total === 0 ? 0 : Math.min(1, count / total);
  const offset = circumference * (1 - pct);
  const complete = count >= total && total > 0;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${count} of ${total} habits complete`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-border)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </svg>
      <motion.div
        animate={complete ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.45 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="text-[15px] font-semibold tracking-tight tabular-nums text-foreground leading-none">
          {count}
          <span className="text-muted font-normal">/{total}</span>
        </span>
      </motion.div>
    </div>
  );
}
