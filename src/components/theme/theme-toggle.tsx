"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePref } from "./theme-provider";

const ORDER: ThemePref[] = ["system", "light", "dark"];
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

/**
 * Cycles System → Light → Dark. Mono/uppercase/square, per the house language;
 * the only colour it can ever paint is the ink-derived accent on hover.
 */
export function ThemeToggle() {
  const { pref, setTheme, ready } = useTheme();
  const Icon = ICON[pref];

  return (
    <button
      type="button"
      onClick={() => setTheme(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length])}
      aria-label={`Theme: ${pref}. Tap to change.`}
      className="inline-flex min-h-11 items-center gap-2 border border-line-mid px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-2 transition-colors duration-150 ease-signature hover:border-accent hover:bg-accent hover:text-accent-fg"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {/* Rendered post-mount only — the label depends on localStorage. */}
      <span className="tabular-nums">{ready ? pref : ""}</span>
    </button>
  );
}
