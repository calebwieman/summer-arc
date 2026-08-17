"use client";

import { useEffect } from "react";

const ASKED_KEY = "standard:notif-asked";
const NIGHTLY_TAG = "standard-nightly-checkin";

function nextNightlyAt9pm(now: Date): Date {
  const target = new Date(now);
  target.setHours(21, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/** Single 21:00 check-in reminder, timed to the Wind Down block. */
export function NightlyReminder() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const timers: number[] = [];
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const now = new Date();
      const delay = nextNightlyAt9pm(now).getTime() - now.getTime();
      if (delay <= 0 || delay > 2 ** 31 - 1) return;

      const id = window.setTimeout(() => {
        if (cancelled) return;
        if (Notification.permission === "granted") {
          new Notification("Log today", {
            body: "Wind down. Close the day out.",
            tag: NIGHTLY_TAG,
          });
        }
        schedule();
      }, delay);
      timers.push(id);
    };

    const permission = Notification.permission;
    if (permission === "granted") {
      schedule();
    } else if (permission !== "denied" && !localStorage.getItem(ASKED_KEY)) {
      // Mark asked only once the prompt actually resolves. Writing it up front
      // meant a dismissed-or-interrupted prompt permanently disabled the 21:00
      // reminder with no way back.
      Notification.requestPermission()
        .then((p) => {
          localStorage.setItem(ASKED_KEY, "true");
          if (p === "granted" && !cancelled) schedule();
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  return null;
}
