"use client";

import { useEffect } from "react";

const ASKED_KEY = "summer:notif-asked";
const SUNDAY_TAG = "summer-weekly-review";
const NIGHTLY_TAG = "summer-nightly-checkin";

function nextSundayAt7pm(now: Date): Date {
  const target = new Date(now);
  if (now.getDay() === 0) {
    target.setHours(19, 0, 0, 0);
    if (target.getTime() > now.getTime()) return target;
  }
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  target.setDate(now.getDate() + daysUntilSunday);
  target.setHours(19, 0, 0, 0);
  return target;
}

function nextNightlyAt9pm(now: Date): Date {
  const target = new Date(now);
  target.setHours(21, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

export function NotificationScheduler() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const timers: number[] = [];
    let cancelled = false;

    const scheduleAt = (
      next: (now: Date) => Date,
      title: string,
      body: string,
      tag: string,
    ) => {
      if (cancelled) return;
      const now = new Date();
      const target = next(now);
      const delay = target.getTime() - now.getTime();
      if (delay <= 0 || delay > 2 ** 31 - 1) return;

      const id = window.setTimeout(() => {
        if (cancelled) return;
        if (Notification.permission === "granted") {
          new Notification(title, { body, tag });
        }
        scheduleAt(next, title, body, tag);
      }, delay);
      timers.push(id);
    };

    const start = () => {
      scheduleAt(
        nextSundayAt7pm,
        "Sunday review time",
        "Take a few minutes to review your week.",
        SUNDAY_TAG,
      );
      scheduleAt(
        nextNightlyAt9pm,
        "Log today",
        "How did your habits go? Tap to check in.",
        NIGHTLY_TAG,
      );
    };

    const permission = Notification.permission;
    if (permission === "granted") {
      start();
    } else if (permission !== "denied" && !localStorage.getItem(ASKED_KEY)) {
      localStorage.setItem(ASKED_KEY, "true");
      Notification.requestPermission().then((p) => {
        if (p === "granted" && !cancelled) start();
      });
    }

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  return null;
}
