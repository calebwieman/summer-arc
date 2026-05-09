"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  { href: "/money/new", label: "Money", emoji: "💵" },
  { href: "/aigentic/outreach", label: "Outreach", emoji: "⚡" },
  { href: "/body/run", label: "Run", emoji: "🏃" },
  { href: "/body/lift", label: "Lift", emoji: "🏋️" },
  { href: "/body/bible", label: "Bible", emoji: "📖" },
];

export function QuickLog() {
  return (
    <div className="px-5 my-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-dim)] font-medium mb-3 px-1">
        QUICK LOG
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex-shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent-dim)] transition-colors text-sm font-medium text-[var(--text)]"
          >
            <span className="text-base leading-none">{a.emoji}</span>
            <span>{a.label}</span>
            <Plus size={14} className="text-[var(--text-dim)] ml-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
