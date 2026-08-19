"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Archive } from "@/components/review/archive";
import { useTheme, type ThemePref } from "@/components/theme/theme-provider";
import { COMMIT_STYLES, useCommitStyle } from "@/lib/commit-style";
import { haptic } from "@/lib/haptics";
import { TICK } from "@/lib/motion";

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function Appearance() {
  const { pref, setTheme, ready } = useTheme();
  return (
    <section>
      <h3 className="kicker">Appearance</h3>
      <div className="mt-3 flex gap-2">
        {OPTIONS.map((o) => {
          const active = ready && pref === o.value;
          return (
            <motion.button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                haptic(8);
                setTheme(o.value);
              }}
              whileTap={{ scale: 0.97 }}
              transition={TICK}
              className={`min-h-11 flex-1 rounded-sm border font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                active
                  ? "border-accent bg-ink/[0.10] text-ink"
                  : "border-line-mid text-ink-3 hover:text-ink-2"
              }`}
            >
              {o.label}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * How a habit gets committed.
 *
 * The drag came first and reads well, but it competes with the swipe that moves
 * between surfaces and asks for most of the track width — clunky in the one
 * situation this app is built for, a thumb at 04:45. All three gestures are
 * built; this is the only honest way to settle which one is right.
 */
function CommitStyle() {
  const [style, setStyle] = useCommitStyle();
  const active = COMMIT_STYLES.find((s) => s.value === style);
  return (
    <section>
      <h3 className="kicker">Commit style</h3>
      <div className="mt-3 flex gap-2">
        {COMMIT_STYLES.map((o) => {
          const on = style === o.value;
          return (
            <motion.button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                haptic(8);
                setStyle(o.value);
              }}
              whileTap={{ scale: 0.97 }}
              transition={TICK}
              className={`min-h-11 flex-1 rounded-sm border font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                on
                  ? "border-accent bg-ink/[0.10] text-ink"
                  : "border-line-mid text-ink-3 hover:text-ink-2"
              }`}
            >
              {o.label}
            </motion.button>
          );
        })}
      </div>
      {/* What the thumb is being asked to do, in words, so the choice is
          answerable without leaving the sheet to go and try it. */}
      <p className="mono-xs mt-2.5 text-center text-ink-3">{active?.hint}</p>
    </section>
  );
}

/**
 * The nightly reminder, and whether it can actually reach you.
 *
 * `nightly-reminder.tsx` asks for notification permission silently on first
 * mount and records that it asked. If the answer was a reflexive "don't allow",
 * the 21:00 check-in is gone permanently, the app never mentions it again, and
 * there was no path anywhere in the UI to anything about it — a shipped feature
 * with no settings surface at all. Read live from `Notification.permission` so
 * it cannot go stale.
 */
function Notifications() {
  const [state, setState] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission);
  }, []);

  const words =
    state === "granted"
      ? "on · a check-in at 10:00p"
      : state === "denied"
        ? "blocked — iOS Settings → Standard → Notifications"
        : state === "unsupported"
          ? "this browser has no notifications"
          : "not asked yet";

  return (
    <section>
      <h3 className="kicker">Nightly check-in</h3>
      <p className="mono-xs mt-2 text-ink-3">{words}</p>
      {state === "default" ? (
        <button
          type="button"
          onClick={() => {
            haptic(8);
            Notification.requestPermission().then(setState);
          }}
          className="mono-xs mt-3 flex min-h-11 w-full items-center justify-center rounded-sm border border-line-mid text-ink-2 hover:border-accent hover:text-ink"
        >
          turn it on
        </button>
      ) : null}
    </section>
  );
}

/**
 * The machine behind the instrument: how it looks, and how it survives.
 *
 * Two swipes left from the day, and deliberately the furthest thing from it —
 * this is opened perhaps twice a semester, and everything on it is either a
 * one-off choice or an insurance policy.
 */
export function SystemScreen() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-7">
      <Appearance />
      <CommitStyle />
      <Notifications />
      <Archive />
      {/* Which build is actually running, readable from the phone. It is the
          only way to tell whether a deploy has landed. */}
      <p className="mono-xs mt-auto shrink-0 text-center text-ink-4">
        build {process.env.NEXT_PUBLIC_BUILD_SHA} ·{" "}
        {process.env.NEXT_PUBLIC_BUILD_AT} UTC
      </p>
    </div>
  );
}
